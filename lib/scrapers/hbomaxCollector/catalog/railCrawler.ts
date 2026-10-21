/**
 * CMS səhifə/kolleksiya gəzintisi — kataloq kəşfinin əsası.
 *
 * Struktur (real AZ cavabları, 2026-10):
 * - `GET /cms/routes/<path>?include=default` → səhifə; `included[type=collection]`
 *   rail-lərdir (çoxu lazy: `relationships.items` boş gəlir).
 * - `GET /cms/collections/<id>?include=default&page[items.number]=N&page[items.size]=30`
 *   → `meta.itemsTotalPages`; server səhifə ölçüsünü 30-la məhdudlaşdırır.
 * - `collectionItem.relationships`: `show` | `video` | `collection` (tab qrupları —
 *   iç-içə kolleksiya) | `link`.
 * - `component.mandatoryParams` (məs. `pf[show.id]=…`) kolleksiya sorğusuna əlavə olunur.
 */
import { HttpStatusError, type CmsClient } from "@/lib/scrapers/hbomaxCollector/catalog/cmsClient";
import { HboCollectorError } from "@/lib/scrapers/hbomaxCollector/errors";

type Obj = Record<string, unknown>;
export interface CmsEntity {
  id: string;
  type: string;
  attributes?: Obj;
  relationships?: Record<string, { data?: unknown }>;
}
export interface CmsDoc {
  data?: CmsEntity;
  included?: CmsEntity[];
  meta?: Obj;
}

const PAGE_SIZE = 30;

function refs(e: CmsEntity, rel: string): Array<{ id: string; type: string }> {
  const d = e.relationships?.[rel]?.data;
  const list = Array.isArray(d) ? d : d ? [d] : [];
  return list.filter((x): x is { id: string; type: string } => !!x && typeof x === "object" && "id" in x && "type" in x);
}

export interface CollectionRef {
  id: string;
  alias: string;
  mandatoryParams?: string;
}

export function collectionRefsOf(doc: CmsDoc): CollectionRef[] {
  return (doc.included ?? [])
    .filter((e) => e.type === "collection")
    .map((c) => ({
      id: c.id,
      alias: String(c.attributes?.alias ?? c.attributes?.name ?? c.id),
      mandatoryParams: (c.attributes?.component as Obj | undefined)?.mandatoryParams as string | undefined,
    }));
}

/** Səhifədəki link/route entity-lərindən daxili hub yolları (`/genre/x`, `/channel/…`). */
export function routePathsOf(doc: CmsDoc): string[] {
  const out = new Set<string>();
  for (const e of doc.included ?? []) {
    const url = e.attributes?.url ?? e.attributes?.href;
    if ((e.type === "route" || e.type === "link") && typeof url === "string" && url.startsWith("/")) out.add(url.split("?")[0]);
  }
  return [...out];
}

export { HttpStatusError };

export interface CollectionScan {
  ref: CollectionRef;
  /** show.id → ad. `via` = birbaşa show tile-ı və ya epizod tile-ının şousu.
   *  `showType` = `show.attributes.showType` (SERIES, MOVIE, …) — A–Z-də filmlər də var. */
  shows: Map<string, { name: string; via: "show" | "video"; showType: string }>;
  nested: CollectionRef[];
  pages: number;
  totalItems?: number;
  truncated: boolean;
  error?: string;
}

/** Kolleksiyanın BÜTÜN səhifələrini gəzir (maxPages tavanı ilə). */
export async function scanCollection(cms: CmsClient, ref: CollectionRef, maxPages = 40): Promise<CollectionScan> {
  const scan: CollectionScan = { ref, shows: new Map(), nested: [], pages: 0, truncated: false };
  const extra = ref.mandatoryParams ? `&${ref.mandatoryParams}` : "";
  for (let page = 1; page <= maxPages; page++) {
    let doc: CmsDoc;
    try {
      doc = await cms.get<CmsDoc>(`/cms/collections/${ref.id}?include=default&page[items.number]=${page}&page[items.size]=${PAGE_SIZE}${extra}`);
    } catch (err) {
      // Sessiya/şəbəkə ölümcül xətaları kəşfi dayandırır — kolleksiya-kolleksiya "uğursuz" yazılmır.
      if (err instanceof HboCollectorError) throw err;
      scan.error = err instanceof Error ? err.message.split("\n")[0] : String(err);
      break;
    }
    scan.pages = page;
    const inc = doc.included ?? [];
    const byKey = new Map(inc.map((e) => [`${e.type}:${e.id}`, e]));
    const showName = (id: string) => String(byKey.get(`show:${id}`)?.attributes?.name ?? "");
    const showType = (id: string) => String(byKey.get(`show:${id}`)?.attributes?.showType ?? "UNKNOWN");
    for (const item of inc.filter((e) => e.type === "collectionItem")) {
      for (const s of refs(item, "show")) scan.shows.set(s.id, { name: showName(s.id), via: "show", showType: showType(s.id) });
      for (const v of refs(item, "video")) {
        const video = byKey.get(`video:${v.id}`);
        for (const s of video ? refs(video, "show") : []) if (!scan.shows.has(s.id)) scan.shows.set(s.id, { name: showName(s.id), via: "video", showType: showType(s.id) });
      }
      for (const c of refs(item, "collection")) {
        const ce = byKey.get(`collection:${c.id}`);
        scan.nested.push({
          id: c.id,
          alias: String(ce?.attributes?.alias ?? c.id),
          mandatoryParams: (ce?.attributes?.component as Obj | undefined)?.mandatoryParams as string | undefined,
        });
      }
    }
    const meta = doc.meta ?? {};
    scan.totalItems = typeof meta.itemsTotalResults === "number" ? meta.itemsTotalResults : scan.totalItems;
    const totalPages = typeof meta.itemsTotalPages === "number" ? meta.itemsTotalPages : 1;
    if (page >= totalPages) return scan;
    if (page === maxPages) scan.truncated = true;
  }
  return scan;
}
