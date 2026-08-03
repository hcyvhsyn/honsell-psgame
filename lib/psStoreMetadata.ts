/**
 * PS Store məhsul (detal) səhifəsindən SEO metadata çıxarışı.
 *
 * NƏ ÜÇÜN AYRICA MODUL:
 * Kateqoriya/axtarış listinq səhifələri (app/api/scrape-ps-store) yalnız ad,
 * qiymət, platforma və media qaytarır — təsvir, janr, nəşriyyatçı, çıxış tarixi
 * və reytinq YALNIZ məhsul detal səhifəsində var. Detal səhifəsini əsas scrape
 * axınına qoşmaq hər məhsul üçün +1 sorğu deməkdir (10k+ məhsulda saatlarla),
 * ona görə bu ayrıca, dayandırıla/davam etdirilə bilən job kimi işləyir
 * (scripts/enrichGameMetadata.ts).
 *
 * MƏNBƏ STRUKTURU:
 * Detal səhifəsi Next.js-dir və `__NEXT_DATA__` içində `pageProps.batarangs`
 * adlı mikro-frontend blokları saxlayır. Hər blok öz Apollo cache-ini ayrıca
 * `<script type="application/json">` kimi daşıyır:
 *   - `info`            → localizedGenres, publisherName, releaseDate
 *   - `publisher-legal` → publisherName, descriptions[SHORT|LONG|LEGAL]
 *   - `content-rating`  → PEGI
 *   - `star-rating`     → starRating.averageRating + totalRatingsCount
 * Bloklar bir-birini təkrarlayır, ona görə hamısını birləşdirib ilk dolu dəyəri
 * götürürük — biri dəyişsə/yox olsa da qalanları işləməyə davam edir.
 */

export type PsStoreMetadata = {
  descriptionShort: string | null;
  descriptionLong: string | null;
  publisherName: string | null;
  releaseDate: Date | null;
  genres: string[];
  contentRating: string | null;
  psRatingAvg: number | null;
  psRatingCount: number | null;
};

export const EMPTY_METADATA: PsStoreMetadata = {
  descriptionShort: null,
  descriptionLong: null,
  publisherName: null,
  releaseDate: null,
  genres: [],
  contentRating: null,
  psRatingAvg: null,
  psRatingCount: null,
};

/**
 * PS Store təsvirləri `<br/>` ilə formatlanır və HTML entity saxlayır.
 * Düz mətnə çeviririk: <br> → sətir sonu, qalan teqlər atılır, entity-lər açılır,
 * 3+ ardıcıl sətir sonu 2-yə yığılır.
 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Naməlum formalı JSON-dan təhlükəsiz sahə oxuma. */
export function prop(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object") return undefined;
  return (value as Record<string, unknown>)[key];
}

/** İç-içə sahə oxuma: `path(data, "props", "pageProps", "batarangs")`. */
function path(value: unknown, ...keys: string[]): unknown {
  let cur = value;
  for (const k of keys) cur = prop(cur, k);
  return cur;
}

/**
 * Bütün batarang bloklarındakı Apollo cache girişlərini BİR obyektə yığır
 * (açar → dəyər). Açarlar `Concept:`, `Product:`, `Sku:`, `GameCTA:` və
 * `ROOT_QUERY` prefiksləri ilə gəlir.
 *
 * Metadata parseri buradan yalnız `Product:` girişlərini götürür, qiymət/endirim
 * parseri (lib/psStoreOffer.ts) isə `GameCTA:` girişlərinə baxır. İkisi eyni
 * traversal-ı paylaşır ki, PS Store səhifə strukturunu dəyişdirəndə düzəliş
 * bir yerdə edilsin.
 */
export function collectBatarangCaches(html: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  const nextDataMatch = html.match(
    /id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
  );
  if (!nextDataMatch) return out;

  let nextData: unknown;
  try {
    nextData = JSON.parse(nextDataMatch[1]);
  } catch {
    return out;
  }

  const batarangs = path(nextData, "props", "pageProps", "batarangs");
  if (!batarangs || typeof batarangs !== "object") return out;

  for (const block of Object.values(batarangs as Record<string, unknown>)) {
    const text = prop(block, "text");
    if (typeof text !== "string") continue;

    // Hər blokun içindəki `<script id="env:…" type="application/json">{…}</script>`
    for (const m of text.matchAll(
      /<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/g
    )) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(m[1]);
      } catch {
        continue;
      }
      const cache = prop(parsed, "cache");
      if (!cache || typeof cache !== "object") continue;
      for (const [key, value] of Object.entries(cache as Record<string, unknown>)) {
        if (!value || typeof value !== "object") continue;
        const existing = out[key] as Record<string, unknown> | undefined;
        if (!existing) {
          out[key] = { ...(value as Record<string, unknown>) };
          continue;
        }
        // DİQQƏT — bloklar EYNİ açarı FƏRQLİ sahə dəstləri ilə daşıyır. Məsələn
        // `GameCTA:…:OUTRIGHT` açarı `cta` blokunda yalnız {id, type, action,
        // meta} kimi gəlir, qiymət (`price`) və CTA mətnləri (`local`) isə başqa
        // blokdadır. Ona görə "ilk açarı götür" YARAMIR — sahə-sahə birləşdirmək
        // lazımdır, əks halda parser qiyməti heç vaxt görməz.
        for (const [field, fieldValue] of Object.entries(
          value as Record<string, unknown>
        )) {
          const cur = existing[field];
          if (cur === undefined || cur === null || cur === "") {
            existing[field] = fieldValue;
          }
        }
      }
    }
  }
  return out;
}

