/**
 * Stage 1 — metadata kataloq sync-i (player AÇILMIR).
 *
 *   kəşf (crawlRails → şou siyahısı) → markShowsSeen (regional görünmə)
 *   → hər şou: fetchShowDetail → persistShow (sezon/epizod/GLOBAL treklər/növbə)
 *   → yalnız TAM və UĞURLU kəşfdən sonra: applyMissingSyncs
 *
 * `--show` və `--limit` run-ları qismən sayılır: itən başlıq sayğacına toxunmur.
 * `--limit` kəşfi yenə tam edir (görünmə qeyd olunur), yalnız detal sayını kəsir.
 */
import type { Page } from "playwright";
import { prisma } from "@/lib/prisma";
import { HBOMAX_CONFIG, HBOMAX_REGION } from "@/lib/scrapers/hbomaxCollector/config";
import { assertCollectorDbSelected, isBrowserClosed, isHboError } from "@/lib/scrapers/hbomaxCollector/errors";
import { hboLog } from "@/lib/scrapers/hbomaxCollector/log";
import { openCmsClient } from "@/lib/scrapers/hbomaxCollector/catalog/cmsClient";
import { crawlRails, isSourceComplete, showsFromCrawl, type DiscoveredShowRef, type DiscoverySource } from "@/lib/scrapers/hbomaxCollector/catalog/discovery";
import { fetchShowDetail } from "@/lib/scrapers/hbomaxCollector/catalog/showDetail";
import { applyMissingSyncs, markShowsSeen, persistShow } from "@/lib/scrapers/hbomaxCollector/db/catalogStore";
import { recomputeTitleLanguages } from "@/lib/scrapers/hbomaxCollector/db/aggregateStore";

export interface CatalogSyncOptions {
  source: DiscoverySource;
  /** Yalnız bu şoular (kəşf atlanır → qismən run). */
  showIds?: string[];
  /** Detalı çəkiləcək şou sayı (kəşf tam qalır). */
  limit?: number;
  /** Yalnız metadata-sı HƏLƏ çəkilməmiş başlıqlar (yarımçıq run-un davamı). Kəşf tam qalır. */
  onlyMissing?: boolean;
  dryRun?: boolean;
}

export interface CatalogSyncSummary {
  full: boolean;
  discovered: number;
  newTitles: number;
  detailed: number;
  incompleteShows: number;
  failedShows: number;
  episodesCreated: number;
  episodesUnlisted: number;
  queueCreated: number;
  queueStaled: number;
  missing?: { incremented: number; deactivated: number };
  requests: number;
}

