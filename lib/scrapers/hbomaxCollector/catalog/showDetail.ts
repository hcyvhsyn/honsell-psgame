/**
 * Bir şounun tam metadata-sı CMS-dən (player açılmır):
 *   /cms/routes/show/<id>                     → şou, `seasons` əlaqəsi, epizod rail-inin süzgəci
 *   /cms/collections/<epizod-rail>?pf[show.id]=<id>&pf[seasonNumber]=N&page[items.number]=k
 *                                            → hər sezonun BÜTÜN epizodları (+ edit → GLOBAL treklər)
 *
 * Route cavabındakı ilkin sezon da ayrıca çəkilir: route `page[items.size]=10` ilə
 * gəlir və 10-dan çox epizodlu sezonu kəsə bilər.
 * `complete` = hər sezonun epizod sayı `videoCountByType.EPISODE`-ə bərabərdir və heç
 * bir sorğu uğursuz olmayıb.
 *
 * Film / standalone (MOVIE, STANDALONE): eyni `/cms/routes/show/<id>` route-u əsas videonu
 * da qaytarır — əlavə sorğu yoxdur, nəticə 1 sezon × 1 epizoddur.
 */
import { HBOMAX_CONFIG } from "@/lib/scrapers/hbomaxCollector/config";
import type { CmsClient } from "@/lib/scrapers/hbomaxCollector/catalog/cmsClient";
import type { CmsDoc } from "@/lib/scrapers/hbomaxCollector/catalog/railCrawler";
import { extractSeriesFromJson, titlePageUrl, type JsonSeriesResult } from "@/lib/scrapers/hbomaxCollector/parsers/jsonMetadata";

const PAGE_SIZE = 30;
const MAX_PAGES_PER_SEASON = 10;

export interface ShowDetail {
  show: JsonSeriesResult;
  providerUrl: string;
  complete: boolean;
  problems: string[];
}

export async function fetchShowDetail(cms: CmsClient, showId: string): Promise<ShowDetail> {
  const showUrl = new URL(`/show/${showId}`, HBOMAX_CONFIG.homeUrl).toString();
  const docs: unknown[] = [await cms.get<CmsDoc>(`/cms/routes/show/${showId}?include=default&page[items.size]=10`)];
  const first = extractSeriesFromJson(docs, showUrl);
  const problems = [...first.warnings];
  const providerUrl = titlePageUrl(showId, first.showType, HBOMAX_CONFIG.homeUrl);

  if (!first.title) return { show: first, providerUrl, complete: false, problems: [...problems, "show entity missing"] };
  if (first.kind === "MOVIE") {
    const ok = first.seasons[0]?.episodes.length === 1;
    return { show: first, providerUrl, complete: ok, problems: ok ? [] : problems };
  }
  const filter = first.seasonFilter;
  if (!filter && first.seasonInfo.length) problems.push("episode collection (season filter) not found");

  if (filter) {
    for (const si of first.seasonInfo) {
      for (let page = 1; page <= MAX_PAGES_PER_SEASON; page++) {
        try {
          const doc = await cms.get<CmsDoc>(
            `/cms/collections/${filter.collectionId}?include=default&pf[show.id]=${showId}&pf[seasonNumber]=${si.seasonNumber}&page[items.number]=${page}&page[items.size]=${PAGE_SIZE}`
          );
          docs.push(doc);
          const totalPages = typeof doc.meta?.itemsTotalPages === "number" ? doc.meta.itemsTotalPages : 1;
          if (page >= totalPages) break;
          if (page === MAX_PAGES_PER_SEASON) problems.push(`season ${si.seasonNumber}: more than ${MAX_PAGES_PER_SEASON} pages`);
        } catch (err) {
          problems.push(`season ${si.seasonNumber} page ${page}: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
          break;
        }
      }
    }
  }

  const show = extractSeriesFromJson(docs, showUrl);
  for (const si of show.seasonInfo) {
    const got = show.seasons.find((s) => s.seasonNumber === si.seasonNumber)?.episodes.length ?? 0;
    if (si.expectedEpisodes !== undefined && got !== si.expectedEpisodes) problems.push(`season ${si.seasonNumber}: ${got}/${si.expectedEpisodes} episodes`);
  }
  for (const w of show.warnings) if (!problems.includes(w)) problems.push(w);
  return { show, providerUrl, complete: problems.length === 0, problems };
}
