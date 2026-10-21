/**
 * HBO Max — A–Z örtük spike-ı (Phase 2, kataloq sync-dən ƏVVƏL).
 *
 *   npm run hbomax:coverage-spike
 *
 * Sual: `*-a-z` serial kolleksiyalarının birləşməsi AZ kataloqunun TAM kəşf
 * mənbəyidirmi? Naviqasiyadakı hub səhifələri (home, series, movies, genre/*,
 * channel/*, categories …) gəzilir, hər kolleksiya bütün səhifələri ilə oxunur,
 * A–Z birləşməsi qalan bütün rail-lərlə müqayisə olunur.
 *
 * Yalnız CMS metadata (brauzer daxili fetch). Player açılmır, DB-yə yazılmır.
 * Çıxış: output/hbomax-az-coverage.json
 */
import "dotenv/config";
import path from "node:path";
import { HBOMAX_CONFIG } from "@/lib/scrapers/hbomaxCollector/config";
import { runCli } from "@/lib/scrapers/hbomaxCollector/cli";
import { hboLog } from "@/lib/scrapers/hbomaxCollector/log";
import { gotoHbo, openSession } from "@/lib/scrapers/hbomaxCollector/browser/session";
import { captureCmsContext } from "@/lib/scrapers/hbomaxCollector/catalog/cmsClient";
import { crawlRails, isAzAlias as isAz } from "@/lib/scrapers/hbomaxCollector/catalog/discovery";
import { writeJson } from "@/lib/scrapers/hbomaxCollector/output";

runCli(async () => {
  const session = await openSession();
  try {
    const makeClient = captureCmsContext(session.page);
    await gotoHbo(session.page, new URL("/series", HBOMAX_CONFIG.homeUrl).toString(), "series page");
    const cms = await makeClient();
    hboLog.info("CMS client ready", { origin: cms.origin });

    const crawl = await crawlRails(cms);
    const { scans, failedRoutes } = crawl;
    const visitedRoutes = crawl.routesVisited;

    // 3) A–Z birləşməsi ↔ qalan rail-lər
    const azShows = new Map<string, string>();
    const otherShows = new Map<string, { name: string; rails: Set<string> }>();
    const showTypeOf = new Map<string, string>();
    for (const scan of scans.values()) {
      for (const [id, s] of scan.shows) {
        if (s.showType !== "UNKNOWN" || !showTypeOf.has(id)) showTypeOf.set(id, s.showType);
        if (isAz(scan.ref.alias)) azShows.set(id, s.name);
        else {
          const o = otherShows.get(id) ?? { name: s.name, rails: new Set<string>() };
          if (!o.name) o.name = s.name;
          o.rails.add(scan.ref.alias);
          otherShows.set(id, o);
        }
      }
    }
    const allShows = new Set([...azShows.keys(), ...otherShows.keys()]);
    const missing = [...otherShows.entries()]
      .filter(([id]) => !azShows.has(id))
      .map(([id, o]) => ({ showId: id, name: o.name, showType: showTypeOf.get(id) ?? "UNKNOWN", rails: [...o.rails].sort() }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const railMissCount = new Map<string, number>();
    for (const m of missing) for (const r of m.rails) railMissCount.set(r, (railMissCount.get(r) ?? 0) + 1);

    const azCollections = [...scans.values()].filter((s) => isAz(s.ref.alias));
    const byType = (ids: Iterable<string>) => {
      const out: Record<string, number> = {};
      for (const id of ids) {
        const t = showTypeOf.get(id) ?? "UNKNOWN";
        out[t] = (out[t] ?? 0) + 1;
      }
      return out;
    };
    const report = {
      checkedAt: new Date().toISOString(),
      region: "AZ",
      requests: cms.requestCount,
      routesCrawled: visitedRoutes,
      discoveryComplete: crawl.complete,
      routesWithoutPage: crawl.routesWithoutPage,
      failedRoutes,
      totals: {
        collectionsScanned: scans.size,
        azCollections: azCollections.length,
        uniqueShowsInAz: azShows.size,
        uniqueShowsAcrossAllRails: allShows.size,
        uniqueShowsOutsideAz: otherShows.size,
        showsMissingFromAz: missing.length,
      },
      byShowType: {
        inAz: byType(azShows.keys()),
        acrossAllRails: byType(allShows),
        missingFromAz: byType(missing.map((m) => m.showId)),
      },
      azCollections: azCollections
        .map((s) => ({ alias: s.ref.alias, id: s.ref.id, shows: s.shows.size, totalItems: s.totalItems, pages: s.pages, truncated: s.truncated, error: s.error }))
        .sort((a, b) => a.alias.localeCompare(b.alias)),
      railsContributingMissingShows: [...railMissCount.entries()].sort((a, b) => b[1] - a[1]).map(([alias, count]) => ({ alias, missingShows: count })),
      missingFromAz: missing,
      failedCollections: [...scans.values()].filter((s) => s.error).map((s) => ({ alias: s.ref.alias, id: s.ref.id, error: s.error })),
      truncatedCollections: [...scans.values()].filter((s) => s.truncated).map((s) => s.ref.alias),
    };
    const file = writeJson(path.join(HBOMAX_CONFIG.outputDir, "hbomax-az-coverage.json"), report);
    hboLog.info("Coverage spike done", { ...report.totals, requests: cms.requestCount, file });
  } finally {
    await session.close();
  }
});
