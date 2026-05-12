import { prisma } from "@/lib/prisma";
import type { Platform } from "@/lib/scrapers/config";
import { netflixScraper } from "@/lib/scrapers/netflix";
import { hboMaxScraper } from "@/lib/scrapers/hbomax";
import { primeScraper } from "@/lib/scrapers/prime";
import { gainScraper } from "@/lib/scrapers/gain";
import { persistPlatformScrape, type PersistDiff } from "@/lib/scrapers/persist";
import type { Scraper, ScraperResult } from "@/lib/scrapers/types";

interface PlatformSummary {
  status: "SUCCESS" | "FAILED";
  added: number;
  removed: number;
  updated: number;
  unchanged: number;
  scrapedCount: number;
  durationMs?: number;
  requestCount?: number;
  warnings: string[];
  error?: string;
}

export interface OrchestratorResult {
  scrapeRunId: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  totals: { added: number; removed: number; updated: number };
  perPlatform: Record<Platform, PlatformSummary>;
}

const ALL_SCRAPERS: Scraper[] = [netflixScraper, hboMaxScraper, primeScraper, gainScraper];

/**
 * Progress event — SSE route bunu UI-yə yayır. Tip-ə görə UI fərqli rəftar
 * göstərir (məs. `platformStart` zamanı spinner, `platformDone`-da yaşıl tik).
 */
export type ProgressEvent =
  | { type: "start"; platforms: Platform[]; scrapeRunId: string }
  | { type: "platformStart"; platform: Platform }
  | { type: "platformDone"; platform: Platform; summary: PlatformSummary }
  | { type: "done"; result: OrchestratorResult }
  | { type: "error"; error: string };

/**
 * Bütün streaming scraper-ləri sıra ilə işə salır. Hər platform digərindən
 * izolyasiya olunub — birinin throw etməsi qalanları dayandırmır.
 *
 *  - Hər platform üçün diff hesablanır və ScrapeChange-lərə yazılır.
 *  - ScrapeRun.summary-də platform breakdown saxlanır.
 *  - Yekun status: hamısı SUCCESS → SUCCESS, biri uğursuz → PARTIAL,
 *    hamısı uğursuz → FAILED.
 *  - `onEvent` verilibsə hər addımda progress yayır (SSE route üçün).
 */
export async function runStreamingScrape(opts?: {
  platforms?: Platform[];
  onEvent?: (event: ProgressEvent) => void;
}): Promise<OrchestratorResult> {
  const emit = opts?.onEvent ?? (() => {});
  const targets = opts?.platforms
    ? ALL_SCRAPERS.filter((s) => opts.platforms!.includes(s.platform))
    : ALL_SCRAPERS;

  const run = await prisma.scrapeRun.create({
    data: { kind: "STREAMING", status: "RUNNING" },
    select: { id: true },
  });

  emit({ type: "start", platforms: targets.map((t) => t.platform), scrapeRunId: run.id });

  const perPlatform: Partial<Record<Platform, PlatformSummary>> = {};
  let totalScraped = 0;
  let totalUpserted = 0;
  const totals = { added: 0, removed: 0, updated: 0 };

  for (const scraper of targets) {
    emit({ type: "platformStart", platform: scraper.platform });
    const summary = await runOne(scraper, run.id);
    perPlatform[scraper.platform] = summary;
    totalScraped += summary.scrapedCount;
    totalUpserted += summary.added + summary.updated;
    totals.added += summary.added;
    totals.removed += summary.removed;
    totals.updated += summary.updated;
    emit({ type: "platformDone", platform: scraper.platform, summary });
  }

  const statuses = Object.values(perPlatform).map((s) => s!.status);
  const status: OrchestratorResult["status"] = statuses.every((s) => s === "SUCCESS")
    ? "SUCCESS"
    : statuses.every((s) => s === "FAILED")
      ? "FAILED"
      : "PARTIAL";

  await prisma.scrapeRun.update({
    where: { id: run.id },
    data: {
      status,
      finishedAt: new Date(),
      scrapedCount: totalScraped,
      upsertedCount: totalUpserted,
      summary: perPlatform as object,
    },
  });

  const result: OrchestratorResult = {
    scrapeRunId: run.id,
    status,
    totals,
    perPlatform: perPlatform as Record<Platform, PlatformSummary>,
  };
  emit({ type: "done", result });
  return result;
}

async function runOne(scraper: Scraper, scrapeRunId: string): Promise<PlatformSummary> {
  try {
    const result: ScraperResult = await scraper.run();
    if (result.fatalError) {
      return {
        status: "FAILED",
        added: 0,
        removed: 0,
        updated: 0,
        unchanged: 0,
        scrapedCount: 0,
        warnings: result.warnings,
        error: result.fatalError,
        durationMs: result.stats?.durationMs,
        requestCount: result.stats?.requestCount,
      };
    }

    const diff = await persistPlatformScrape(scraper.platform, result.titles);
    await writeChanges(scrapeRunId, scraper.platform, diff);

    return {
      status: "SUCCESS",
      added: diff.added,
      removed: diff.removed,
      updated: diff.updated,
      unchanged: diff.unchanged,
      scrapedCount: result.titles.length,
      warnings: result.warnings,
      durationMs: result.stats?.durationMs,
      requestCount: result.stats?.requestCount,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: "FAILED",
      added: 0,
      removed: 0,
      updated: 0,
      unchanged: 0,
      scrapedCount: 0,
      warnings: [],
      error: msg,
    };
  }
}

async function writeChanges(
  scrapeRunId: string,
  platform: Platform,
  diff: PersistDiff
): Promise<void> {
  if (diff.changes.length === 0) return;
  // createMany istifadə edirik (batch). Json payload üçün cast lazımdır.
  await prisma.scrapeChange.createMany({
    data: diff.changes.map((c) => ({
      scrapeRunId,
      platform,
      changeType: c.changeType,
      titleId: c.titleId,
      payload: c.payload as object,
    })),
  });
}
