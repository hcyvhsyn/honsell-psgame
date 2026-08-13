/**
 * PS Store LİSTİNQ mənbəyi — kateqoriya hub-ları və axtarış.
 *
 * ─── NİYƏ HTML DEYİL, GraphQL ────────────────────────────────────────────────
 * 2026-08-a qədər listinq səhifələri (`/tr-tr/category/<uuid>/<n>`,
 * `/tr-tr/search/<q>`) məhsulları `__NEXT_DATA__` içində SSR edirdi və skreyper
 * həmin JSON-u oxuyurdu. Mağaza həmin ayda listinqləri **tam client-side**
 * yükləməyə keçdi: HTML hələ də gəlir (64KB), `__NEXT_DATA__` hələ də var, amma
 * içində yalnız naviqasiya var — `pageProps.batarangs` boş obyekt, `apolloState`
 * isə 8 naviqasiya sətri. Yəni skreyper 200 OK alır, parse uğurla keçir və
 * **0 məhsul** çıxır ("No products extracted" xətası buradan gəlirdi).
 *
 * ⚠️ Bu, User-Agent/başlıq məsələsi DEYİL — brauzer başlıqlarının tam dəsti ilə
 * də eyni boş cavab gəlir. Yenidən HTML-ə qayıtmağa çalışma.
 *
 * ⚠️ **MƏHSUL və CONCEPT səhifələri hələ də SSR-dir** — `/tr-tr/product/<sku>`
 * batarang-ları, `/tr-tr/concept/<id>` isə apolloState-i verməyə davam edir.
 * Ona görə [lib/psStoreOffer.ts](lib/psStoreOffer.ts) (endirim bitmə tarixi),
 * [lib/psStoreConcept.ts](lib/psStoreConcept.ts) (concept → SKU) və
 * [lib/psStoreMetadata.ts](lib/psStoreMetadata.ts) toxunulmamışdır. Yalnız
 * listinq qatı bu fayla köçdü.
 *
 * ─── PERSISTED QUERY (ƏN VACİB TƏLƏ) ────────────────────────────────────────
 * Endpoint yalnız **whitelist-də olan** sorğuları qəbul edir: sorğu mətnini
 * göndərmək olmur (`{"message":"Query not whitelisted"}` — 400), yalnız
 * `extensions.persistedQuery.sha256Hash`. Hash mağazanın öz JS bundle-ından
 * hesablanır (`sha256(print(sortAST(document)))`), yəni mağaza sorğunu bir
 * sahə də dəyişsə hash dəyişir və **bizim sorğular 400 verir**.
 *
 * Hash-i yenidən tapmaq (kod oxumaqla ÇIXMIR — hesablama apollo-nun sortAST +
 * print + __typename transformasiyasından asılıdır, əl ilə təkrarlamaq
 * uğursuz olur; həmin yolu sınayıb dalana dirənmişik):
 *
 *   1. `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
 *        --headless=new --user-data-dir=/tmp/psprof --log-net-log=/tmp/net.json \
 *        --net-log-capture-mode=IncludeSensitive --virtual-time-budget=20000 \
 *        --dump-dom "https://store.playstation.com/tr-tr/category/<uuid>/1" >/dev/null`
 *   2. `grep -o 'operationName=[A-Za-z]*[^"]*sha256Hash[^"]*' /tmp/net.json`
 *      → `categoryGridRetrieve` və `getSearchResults` sətirlərindəki hash.
 *
 * Deploy gözləməmək üçün hər ikisi env ilə override oluna bilir:
 * `PS_STORE_GQL_CATEGORY_HASH`, `PS_STORE_GQL_SEARCH_HASH`.
 */

import { psStoreProductUrl } from "@/lib/psStoreConcept";

const GQL_ENDPOINT = "https://web.np.playstation.com/api/graphql/v1/op";

/** Ölçülmüş limitlər: kateqoriya 1000-ə qədər qəbul edir, axtarış ~50-də dayanır. */
export const CATEGORY_PAGE_SIZE = 250;
export const SEARCH_PAGE_SIZE = 50;

const CATEGORY_QUERY_HASH =
  process.env.PS_STORE_GQL_CATEGORY_HASH ||
  "88c0b9a1273c6d320c51cd73e390924e21ae28bf09f01cde8b84b1034b16cd03";

