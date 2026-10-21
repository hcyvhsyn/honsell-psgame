/**
 * Tək serial səhifəsinin yığımı (Phase 1).
 *
 * Axın JSON-dan idarə olunur, UI-dan təxmin edilmir:
 * 1. Səhifə açılır → `cms/routes/show/<id>` cavabından şou, onun `seasons` əlaqəsi
 *    və epizod kolleksiyasının sezon süzgəci (`findSeasonFilter`) oxunur.
 * 2. Epizodları hələ yüklənməmiş HƏR sezon üçün UI-da "Season N" seçilir və
 *    məhz `cms/collections/<collectionId>?…pf[seasonNumber]=N` cavabı gözlənilir
 *    (sıra indeksi ilə klik YOX — ada görə).
 * 3. Yekun parse yalnız əlaqələrlə: show → seasons → episodes.
 *
 * Tam kataloq crawler-i BURADA DEYİL — yalnız əl ilə verilən URL.
 */
import type { Page } from "playwright";
import { HBOMAX_CONFIG, HBOMAX_REGION } from "@/lib/scrapers/hbomaxCollector/config";
import { HboCollectorError } from "@/lib/scrapers/hbomaxCollector/errors";
import { hboLog } from "@/lib/scrapers/hbomaxCollector/log";
import type { Series } from "@/lib/scrapers/hbomaxCollector/models";
import { gotoHbo } from "@/lib/scrapers/hbomaxCollector/browser/session";
import { startNetworkInspector, type InspectorResult } from "@/lib/scrapers/hbomaxCollector/browser/networkInspector";
import { cleanDocumentTitle, readPageMeta } from "@/lib/scrapers/hbomaxCollector/parsers/dom";
import { extractSeriesFromJson, idsFromUrl, type JsonSeriesResult } from "@/lib/scrapers/hbomaxCollector/parsers/jsonMetadata";
import { SERIES, firstVisible, seasonOption } from "@/lib/scrapers/hbomaxCollector/selectors";
import { politeDelay } from "@/lib/scrapers/hbomaxCollector/utils/pacing";

export interface SeriesCollectResult {
  series: Series;
  json: JsonSeriesResult;
  inspector: InspectorResult;
  /** Sezon nömrəsi → cavab gəldimi. */
  seasonLoads: Record<number, "initial" | "loaded" | "failed">;
}

function isSeasonCollectionUrl(url: string, collectionId: string, n: number): boolean {
  const u = decodeURIComponent(url);
  return u.includes(`/cms/collections/${collectionId}`) && u.includes(`pf[seasonNumber]=${n}`);
}

async function selectSeason(page: Page, collectionId: string, n: number): Promise<boolean> {
  const response = page
    .waitForResponse((r) => isSeasonCollectionUrl(r.url(), collectionId, n) && r.ok(), { timeout: HBOMAX_CONFIG.navTimeoutMs })
    .then(() => true, () => false);

  const tab = seasonOption(page, n).and(page.getByRole("tab"));
  if (await tab.count()) {
    await tab.first().click();
  } else {
    const dropdown = await firstVisible(page, SERIES.seasonDropdown, 5_000);
    if (!dropdown) {
      throw new HboCollectorError("SELECTOR_MISSING", "Season selector not found (see selectors.ts SERIES.seasonDropdown)");
    }
    await dropdown.scrollIntoViewIfNeeded().catch(() => undefined);
    await dropdown.click();
    const option = seasonOption(page, n).first();
    // ⚠️ `isVisible({ timeout })` GÖZLƏMİR (timeout nəzərə alınmır) — menyu animasiyası ilə yarışırdı.
    if (!(await option.waitFor({ state: "visible", timeout: 5_000 }).then(() => true, () => false))) {
      await page.keyboard.press("Escape");
      throw new HboCollectorError("SELECTOR_MISSING", `Option "Season ${n}" not found in the season dropdown`);
    }
    await option.click();
  }
  const ok = await response;
  await politeDelay(HBOMAX_CONFIG.pageDelayMs);
  return ok;
}

