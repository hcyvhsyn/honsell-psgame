/**
 * Stage 2 — AZ validasiya işçisi. Bir persistent Chrome, bir səhifə, bir epizod.
 *
 * Hər iş: epizodu aç (strict profil) → player → "Audio & Subtitles" → görünən
 * seçimlər → normallaşdır → REGION dəstini əvəz et (VERIFIED) → playback dayandır
 * → nəzakət fasiləsi. Resume DB vəziyyəti ilə: dayanan proses yenidən işə
 * salınanda qalan PENDING/STALE/FAILED işlərdən davam edir.
 *
 * Ölümcül hallarda (sessiya bitib, profil seçimi/yanlış profil, konfiqurasiya)
 * iş cəhd sayılmadan qaytarılır və BÜTÜN proses dayanır — növbəni "FAILED"-lə
 * yandırmamaq və başqa profilin baxış tarixçəsinə toxunmamaq üçün.
 */
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { HBOMAX_CONFIG, HBOMAX_REGION } from "@/lib/scrapers/hbomaxCollector/config";
import { HboCollectorError, assertCollectorDbSelected, isHboError } from "@/lib/scrapers/hbomaxCollector/errors";
import { hboLog } from "@/lib/scrapers/hbomaxCollector/log";
import { assertDedicatedProfile, gotoHbo, openSession } from "@/lib/scrapers/hbomaxCollector/browser/session";
import { readPlayerTracks, stopPlayback } from "@/lib/scrapers/hbomaxCollector/browser/playerTracks";
import { recomputeTitleLanguages } from "@/lib/scrapers/hbomaxCollector/db/aggregateStore";
import {
  attemptsInLast24h,
  claimNext,
  completeFailure,
  completeSuccess,
  recoverAbandoned,
  release,
  type ClaimFilter,
} from "@/lib/scrapers/hbomaxCollector/db/queueStore";
import { classifyAudioTracks, classifySubtitleTracks } from "@/lib/scrapers/hbomaxCollector/utils/language";
import { politeDelay } from "@/lib/scrapers/hbomaxCollector/utils/pacing";

const FATAL: ReadonlyArray<string> = ["AUTH_REQUIRED", "PROFILE_SELECTION", "CONFIG"];

export interface ValidationRunOptions {
  /** pending: növbə; show/episode: hədəfli (status nəzərə alınmır). */
  mode: "pending" | "show" | "episode";
  titleId?: string;
  episodeId?: string;
  /** Bu run üçün maksimum iş (gündəlik limitdən əlavə). */
  limit?: number;
}

export interface ValidationRunSummary {
  verified: number;
  failed: number;
  recovered: number;
  stoppedBy?: string;
  titlesRecomputed: number;
}

export async function runValidation(opts: ValidationRunOptions): Promise<ValidationRunSummary> {
  assertCollectorDbSelected();
  if (!HBOMAX_CONFIG.profileName) {
    throw new HboCollectorError("CONFIG", "HBOMAX_PROFILE_NAME must be set for validation (dedicated collector profile)");
  }
  const region = HBOMAX_REGION;
  const v = HBOMAX_CONFIG.validation;
  const run = await prisma.scrapeRun.create({ data: { kind: "HBOMAX_VALIDATE", status: "RUNNING" } });
  const summary: ValidationRunSummary = { verified: 0, failed: 0, recovered: 0, titlesRecomputed: 0 };
  const touchedTitles = new Set<string>();
  const diagDir = path.join(HBOMAX_CONFIG.debugDir, "validation");

  const session = await openSession();
  try {
    // Profil kilidi alınıb → qalan VALIDATING-lər sahibsizdir.
    summary.recovered = await recoverAbandoned(region);
    if (summary.recovered) hboLog.warn(`Recovered ${summary.recovered} abandoned VALIDATING job(s) → PENDING`);

    await gotoHbo(session.page, HBOMAX_CONFIG.homeUrl, "home", { strictProfile: true });
    await assertDedicatedProfile(session.page);

    const filter: ClaimFilter = { titleId: opts.titleId, episodeId: opts.episodeId };
    const seen = new Set<string>();
    let processed = 0;

    while (opts.limit === undefined || processed < opts.limit) {
      const now = new Date();
      const used = await attemptsInLast24h(region, now);
      if (used >= v.dailyLimit) {
        summary.stoppedBy = `daily limit reached (${used}/${v.dailyLimit} in the last 24h)`;
        break;
      }
      const job = await claimNext(region, now, { ...filter, excludeStateIds: [...seen] });
      if (!job) break;
      seen.add(job.stateId);
      processed++;
      hboLog.info(`Validating ${job.label}`, { status: job.previousStatus, used: `${used + 1}/${v.dailyLimit}` });

      try {
        await gotoHbo(session.page, job.providerUrl, job.label, { strictProfile: true });
        const read = await readPlayerTracks(session.page, diagDir);
        const audio = classifyAudioTracks(read.audioLabels.map((label) => ({ label })));
        const subtitles = classifySubtitleTracks(read.subtitleLabels.map((label) => ({ label })));
        await completeSuccess(job, region, audio, subtitles, {
          audioOptions: read.audioLabels.length,
          subtitleOptions: read.subtitleLabels.length,
          ungroupedOptions: read.ungroupedLabels.length,
          durationMs: read.durationMs,
        }, new Date());
        summary.verified++;
        touchedTitles.add(job.titleId);
        hboLog.info(`Verified ${job.label}`, { audio: audio.length, subtitles: subtitles.length });
      } catch (err) {
        if (isHboError(err) && FATAL.includes(err.code)) {
          await release(job);
          throw err;
        }
        const msg = isHboError(err) ? `${err.code}: ${err.message}` : err instanceof Error ? err.message.split("\n")[0] : String(err);
        const next = await completeFailure(job, msg, new Date(), v.maxAttempts, v.backoffBaseMs);
        summary.failed++;
        touchedTitles.add(job.titleId);
        hboLog.warn(`Failed ${job.label}: ${msg}`, { nextAttemptAt: next?.toISOString() ?? "terminal" });
      } finally {
        await stopPlayback(session.page);
      }
      await politeDelay(v.delayMs);
    }
  } catch (err) {
    summary.stoppedBy = isHboError(err) ? err.code : "error";
    await prisma.scrapeRun.update({
      where: { id: run.id },
      data: { status: "FAILED", finishedAt: new Date(), summary: { ...summary }, error: err instanceof Error ? err.message.slice(0, 500) : String(err) },
    });
    throw err;
  } finally {
    await session.close();
    for (const titleId of touchedTitles) {
      await recomputeTitleLanguages(titleId, region);
      summary.titlesRecomputed++;
    }
  }

  await prisma.scrapeRun.update({
    where: { id: run.id },
    data: { status: summary.failed ? "PARTIAL" : "SUCCESS", finishedAt: new Date(), scrapedCount: summary.verified + summary.failed, upsertedCount: summary.verified, summary: { ...summary } },
  });
  return summary;
}