const SEARCH_QUERY_HASH =
  process.env.PS_STORE_GQL_SEARCH_HASH ||
  "4df6284f982e57bec70f23c77e2c219dc792eb19af7fb3d3a81767aa3f1958aa";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

/**
 * `/tr-tr/category/<uuid>` və ya `/tr-tr/category/<uuid>/3` → uuid.
 *
 * Admin paneli və `?urls=` parametri hələ də TAM URL qəbul edir (linki mağazadan
 * kopyalayıb yapışdırmaq ən rahat yoldur), API isə yalnız id ilə işləyir.
 */
export function psStoreCategoryId(source: string): string | null {
  const trimmed = source.trim();
  if (!trimmed) return null;
  // Xam id də qəbul olunur.
  if (/^[0-9a-f-]{36}$/i.test(trimmed)) return trimmed;
  const m = trimmed.match(/\/category\/([0-9a-f-]{36})/i);
  return m ? m[1] : null;
}

export type PsStoreListingPage = {
  /** Xam GraphQL sətirləri (product və/və ya concept) — çağıran tərəf parse edir. */
  items: unknown[];
  /** Hub-dakı ümumi say — səhifələmənin sonunu bilmək üçün. */
  totalCount: number;
  isLast: boolean;
};

type GqlResult = { data?: unknown; errors?: Array<{ message?: string }> };

