/**
 * HBO Max — tək epizodun audio/altyazı treklərinin yığımı (Phase 1).
 *
 *   npm run hbomax:inspect-episode
 *
 * `.env` → HBOMAX_EPISODE_URL. Əvvəlcə `npm run hbomax:login`.
 * Treklər əvvəlcə metadata JSON-da axtarılır; yoxdursa player-in "Audio & Subtitles"
 * paneli açılıb etiketlər DOM-dan oxunur (video endirilmir, DRM-ə toxunulmur).
 *
 * Çıxış: output/hbomax-episode.json; output/hbomax-series.json varsa və epizod
 * orada tapılırsa treklər ora da yazılır.
 *
 * Validasiya (yalnız BİR epizod üçün, müvəqqəti):
 *   npm run hbomax:validate-tracks     (= bu script + --validate-ui)
 * Metadata trekləri tapılsa da player paneli açılır və görünən seçimlərlə müqayisə
 * output/hbomax-track-validation.json-a yazılır. İstehsal mənbəyi metadata qalır.
 */
import "dotenv/config";
import path from "node:path";
import { requireHboUrlEnv } from "@/lib/scrapers/hbomaxCollector/config";
import { runCli } from "@/lib/scrapers/hbomaxCollector/cli";
import { hboLog } from "@/lib/scrapers/hbomaxCollector/log";
import { openSession } from "@/lib/scrapers/hbomaxCollector/browser/session";
import { collectEpisodeTracks } from "@/lib/scrapers/hbomaxCollector/collectors/episodeTracks";
import {
  EPISODE_OUTPUT,
  SERIES_OUTPUT,
  TRACK_VALIDATION_OUTPUT,
  mergeEpisodeIntoSeries,
  readSeriesOutput,
  writeJson,
} from "@/lib/scrapers/hbomaxCollector/output";

runCli(async () => {
  const episodeUrl = requireHboUrlEnv("HBOMAX_EPISODE_URL");
  const validateUi = process.argv.includes("--validate-ui");
  const series = readSeriesOutput();
  const session = await openSession();
  try {
    hboLog.info("Authenticated session loaded");
    const { episode, inspector, panelOptions, comparison, json } = await collectEpisodeTracks(session.page, episodeUrl, {
      originalLanguage: series?.originalLanguage,
      validateUi,
    });

    const out = writeJson(EPISODE_OUTPUT, { episode, panelOptions: panelOptions ?? null });
    hboLog.info("Episode saved", { source: episode.tracksSource, file: out });
    for (const t of episode.audioTracks) hboLog.info(`  audio    ${(t.locale ?? t.code ?? "??").padEnd(6)} ${t.type.padEnd(17)} "${t.rawLabel}"`);
    for (const t of episode.subtitleTracks) hboLog.info(`  subtitle ${(t.locale ?? t.code ?? "??").padEnd(6)} ${t.type.padEnd(17)} "${t.rawLabel}"`);

    if (validateUi) {
      if (comparison) {
        const file = writeJson(TRACK_VALIDATION_OUTPUT, {
          episode: { providerId: episode.providerId, seasonNumber: episode.seasonNumber, episodeNumber: episode.episodeNumber, editId: json.editId },
          checkedAt: new Date().toISOString(),
          ...comparison,
        });
        hboLog.info("Track validation saved", { audioMatch: comparison.audioMatch, subtitleMatch: comparison.subtitleMatch, file });
      } else {
        hboLog.warn("Validation requested but no comparison was produced (metadata had no tracks — UI result used directly)");
      }
    }

    if (series) {
      if (mergeEpisodeIntoSeries(series, episode)) {
        writeJson(SERIES_OUTPUT, series);
        hboLog.info("Tracks merged into series output", { file: path.relative(process.cwd(), SERIES_OUTPUT) });
      } else {
        hboLog.warn("Episode not found in output/hbomax-series.json — run hbomax:inspect-series for the matching series first");
      }
    }
    hboLog.info("Debug responses", { dir: path.relative(process.cwd(), inspector.runDir), saved: inspector.stats.saved });
  } finally {
    await session.close();
  }
});
