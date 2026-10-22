/**
 * Kataloq kəşfi — naviqasiya hub səhifələri → kolleksiyalar (bütün səhifələri ilə,
 * iç-içə tab kolleksiyaları daxil) → şou ID-ləri. Yalnız CMS metadata.
 *
 * Coverage spike (`hbomax:coverage-spike`) və catalog-sync eyni gəzintini işlədir.
 * "Tam kəşf" = heç bir route/kolleksiya sorğusu uğursuz olmayıb və heç bir
 * kolleksiya `maxPages` tavanında kəsilməyib. Yalnız tam kəşfdən sonra kataloqdan
 * itən başlıqların sayğacı artırıla bilər.
 */
import { HBOMAX_CONFIG } from "@/lib/scrapers/hbomaxCollector/config";
import { HboCollectorError, isBrowserClosed } from "@/lib/scrapers/hbomaxCollector/errors";
import { FEATURE_SHOW_TYPES, SERIES_SHOW_TYPES, titlePageUrl } from "@/lib/scrapers/hbomaxCollector/parsers/jsonMetadata";
import { hboLog } from "@/lib/scrapers/hbomaxCollector/log";
import type { CmsClient } from "@/lib/scrapers/hbomaxCollector/catalog/cmsClient";
import {
  collectionRefsOf,
  HttpStatusError,
  routePathsOf,
  scanCollection,
  type CmsDoc,
  type CollectionRef,
  type CollectionScan,
} from "@/lib/scrapers/hbomaxCollector/catalog/railCrawler";

export const START_PATHS = ["/home", "/series", "/movies", "/categories", "/sports", "/audio-description"];
/** Şəxsi/axtarış səhifələri kataloq deyil. */
const SKIP_PATH = /^\/(my-stuff|search|profile|settings|account)/;
const HUB_PATH = /^\/(home|series|movies|categories|sports|audio-description|genre\/|channel\/|hub\/|collection\/|page\/|brand\/)/;
/** Hər şou tile-ı öz janr taxonomy linklərini daşıyır (yüzlərlə, çoxu 404) — `/genre/*`
 *  yalnız naviqasiya və /categories səhifəsindən izlənir. Brend hub-ları hər yerdən. */
const BRAND_PATH = /^\/(channel\/|hub\/|brand\/|collection\/|page\/)/;
const GENRE_SOURCES = new Set(["/categories"]);

export const isAzAlias = (alias: string) => /(^|-)a-z($|-)/i.test(alias);

export interface CrawlResult {
  routesVisited: string[];
  /** 404 — bu yolun səhifəsi yoxdur (taxonomy node). Xəta deyil. */
  routesWithoutPage: string[];
  failedRoutes: Array<{ path: string; error: string }>;
  scans: Map<string, CollectionScan>;
  /** Kolleksiyanın hansı route(lar)da tapıldığı. */
  routesByCollection: Map<string, Set<string>>;
  complete: boolean;
}