async function psStoreGraphql(
  operationName: string,
  variables: Record<string, unknown>,
  sha256Hash: string,
  timeoutMs: number
): Promise<GqlResult | null> {
  const url =
    `${GQL_ENDPOINT}?` +
    new URLSearchParams({
      operationName,
      variables: JSON.stringify(variables),
      extensions: JSON.stringify({
        persistedQuery: { version: 1, sha256Hash },
      }),
    });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        // Mağaza bölgəsi/dili YALNIZ bu başlıqdan gəlir — URL-də locale yoxdur.
        // Yazılmasa cavab başqa bölgənin qiymətləri ilə gələ bilər.
        "x-psn-store-locale-override": "tr-TR",
        "apollographql-client-name": "@sie-ppr-web-store/app",
        "user-agent": USER_AGENT,
      },
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!res.ok) {
      // 400 + "not whitelisted" = hash köhnəlib (yuxarıdakı bərpa reseptinə bax).
      const body = await res.text().catch(() => "");
      console.error(
        `psStoreListing: ${operationName} HTTP ${res.status} ${body.slice(0, 200)}`
      );
      return null;
    }
    return (await res.json()) as GqlResult;
  } catch (err) {
    console.error(`psStoreListing: ${operationName} failed`, err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function readRecord(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  return (value as Record<string, unknown>)[key];
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readPageInfo(node: unknown): { totalCount: number; isLast: boolean } {
  const info = readRecord(node, "pageInfo");
  const total = readRecord(info, "totalCount");
  const isLast = readRecord(info, "isLast");
  return {
    totalCount: typeof total === "number" ? total : 0,
    isLast: isLast === true,
  };
}

/**
 * Kateqoriya hub-ının bir səhifəsi.
 *
 * ⚠️ Hub-lar iki fərqli sətir tipi qaytarır və HANSINI qaytardıqları hub-dan
 * asılıdır: "AllDeals"/"ReadySetPlay" `products` (SKU), "All PS5 games"/
 * "NewGames" isə `concepts` (rəqəmli id). İkisi də qaytarılır — concept sətirləri
 * skreypin Phase 2.4-ündə SKU-ya çevrilir.
 */
export async function fetchCategoryPage(
  categoryId: string,
  opts: { offset: number; size?: number; timeoutMs?: number } = { offset: 0 }
): Promise<PsStoreListingPage | null> {
  const res = await psStoreGraphql(
    "categoryGridRetrieve",
    {
      id: categoryId,
      pageArgs: { size: opts.size ?? CATEGORY_PAGE_SIZE, offset: opts.offset },
      sortBy: null,
      filterBy: [],
      facetOptions: [],
    },
    CATEGORY_QUERY_HASH,
    opts.timeoutMs ?? 30_000
  );
  if (!res) return null;
  if (res.errors?.length) {
    console.error(
      "psStoreListing: categoryGridRetrieve errors",
      res.errors.map((e) => e.message).join("; ")
    );
    return null;
  }

  const grid = readRecord(readRecord(res, "data"), "categoryGridRetrieve");
  if (!grid) return null;

  const { totalCount, isLast } = readPageInfo(grid);
  return {
    items: [...asArray(readRecord(grid, "products")), ...asArray(readRecord(grid, "concepts"))],
    totalCount,
    isLast,
  };
}

/**
 * Axtarış nəticələri (seed sorğuları). Kateqoriya hub-larının qaçırdığı
 * SKU-ları — sürümlər, season pass, DLC — bura gətirir.
 */
export async function fetchSearchPage(
  term: string,
  opts: { offset?: number; size?: number; timeoutMs?: number } = {}
): Promise<PsStoreListingPage | null> {
  const res = await psStoreGraphql(
    "getSearchResults",
    {
      countryCode: "TR",
      languageCode: "tr",
      nextCursor: "",
      pageOffset: opts.offset ?? 0,
      pageSize: opts.size ?? SEARCH_PAGE_SIZE,
      searchTerm: term,
    },
    SEARCH_QUERY_HASH,
    opts.timeoutMs ?? 30_000
  );
  if (!res) return null;
  if (res.errors?.length) {
    console.error(
      "psStoreListing: getSearchResults errors",
      res.errors.map((e) => e.message).join("; ")
    );
    return null;
  }

  const search = readRecord(readRecord(res, "data"), "universalSearch");
  if (!search) return null;

  const { totalCount, isLast } = readPageInfo(search);
  return { items: asArray(readRecord(search, "results")), totalCount, isLast };
}

// ─── Sətir çıxarışı (listinq JSON → ScrapedGame) ─────────────────────────────

/**
 * Skreypin listinq fazasının çıxardığı sətir — `Game` upsert-inin girişi.
 */
export type ScrapedGame = {
  productId: string;
  title: string;
  imageUrl: string | null;
  productUrl: string | null;
  platform: string | null;
  productType: "GAME" | "ADDON" | "CURRENCY" | "OTHER";
  priceTryCents: number;
  discountTryCents: number | null;
  discountEndAt: Date | null;
  heroImageUrl: string | null;
  trailerUrl: string | null;
  screenshots: string[];
  editionLabel: string | null;
};

// PS Store's `storeDisplayClassification` has many values beyond the canonical
// FULL_GAME / ADD_ON_PACK pair. DLCs in particular surface as MAP, ITEM,
// CHARACTER, SEASON_PASS, COSTUME, COSMETIC, etc. — depending on what the DLC
// content actually is. Group them all under ADDON so they're treated uniformly.
const GAME_CLASSIFICATIONS = new Set([
  "FULL_GAME",
  "GAME_BUNDLE",
  "PREMIUM_EDITION",
]);

const ADDON_CLASSIFICATIONS = new Set([
  "ADD_ON_PACK",
  "MAP",
  "ITEM",
  "CHARACTER",
  "SEASON_PASS",
  "COSTUME",
  "COSMETIC",
  "CONSUMABLE",
  "LEVEL",
  "TRACK",
  "MUSIC_TRACK",
  "AVATAR",
]);

function classify(
  raw: unknown,
  topCategory?: unknown
): ScrapedGame["productType"] {
  // `topCategory` is the most reliable signal when present (only set on product
  // detail pages). Falls back to `storeDisplayClassification` from listings.
  if (typeof topCategory === "string") {
    if (topCategory === "GAME") return "GAME";
    if (topCategory === "ADD_ON") return "ADDON";
    if (topCategory === "VIRTUAL_CURRENCY") return "CURRENCY";
  }
  if (raw == null) return "GAME"; // concept rows with no classification → base game
  if (typeof raw === "string") {
    if (GAME_CLASSIFICATIONS.has(raw)) return "GAME";
    if (ADDON_CLASSIFICATIONS.has(raw)) return "ADDON";
    if (raw === "VIRTUAL_CURRENCY") return "CURRENCY";
  }
  return "OTHER";
}

function parseTryToCents(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/[^\d,]/g, "").replace(/\./g, "").replace(",", ".");
  if (!cleaned) return null;
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num * 100);
}

export function resolvePlatform(productId: string, platforms: unknown): string | null {
  if (Array.isArray(platforms) && platforms.length > 0) {
    const valid = platforms
      .map((p) => String(p))
      .filter((p): p is "PS4" | "PS5" => p === "PS4" || p === "PS5");
    if (valid.length > 0) {
      const ordered = (["PS5", "PS4"] as const).filter((p) => valid.includes(p));
      return ordered.join(",");
    }
  }
  if (productId.includes("PPSA")) return "PS5";
  if (productId.includes("CUSA")) return "PS4";
  return null;
}

type RawProduct = {
  id: string;
  name: string;
  price?: { basePrice?: unknown; discountedPrice?: unknown };
  media?: Array<{ role?: string; type?: string; url?: string }>;
  platforms?: unknown;
  storeDisplayClassification?: unknown;
  localizedStoreDisplayClassification?: unknown;
  topCategory?: unknown;
  [key: string]: unknown;
};

function* walkProducts(node: unknown): Generator<RawProduct> {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) yield* walkProducts(item);
    return;
  }
  const obj = node as Record<string, unknown>;
  if (
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    obj.price &&
    typeof obj.price === "object"
  ) {
    yield obj as RawProduct;
  }
  for (const key of Object.keys(obj)) yield* walkProducts(obj[key]);
}

