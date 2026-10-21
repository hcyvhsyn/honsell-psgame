/**
 * Phase 1 çıxışı — DB yox, `output/*.json`. Git-ə düşmür.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { HBOMAX_CONFIG } from "@/lib/scrapers/hbomaxCollector/config";
import type { Episode, Series } from "@/lib/scrapers/hbomaxCollector/models";

export const SERIES_OUTPUT = path.join(HBOMAX_CONFIG.outputDir, "hbomax-series.json");
export const EPISODE_OUTPUT = path.join(HBOMAX_CONFIG.outputDir, "hbomax-episode.json");
export const TRACK_VALIDATION_OUTPUT = path.join(HBOMAX_CONFIG.outputDir, "hbomax-track-validation.json");

export function writeJson(file: string, data: unknown): string {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  return path.relative(process.cwd(), file);
}

export function readSeriesOutput(): Series | null {
  if (!existsSync(SERIES_OUTPUT)) return null;
  return JSON.parse(readFileSync(SERIES_OUTPUT, "utf8")) as Series;
}

/**
 * Epizodun treklərini serial faylındakı uyğun epizoda yazır (providerId, sonra S/E üzrə).
 * Tapılmasa false — serial faylı başqa serialındır və ya epizod hələ kəşf olunmayıb.
 */
export function mergeEpisodeIntoSeries(series: Series, ep: Episode): boolean {
  for (const season of series.seasons) {
    const target =
      season.episodes.find((e) => ep.providerId && e.providerId === ep.providerId) ??
      (season.seasonNumber === ep.seasonNumber && ep.episodeNumber > 0
        ? season.episodes.find((e) => e.episodeNumber === ep.episodeNumber)
        : undefined);
    if (target) {
      target.audioTracks = ep.audioTracks;
      target.subtitleTracks = ep.subtitleTracks;
      target.tracksSource = ep.tracksSource;
      target.tracksScope = ep.tracksScope;
      target.tracksCheckedAt = ep.tracksCheckedAt;
      target.providerUrl ??= ep.providerUrl;
      return true;
    }
  }
  return false;
}