export async function runCatalogSync(page: Page, opts: CatalogSyncOptions): Promise<CatalogSyncSummary> {
  assertCollectorDbSelected();
  const region = HBOMAX_REGION;
  const now = new Date();
  const cms = await openCmsClient(page);
  const targeted = !!opts.showIds?.length;
  const run = opts.dryRun ? null : await prisma.scrapeRun.create({ data: { kind: "HBOMAX_CATALOG", status: "RUNNING" } });
  const summary: CatalogSyncSummary = {
    full: false,
    discovered: 0,
    newTitles: 0,
    detailed: 0,
    incompleteShows: 0,
    failedShows: 0,
    episodesCreated: 0,
    episodesUnlisted: 0,
    queueCreated: 0,
    queueStaled: 0,
    requests: 0,
  };

  try {
    let shows: DiscoveredShowRef[];
    let discoveryComplete = false;
    if (targeted) {
      shows = opts.showIds!.map((id) => ({ providerId: id, name: "", showType: "SERIES", providerUrl: new URL(`/show/${id}`, HBOMAX_CONFIG.homeUrl).toString() }));
    } else {
      const crawl = await crawlRails(cms);
      shows = showsFromCrawl(crawl, opts.source);
      discoveryComplete = isSourceComplete(crawl, opts.source);
      hboLog.info(`Discovered ${shows.length} show(s)`, { source: opts.source, discoveryComplete });
    }
    summary.discovered = shows.length;
    if (opts.dryRun) {
      summary.requests = cms.requestCount;
      return summary;
    }

    // Kəşf run-ında rail-də görünmək = AZ kataloqunda görünmək. Hədəfli run-da isə
    // şou yalnız detalı UĞURLA gəldikdən sonra "görünüb" sayılır (404 ≠ mövcud).
    const createdIds = targeted ? new Set<string>() : await markShowsSeen(region, shows, now);
    summary.newTitles = createdIds.size;

    let pending = shows;
    if (opts.onlyMissing) {
      const done = await prisma.providerTitle.findMany({
        where: { platform: "HBOMAX", providerId: { in: shows.map((x) => x.providerId) }, lastMetadataSyncAt: { not: null } },
        select: { providerId: true },
      });
      const doneIds = new Set(done.map((d) => d.providerId));
      pending = shows.filter((x) => !doneIds.has(x.providerId));
      hboLog.info(`--missing: ${pending.length} title(s) without metadata (${doneIds.size} already synced)`);
    }
    const detailList = opts.limit ? pending.slice(0, opts.limit) : pending;
    for (const [i, ref] of detailList.entries()) {
      try {
        const detail = await fetchShowDetail(cms, ref.providerId);
        if (!detail.show.title) {
          summary.failedShows++;
          hboLog.warn(`Show ${ref.providerId} (${ref.name}) has no show entity — skipped`, { problems: detail.problems.join("; ") });
          continue;
        }
        if (targeted) {
          const created = await markShowsSeen(region, [{ ...ref, name: detail.show.title, showType: detail.show.showType, providerUrl: detail.providerUrl }], now);
          for (const id of created) createdIds.add(id);
          summary.newTitles = createdIds.size;
        }
        const res = await persistShow({
          region,
          show: detail.show,
          providerUrl: detail.providerUrl,
          complete: detail.complete,
          titleIsNew: createdIds.has(ref.providerId),
          now,
          revalidateAfterDays: HBOMAX_CONFIG.validation.revalidateAfterDays,
        });
        if (res.queueStaled) await recomputeTitleLanguages(res.titleId, region);
        summary.detailed++;
        summary.episodesCreated += res.episodesCreated;
        summary.episodesUnlisted += res.episodesUnlisted;
        summary.queueCreated += res.queueCreated;
        summary.queueStaled += res.queueStaled;
        if (!detail.complete) {
          summary.incompleteShows++;
          hboLog.warn(`Incomplete: ${detail.show.title}`, { problems: detail.problems.join("; ") });
        }
      } catch (err) {
        if (isHboError(err, "AUTH_REQUIRED") || isBrowserClosed(err)) throw err;
        summary.failedShows++;
        hboLog.warn(`Show ${ref.providerId} (${ref.name}) failed: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
      }
      if ((i + 1) % 25 === 0) hboLog.info(`Shows processed: ${i + 1}/${detailList.length}`, { requests: cms.requestCount });
    }

    // İtən başlıqlar: yalnız tam (hədəfsiz) və natamamlıqsız kəşfdən sonra.
    summary.full = !targeted && discoveryComplete;
    if (summary.full) {
      summary.missing = await applyMissingSyncs(region, new Set(shows.map((s) => s.providerId)), now);
    } else {
      hboLog.info("Partial run — consecutiveMissingSyncs not touched");
    }
    summary.requests = cms.requestCount;
    if (run) {
      await prisma.scrapeRun.update({
        where: { id: run.id },
        data: {
          status: summary.failedShows || !summary.full ? "PARTIAL" : "SUCCESS",
          finishedAt: new Date(),
          scrapedCount: summary.discovered,
          upsertedCount: summary.detailed,
          summary: { ...summary },
        },
      });
    }
    return summary;
  } catch (err) {
    if (run) {
      await prisma.scrapeRun.update({
        where: { id: run.id },
        data: { status: "FAILED", finishedAt: new Date(), summary: { ...summary }, error: err instanceof Error ? err.message.slice(0, 500) : String(err) },
      });
    }
    throw err;
  }
}