/**
 * Listinq cavabındakı xam sətirləri `ScrapedGame`-ə çevirir.
 *
 * Giriş HTML deyil, GraphQL JSON-udur ([lib/psStoreListing.ts](lib/psStoreListing.ts)) —
 * `walkProducts` isə istənilən JSON ağacında gəzdiyi üçün dəyişmədi.
 */
export function extractListingItems(data: unknown): ScrapedGame[] {
  const seen = new Set<string>();
  const out: ScrapedGame[] = [];

  for (const product of walkProducts(data)) {
    if (seen.has(product.id)) continue;

    const basePrice = parseTryToCents(product.price?.basePrice);
    const discountPrice = parseTryToCents(product.price?.discountedPrice);
    if (basePrice == null) continue;

    const discountTryCents =
      discountPrice != null && discountPrice < basePrice ? discountPrice : null;

    const media = Array.isArray(product.media) ? product.media : [];
    const findMedia = (role: string, type?: string) =>
      media.find((m) => m?.role === role && (!type || m?.type === type))?.url;

    const imageUrl =
      findMedia("MASTER", "IMAGE") ??
      findMedia("MASTER") ??
      media[0]?.url ??
      null;
    const heroImageUrl =
      findMedia("BACKGROUND", "IMAGE") ??
      findMedia("BACKGROUND") ??
      null;
    const trailerUrl = findMedia("PREVIEW", "VIDEO") ?? findMedia("PREVIEW") ?? null;

    // Collect supplemental screenshots: any IMAGE-role media that isn't the hero
    // or the master cover, deduped.
    const usedUrls = new Set([imageUrl, heroImageUrl].filter(Boolean) as string[]);
    const screenshots: string[] = [];
    for (const m of media) {
      if (!m?.url || m.type !== "IMAGE") continue;
      if (usedUrls.has(m.url)) continue;
      usedUrls.add(m.url);
      screenshots.push(String(m.url));
    }

    const editionLabel =
      typeof product.localizedStoreDisplayClassification === "string"
        ? product.localizedStoreDisplayClassification
        : null;

    const productId = String(product.id);
    seen.add(productId);
    out.push({
      productId,
      title: String(product.name).trim(),
      imageUrl: imageUrl ? String(imageUrl) : null,
      // ⚠️ `/product/<id>` rəqəmli concept id-si üçün 302 ilə ana səhifəyə atır.
      // Concept sətri Phase 2.4-də SKU-ya çevrilir, amma çevrilmə uğursuz olsa
      // sətir belə qalır — o halda heç olmasa işlək `/concept/` linki qalsın.
      productUrl: psStoreProductUrl(productId),
      platform: resolvePlatform(productId, product.platforms),
      productType: classify(product.storeDisplayClassification, product.topCategory),
      priceTryCents: basePrice,
      discountTryCents,
      discountEndAt: null,
      heroImageUrl: heroImageUrl ? String(heroImageUrl) : null,
      trailerUrl: trailerUrl ? String(trailerUrl) : null,
      screenshots,
      editionLabel,
    });
  }

  return out;
}