export async function crawlRails(cms: CmsClient, opts: { startPaths?: string[]; maxRoutes?: number } = {}): Promise<CrawlResult> {
  const maxRoutes = opts.maxRoutes ?? 150;
  const nav = await cms.get<CmsDoc>("/cms/collections/navigation-menu-web?include=default");
  const routeQueue = [...new Set([...(opts.startPaths ?? START_PATHS), ...routePathsOf(nav).filter((p) => HUB_PATH.test(p) && !SKIP_PATH.test(p))])];
  const visited = new Set<string>();
  const failedRoutes: CrawlResult["failedRoutes"] = [];
  const routesWithoutPage: string[] = [];
  const refById = new Map<string, { ref: CollectionRef; routes: Set<string> }>();

  while (routeQueue.length && visited.size < maxRoutes) {
    const p = routeQueue.shift()!;
    if (visited.has(p)) continue;
    visited.add(p);
    try {
      const doc = await cms.get<CmsDoc>(`/cms/routes${p}?include=default&page[items.size]=10`);
      for (const r of collectionRefsOf(doc)) {
        if (r.alias === "navigation-menu-web") continue;
        const entry = refById.get(r.id) ?? { ref: r, routes: new Set<string>() };
        entry.routes.add(p);
        refById.set(r.id, entry);
      }
      const follow = GENRE_SOURCES.has(p) ? HUB_PATH : BRAND_PATH;
      for (const r of routePathsOf(doc)) if (follow.test(r) && !SKIP_PATH.test(r) && !visited.has(r) && !routeQueue.includes(r)) routeQueue.push(r);
    } catch (err) {
      if (err instanceof HboCollectorError || isBrowserClosed(err)) throw err;
      if (err instanceof HttpStatusError && err.status === 404) {
        routesWithoutPage.push(p);
        continue;
      }
      failedRoutes.push({ path: p, error: err instanceof Error ? err.message.split("\n")[0] : String(err) });
      hboLog.warn(`Route ${p} failed: ${failedRoutes[failedRoutes.length - 1].error}`);
    }
  }
  hboLog.info(`Routes crawled: ${visited.size}`, { withoutPage: routesWithoutPage.length, failed: failedRoutes.length, leftInQueue: routeQueue.length });

  const scans = new Map<string, CollectionScan>();
  const pending = [...refById.keys()];
  while (pending.length) {
    const id = pending.shift()!;
    if (scans.has(id)) continue;
    const entry = refById.get(id)!;
    const scan = await scanCollection(cms, entry.ref);
    scans.set(id, scan);
    for (const n of scan.nested) {
      if (!refById.has(n.id)) refById.set(n.id, { ref: n, routes: new Set([...entry.routes].map((r) => `${r} › ${entry.ref.alias}`)) });
      if (!scans.has(n.id)) pending.push(n.id);
    }
    if (scans.size % 50 === 0) hboLog.info(`Collections scanned: ${scans.size}/${refById.size}`, { requests: cms.requestCount });
  }

  const complete =
    failedRoutes.length === 0 &&
    routeQueue.length === 0 &&
    [...scans.values()].every((s) => !s.error && !s.truncated);
  return {
    routesVisited: [...visited].filter((r) => !routesWithoutPage.includes(r)),
    routesWithoutPage,
    failedRoutes,
    scans,
    routesByCollection: new Map([...refById].map(([id, e]) => [id, e.routes])),
    complete,
  };
}

export type DiscoverySource = "az" | "all-rails";

export interface DiscoveredShowRef {
  providerId: string;
  name: string;
  providerUrl: string;
  showType: string;
}

/** Kataloqa düşən tiplər: seriallar + filmlər/standalone (spike 2026-10-22: SERIES 543,
 *  MINISERIES 67, TOPICAL 5, MOVIE 296, STANDALONE 75). Qalanları (podkast, "Coming Soon") atılır. */
export const CATALOG_SHOW_TYPES: ReadonlySet<string> = new Set([...SERIES_SHOW_TYPES, ...FEATURE_SHOW_TYPES]);

/**
 * Kəşf mənbəyinə görə tamlıq: `az` üçün yalnız A–Z kolleksiyaları və route-lar sayılır —
 * mənbə olmayan rail-in (məs. kəsilmiş idman "latest" rail-i) natamamlığı itən başlıq
 * sayğacını əbədi bloklamamalıdır.
 */
export function isSourceComplete(crawl: CrawlResult, source: DiscoverySource): boolean {
  if (crawl.failedRoutes.length) return false;
  const relevant = [...crawl.scans.values()].filter((s) => source !== "az" || isAzAlias(s.ref.alias));
  return relevant.length > 0 && relevant.every((s) => !s.error && !s.truncated);
}

/** Kəşf mənbəyinə görə şou siyahısı (spike nəticəsindən asılı seçim). */
export function showsFromCrawl(crawl: CrawlResult, source: DiscoverySource): DiscoveredShowRef[] {
  const out = new Map<string, DiscoveredShowRef>();
  for (const scan of crawl.scans.values()) {
    if (source === "az" && !isAzAlias(scan.ref.alias)) continue;
    for (const [id, s] of scan.shows) {
      if (!CATALOG_SHOW_TYPES.has(s.showType)) continue;
      const prev = out.get(id);
      if (!prev || (!prev.name && s.name)) {
        out.set(id, { providerId: id, name: s.name, showType: s.showType, providerUrl: titlePageUrl(id, s.showType, HBOMAX_CONFIG.homeUrl) });
      }
    }
  }
  return [...out.values()];
}
