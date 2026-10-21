/**
 * Validasiya növbəsi (EpisodeRegionState) DB əməliyyatları.
 *
 * Paralellik qoruması: hər işçi persistent Chrome profilini açır, Chrome isə
 * eyni profili ikinci prosesə vermir (SingletonLock). Yəni profil açıldıqdan sonra
 * qalan bütün VALIDATING sətirləri sahibsizdir və PENDING-ə qaytarıla bilər.
 */
import { prisma } from "@/lib/prisma";
import type { LanguageTrack } from "@/lib/scrapers/hbomaxCollector/models";
import { trackRows } from "@/lib/scrapers/hbomaxCollector/db/catalogStore";
import { nextAttemptAfterFailure } from "@/lib/scrapers/hbomaxCollector/queue/rules";

/** Profil kilidi alındıqdan SONRA çağırılmalıdır. */
export async function recoverAbandoned(region: string): Promise<number> {
  const r = await prisma.episodeRegionState.updateMany({
    where: { region, status: "VALIDATING" },
    data: { status: "PENDING", lockedAt: null },
  });
  return r.count;
}

/** Sürüşən 24 saatlıq pəncərədə edilmiş cəhdlər (uğurlu + uğursuz). */
export async function attemptsInLast24h(region: string, now: Date): Promise<number> {
  return prisma.episodeRegionState.count({
    where: { region, lastRegionValidationAt: { gte: new Date(now.getTime() - 86_400_000) } },
  });
}

export interface ClaimedJob {
  stateId: string;
  episodeId: string;
  titleId: string;
  providerUrl: string;
  label: string;
  editId: string | null;
  globalHash: string | null;
  previousStatus: string;
}

export interface ClaimFilter {
  /** Hədəfli əmrlər: status nə olursa olsun (VERIFIED də) götürülür. */
  titleId?: string;
  episodeId?: string;
  /** Bu run-da artıq götürülənlər — hədəfli rejimdə eyni işi təkrar götürməmək üçün. */
  excludeStateIds?: string[];
}

/** Növbəti işi ATOMİK götürür (status şərtli updateMany). Yoxdursa null. */
export async function claimNext(region: string, now: Date, filter: ClaimFilter = {}): Promise<ClaimedJob | null> {
  const targeted = !!(filter.titleId || filter.episodeId);
  for (let tries = 0; tries < 5; tries++) {
    const candidate = await prisma.episodeRegionState.findFirst({
      where: {
        region,
        ...(filter.excludeStateIds?.length ? { id: { notIn: filter.excludeStateIds } } : {}),
        episode: {
          isCurrentlyListed: true,
          ...(filter.episodeId ? { id: filter.episodeId } : {}),
          ...(filter.titleId ? { titleId: filter.titleId } : {}),
        },
        ...(targeted
          ? { status: { not: "VALIDATING" } }
          : {
              OR: [
                { status: { in: ["PENDING", "STALE"] } },
                { status: "FAILED", nextAttemptAt: { lte: now } },
              ],
            }),
      },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        status: true,
        episode: {
          select: {
            id: true,
            titleId: true,
            providerUrl: true,
            seasonNumber: true,
            episodeNumber: true,
            metadataEditId: true,
            globalTracksHash: true,
            title: { select: { title: true } },
          },
        },
      },
    });
    if (!candidate) return null;
    const claimed = await prisma.episodeRegionState.updateMany({
      where: { id: candidate.id, status: candidate.status },
      data: { status: "VALIDATING", lockedAt: now, attempts: { increment: 1 } },
    });
    if (claimed.count !== 1) continue; // başqası götürüb — növbəti namizəd
    const e = candidate.episode;
    return {
      stateId: candidate.id,
      episodeId: e.id,
      titleId: e.titleId,
      providerUrl: e.providerUrl,
      label: `${e.title.title} S${String(e.seasonNumber).padStart(2, "0")}E${String(e.episodeNumber).padStart(2, "0")}`,
      editId: e.metadataEditId,
      globalHash: e.globalTracksHash,
      previousStatus: candidate.status,
    };
  }
  return null;
}

export interface ValidationEvidence {
  audioOptions: number;
  subtitleOptions: number;
  ungroupedOptions: number;
  durationMs: number;
}

/** REGION dəstini tranzaksiyada əvəz edir və VERIFIED yazır. GLOBAL-a toxunmur. */
export async function completeSuccess(
  job: ClaimedJob,
  region: string,
  audio: LanguageTrack[],
  subtitles: LanguageTrack[],
  evidence: ValidationEvidence,
  now: Date
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.episodeTrack.deleteMany({ where: { regionStateId: job.stateId } });
    await tx.episodeTrack.createMany({
      data: [...trackRows("AUDIO", audio), ...trackRows("SUBTITLE", subtitles)].map((t) => ({
        ...t,
        episodeId: job.episodeId,
        scope: "REGION",
        region,
        regionStateId: job.stateId,
        observedAt: now,
      })),
    });
    await tx.episodeRegionState.update({
      where: { id: job.stateId },
      data: {
        status: "VERIFIED",
        verifiedAt: now,
        lastRegionValidationAt: now,
        validatedEditId: job.editId,
        validatedGlobalHash: job.globalHash,
        attempts: 0,
        nextAttemptAt: null,
        lockedAt: null,
        validationError: null,
        evidence: { ...evidence },
      },
    });
  });
}

/** Uğursuz cəhd: backoff ilə FAILED. Köhnə REGION treklər (əgər varsa) qalır. */
export async function completeFailure(job: ClaimedJob, error: string, now: Date, maxAttempts: number, backoffBaseMs: number): Promise<Date | null> {
  const state = await prisma.episodeRegionState.findUniqueOrThrow({ where: { id: job.stateId }, select: { attempts: true } });
  const next = nextAttemptAfterFailure(state.attempts, maxAttempts, now, backoffBaseMs);
  await prisma.episodeRegionState.update({
    where: { id: job.stateId },
    data: { status: "FAILED", lastRegionValidationAt: now, lockedAt: null, validationError: error.slice(0, 500), nextAttemptAt: next },
  });
  return next;
}

/** Ölümcül dayanma (auth/profil): iş cəhd sayılmadan əvvəlki statusuna qaytarılır. */
export async function release(job: ClaimedJob): Promise<void> {
  await prisma.episodeRegionState.update({
    where: { id: job.stateId },
    data: { status: job.previousStatus, lockedAt: null, attempts: { decrement: 1 } },
  });
}