export async function collectSeries(page: Page, seriesUrl: string): Promise<SeriesCollectResult> {
  const inspector = startNetworkInspector(page, "series");
  const seasonLoads: SeriesCollectResult["seasonLoads"] = {};
  let inspectorResult: InspectorResult;
  try {
    await gotoHbo(page, seriesUrl, "series page");
    hboLog.info("Series page opened");

    const initial = extractSeriesFromJson(inspector.captured.map((c) => c.body), seriesUrl);
    if (!initial.title) {
      throw new HboCollectorError("NOT_FOUND", `Show ${initial.providerId} not found in the page metadata (${initial.warnings.join("; ")})`);
    }
    const filter = initial.seasonFilter;
    hboLog.info(`Show has ${initial.seasonInfo.length} season(s) via show.relationships.seasons`, {
      seasonFilter: filter ? `${filter.collectionId} [${filter.seasonNumbers.join(",")}]` : "not found",
    });

    for (const season of initial.seasons) {
      if (season.episodes.length) {
        seasonLoads[season.seasonNumber] = "initial";
        continue;
      }
      if (!filter) {
        seasonLoads[season.seasonNumber] = "failed";
        hboLog.warn(`Season ${season.seasonNumber}: no episode collection filter on the page — cannot load its episodes`);
        continue;
      }
      hboLog.info(`Loading season ${season.seasonNumber}`);
      const ok = await selectSeason(page, filter.collectionId, season.seasonNumber);
      seasonLoads[season.seasonNumber] = ok ? "loaded" : "failed";
      if (!ok) hboLog.warn(`Season ${season.seasonNumber}: episode collection response not received`);
    }
  } finally {
    inspectorResult = await inspector.stop();
  }

  const json = extractSeriesFromJson(inspectorResult.captured.map((c) => c.body), seriesUrl);
  hboLog.info("JSON entities", { types: Object.entries(json.entityTypes).map(([t, n]) => `${t}:${n}`).join(" ") || "none" });
  for (const w of json.warnings) hboLog.warn(w);
  if (json.rejectedEpisodes) hboLog.info(`${json.rejectedEpisodes} episode entities from other shows/seasons ignored`);

  const meta = await readPageMeta(page);
  const provenance: Series["provenance"] = {};
  const pick = <T>(field: keyof Series["provenance"] & string, fromJson: T | undefined, fromDom: T | undefined): T | undefined => {
    if (fromJson !== undefined && fromJson !== null && !(Array.isArray(fromJson) && !fromJson.length)) {
      provenance[field] = "json";
      return fromJson;
    }
    if (fromDom !== undefined) {
      provenance[field] = "dom";
      return fromDom;
    }
    return undefined;
  };

  const title = pick("title", json.title, meta.title ?? cleanDocumentTitle(meta.documentTitle));
  if (!title) throw new HboCollectorError("SELECTOR_MISSING", "Could not determine the series title from JSON or DOM");
  if (json.seasons.length) provenance.seasons = "json";

  const series: Series = {
    providerId: pick("providerId", json.providerId, idsFromUrl(seriesUrl).showId),
    title,
    originalTitle: pick("originalTitle", json.originalTitle, undefined),
    description: pick("description", json.description, meta.description),
    year: pick("year", json.year, undefined),
    genres: pick("genres", json.genres, undefined) ?? [],
    posterUrl: pick("posterUrl", json.posterUrl, undefined),
    backdropUrl: pick("backdropUrl", json.backdropUrl, meta.image),
    originalLanguage: pick("originalLanguage", json.originalLanguage, undefined),
    providerUrl: seriesUrl,
    region: HBOMAX_REGION,
    seasons: json.seasons,
    provenance,
    lastCheckedAt: new Date().toISOString(),
  };

  // Tamlıq: hər sezonun epizod sayı `season.videoCountByType.EPISODE` ilə müqayisə olunur.
  for (const si of json.seasonInfo) {
    const got = json.seasons.find((s) => s.seasonNumber === si.seasonNumber)?.episodes.length ?? 0;
    const line = `Season ${si.seasonNumber}: ${got}/${si.expectedEpisodes ?? "?"} episodes`;
    if (si.expectedEpisodes !== undefined && got !== si.expectedEpisodes) hboLog.warn(`${line} — incomplete (collection paging?)`);
    else hboLog.info(line);
  }
  const episodeCount = json.seasons.reduce((n, s) => n + s.episodes.length, 0);
  hboLog.info(`${json.seasons.length} seasons discovered`);
  hboLog.info(`${episodeCount} episodes discovered`);
  return { series, json, inspector: inspectorResult, seasonLoads };
}
