/**
 * HBO Max — tək serialın metadata yığımı (Phase 1).
 *
 *   npm run hbomax:inspect-series
 *
 * `.env` → HBOMAX_SERIES_URL. Əvvəlcə `npm run hbomax:login`.
 * Çıxış: output/hbomax-series.json + debug-responses/<vaxt>-series/ (faydalı JSON-lar).
 * Treklər serial cavabındakı `edit` entity-lərindən hər epizod üçün gəlir.
 */
import "dotenv/config";
import path from "node:path";
import { requireHboUrlEnv } from "@/lib/scrapers/hbomaxCollector/config";
import { runCli } from "@/lib/scrapers/hbomaxCollector/cli";
import { hboLog } from "@/lib/scrapers/hbomaxCollector/log";
import { openSession } from "@/lib/scrapers/hbomaxCollector/browser/session";
import { collectSeries } from "@/lib/scrapers/hbomaxCollector/collectors/series";
import { SERIES_OUTPUT, writeJson } from "@/lib/scrapers/hbomaxCollector/output";

runCli(async () => {
  const seriesUrl = requireHboUrlEnv("HBOMAX_SERIES_URL");
  const session = await openSession();
  try {
    hboLog.info("Authenticated session loaded");
    const { series, inspector } = await collectSeries(session.page, seriesUrl);
    const withTracks = series.seasons.flatMap((s) => s.episodes).filter((e) => e.tracksSource === "json").length;
    hboLog.info(`Episodes with metadata tracks: ${withTracks}`);

    const out = writeJson(SERIES_OUTPUT, series);
    hboLog.info("Series saved", {
      title: series.title,
      providerId: series.providerId,
      poster: !!series.posterUrl,
      backdrop: !!series.backdropUrl,
      genres: series.genres.length,
      file: out,
    });
    hboLog.info("Debug responses", { dir: path.relative(process.cwd(), inspector.runDir), saved: inspector.stats.saved });
  } finally {
    await session.close();
  }
});