/** Yalnız `Product:` cache girişləri — metadata sahələri buradadır. */
function collectProductCaches(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const [key, value] of Object.entries(collectBatarangCaches(html))) {
    if (key.startsWith("Product:")) out.push(value as Record<string, unknown>);
  }
  return out;
}

function firstString(caches: Record<string, unknown>[], field: string): string | null {
  for (const c of caches) {
    const v = c[field];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/**
 * Detal səhifəsinin HTML-indən metadata çıxarır.
 * Heç nə tapılmasa `EMPTY_METADATA` qaytarır — çağıran tərəf boş nəticəni
 * "uğursuz" saymamalı, sadəcə heç nə yazmamalıdır.
 */
export function parsePsStoreMetadata(html: string): PsStoreMetadata {
  const caches = collectProductCaches(html);
  if (caches.length === 0) return { ...EMPTY_METADATA };

  // ─── descriptions ───────────────────────────────────────────────────────────
  let descriptionShort: string | null = null;
  let descriptionLong: string | null = null;
  for (const c of caches) {
    const list = c.descriptions;
    if (!Array.isArray(list)) continue;
    for (const d of list) {
      const type = prop(d, "type");
      const value = prop(d, "value");
      if (typeof value !== "string" || !value.trim()) continue;
      // LEGAL bloku marketinq mətni deyil (geriyə uyğunluq xəbərdarlıqları) —
      // SEO üçün dəyərsizdir, ona görə götürmürük.
      if (type === "SHORT" && !descriptionShort) {
        descriptionShort = htmlToPlainText(value);
      } else if (type === "LONG" && !descriptionLong) {
        descriptionLong = htmlToPlainText(value);
      }
    }
  }

  // ─── genres ─────────────────────────────────────────────────────────────────
  const genres: string[] = [];
  for (const c of caches) {
    const list = c.localizedGenres;
    if (!Array.isArray(list)) continue;
    for (const g of list) {
      const v = prop(g, "value");
      if (typeof v === "string" && v.trim() && !genres.includes(v.trim())) {
        genres.push(v.trim());
      }
    }
  }

  // ─── releaseDate ────────────────────────────────────────────────────────────
  let releaseDate: Date | null = null;
  const rawDate = firstString(caches, "releaseDate");
  if (rawDate) {
    const d = new Date(rawDate);
    if (!Number.isNaN(d.getTime())) releaseDate = d;
  }

  // ─── contentRating (PEGI) ───────────────────────────────────────────────────
  let contentRating: string | null = null;
  for (const c of caches) {
    const cr = c.contentRating;
    if (cr && typeof cr === "object") {
      const desc = prop(cr, "description");
      if (typeof desc === "string" && desc.trim()) {
        contentRating = desc.trim();
        break;
      }
    }
  }

  // ─── starRating ─────────────────────────────────────────────────────────────
  let psRatingAvg: number | null = null;
  let psRatingCount: number | null = null;
  for (const c of caches) {
    const sr = c.starRating;
    if (!sr || typeof sr !== "object") continue;
    const avg = Number(prop(sr, "averageRating"));
    const count = Number(prop(sr, "totalRatingsCount"));
    // 0 reytinq = heç kim qiymətləndirməyib; JSON-LD-də göstərmək olmaz.
    if (Number.isFinite(avg) && avg > 0 && Number.isFinite(count) && count > 0) {
      psRatingAvg = Math.round(avg * 100) / 100;
      psRatingCount = Math.trunc(count);
      break;
    }
  }

  return {
    descriptionShort,
    descriptionLong,
    publisherName: firstString(caches, "publisherName"),
    releaseDate,
    genres,
    contentRating,
    psRatingAvg,
    psRatingCount,
  };
}

/** Metadata-da işə yarayan heç nə yoxdursa `true`. */
export function isMetadataEmpty(m: PsStoreMetadata): boolean {
  return (
    !m.descriptionShort &&
    !m.descriptionLong &&
    !m.publisherName &&
    !m.releaseDate &&
    m.genres.length === 0 &&
    !m.contentRating &&
    m.psRatingAvg == null
  );
}
