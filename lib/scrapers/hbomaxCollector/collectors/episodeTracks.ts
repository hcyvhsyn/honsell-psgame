/**
 * Tək epizodun audio/altyazı treklərinin yığımı (Phase 1).
 *
 * Sıra:
 * 1. Epizod səhifəsi açılır, ADİ metadata JSON-ları tutulur — treklər orada varsa
 *    player-ə ehtiyac yoxdur.
 *    ⚠️ Bu treklər QLOBAL aktiv siyahısıdır, AZ-da əlçatan siyahı DEYİL (validasiya:
 *    S03E08 metadata 21/33, AZ player 10/26 — Turkish, German, es-419, pt-BR, AD, CC
 *    yalnız metadata-da). `tracksScope` bunu daşıyır.
 * 2. Yoxdursa player yalnız kontrollara çatmaq üçün açılır, "Audio & Subtitles"
 *    paneli açılır və etiketlər DOM-dan oxunur. Sonra video pauza edilir və
 *    səhifə `about:blank`-a keçir (axın dayansın).
 *
 * Media/manifest/DRM sorğuları OXUNMUR (networkInspector onları gövdəsiz atır),
 * ekran görüntüsü çəkilmir — yalnız UI mətni.
 */
import path from "node:path";
import type { Page } from "playwright";
import { hboLog } from "@/lib/scrapers/hbomaxCollector/log";
import type { Episode } from "@/lib/scrapers/hbomaxCollector/models";
import { writeJson } from "@/lib/scrapers/hbomaxCollector/output";
import { gotoHbo } from "@/lib/scrapers/hbomaxCollector/browser/session";
import { episodeCodeFromDom, readPlayerTracks, stopPlayback } from "@/lib/scrapers/hbomaxCollector/browser/playerTracks";
import { startNetworkInspector, type InspectorResult } from "@/lib/scrapers/hbomaxCollector/browser/networkInspector";
import type { PanelOption } from "@/lib/scrapers/hbomaxCollector/parsers/dom";
import { extractEpisodeFromJson, idsFromUrl, type JsonEpisodeResult } from "@/lib/scrapers/hbomaxCollector/parsers/jsonMetadata";
import { classifyAudioTracks, classifySubtitleTracks } from "@/lib/scrapers/hbomaxCollector/utils/language";
import { compareTracks, type TrackComparison } from "@/lib/scrapers/hbomaxCollector/utils/trackCompare";

export interface EpisodeCollectResult {
  episode: Episode;
  json: JsonEpisodeResult;
  inspector: InspectorResult;
  /** Player panelindən oxunan xam seçimlər (UI fallback və ya validasiya işlədisə). */
  panelOptions?: PanelOption[];
  /** Yalnız `validateUi` + metadata trekləri olduqda: metadata ↔ player UI müqayisəsi. */
  comparison?: TrackComparison;
}

export async function collectEpisodeTracks(
  page: Page,
  episodeUrl: string,
  ctx: { originalLanguage?: string; validateUi?: boolean } = {}
): Promise<EpisodeCollectResult> {
  const inspector = startNetworkInspector(page, "episode");
  let inspectorResult: InspectorResult | undefined;
  let panelOptions: PanelOption[] | undefined;
  let json: JsonEpisodeResult = {};
  let code: { season?: number; episode?: number } = {};

  try {
    await gotoHbo(page, episodeUrl, "episode page");
    hboLog.info("Episode page opened");
    json = extractEpisodeFromJson(inspector.captured.map((c) => c.body), episodeUrl);

    const jsonEp = json.episode;
    const jsonHasTracks = jsonEp?.tracksSource === "json" && (jsonEp.audioTracks.length > 0 || jsonEp.subtitleTracks.length > 0);
    if (jsonHasTracks) {
      hboLog.info("Audio/subtitle tracks found in metadata JSON", { video: jsonEp?.providerId, edit: json.editId });
    }
    if (jsonHasTracks && !ctx.validateUi) {
      hboLog.info("Player not needed");
    } else {
      hboLog.info(
        jsonHasTracks
          ? "Validation mode — opening player Audio & Subtitles UI to compare with metadata"
          : "No track info in metadata JSON — falling back to player Audio & Subtitles UI"
      );
      const read = await readPlayerTracks(page, inspector.runDir);
      code = await episodeCodeFromDom(page);
      panelOptions = read.options;
      writeJson(path.join(inspector.runDir, "_panel-options.json"), panelOptions);
    }
  } finally {
    await stopPlayback(page);
    inspectorResult = await inspector.stop();
  }

  const originalLanguage = ctx.originalLanguage ?? json.originalLanguage;
  const base = json.episode;
  const episode: Episode = {
    providerId: base?.providerId ?? idsFromUrl(episodeUrl).videoId,
    title: base?.title,
    description: base?.description,
    seasonNumber: base?.seasonNumber || code.season || 0,
    episodeNumber: base?.episodeNumber || code.episode || 0,
    providerUrl: episodeUrl,
    audioTracks: base?.audioTracks ?? [],
    subtitleTracks: base?.subtitleTracks ?? [],
    tracksSource: base?.tracksSource,
    tracksScope: base?.tracksScope,
    tracksCheckedAt: new Date().toISOString(),
  };

  let comparison: TrackComparison | undefined;
  if (panelOptions) {
    const uiAudio = classifyAudioTracks(
      panelOptions.filter((o) => o.group === "audio").map((o) => ({ label: o.label })),
      { originalLanguage }
    );
    const uiSubtitles = classifySubtitleTracks(
      panelOptions.filter((o) => o.group === "subtitles").map((o) => ({ label: o.label }))
    );
    if (episode.tracksSource === "json") {
      // Validasiya: metadata İSTEHSAL mənbəyi olaraq qalır, UI yalnız müqayisə üçündür.
      comparison = compareTracks(
        { audio: episode.audioTracks, subtitles: episode.subtitleTracks },
        { audio: uiAudio, subtitles: uiSubtitles }
      );
      hboLog.info("Metadata vs player UI", {
        audio: `${comparison.metadataAudio.length} vs ${comparison.uiAudio.length}`,
        audioMatch: comparison.audioMatch,
        subtitles: `${comparison.metadataSubtitles.length} vs ${comparison.uiSubtitles.length}`,
        subtitleMatch: comparison.subtitleMatch,
      });
    } else {
      episode.audioTracks = uiAudio;
      episode.subtitleTracks = uiSubtitles;
      episode.tracksSource = "player-ui";
      episode.tracksScope = "region-playable";
    }
    const ungrouped = panelOptions.filter((o) => o.group === "unknown");
    if (ungrouped.length) hboLog.warn(`${ungrouped.length} panel options could not be grouped and were ignored`, { labels: ungrouped.map((o) => o.label).join(" | ") });
  }

  const tag = `S${String(episode.seasonNumber).padStart(2, "0")}E${String(episode.episodeNumber).padStart(2, "0")}`;
  hboLog.info(`Inspecting ${tag}`);
  hboLog.info(`Audio tracks: ${episode.audioTracks.length}`);
  hboLog.info(`Subtitle tracks: ${episode.subtitleTracks.length}`);
  if (!episode.subtitleTracks.length) hboLog.warn("Episode has no subtitle tracks");
  if (episode.audioTracks.length === 1) hboLog.info("Episode has a single audio track");
  if (!episode.seasonNumber || !episode.episodeNumber) hboLog.warn("Season/episode number could not be determined");

  return { episode, json, inspector: inspectorResult, panelOptions, comparison };
}
