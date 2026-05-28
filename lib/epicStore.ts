/**
 * Epic Games Store catalog client.
 *
 * Unlike the PS Store scraper (which parses `__NEXT_DATA__` out of HTML), Epic
 * exposes an official GraphQL catalog endpoint — `searchStoreQuery` — that
 * returns paginated JSON. We hit it twice per scrape run: once with
 * `country=TR` (→ TRY prices, our cost basis) and once with `country=AZ`
 * (→ USD prices, what an Azerbaijani buyer sees on Epic directly). Both prices
 * are stored on the shared Game row, keyed by `namespace:offerId`.
 *
 * Prices come back as integers in the currency's minor unit (kuruş / cents),
 * which already matches our `*Cents` column convention — no scaling needed.
 */

const ENDPOINT =
  process.env.EPIC_GRAPHQL_URL ?? "https://store.epicgames.com/graphql";

// Epic's catalog GraphQL sits behind a Cloudflare bot challenge that blocks
// plain server-side requests. When `FLARESOLVERR_URL` is set (a self-hosted
// FlareSolverr instance, e.g. http://localhost:8191/v1) we route the request
// through it: FlareSolverr drives a real browser that solves the challenge.
//
// FlareSolverr's `request.post` only sends form-urlencoded bodies, which a
// GraphQL endpoint won't parse — so we issue the query over GET (query +
// variables in the URL, allowed by the GraphQL-over-HTTP spec for queries) and
// extract the JSON from the browser-rendered page.
const FLARESOLVERR_URL = process.env.FLARESOLVERR_URL;
const FLARESOLVERR_TIMEOUT_MS = Number(process.env.FLARESOLVERR_TIMEOUT_MS) || 60000;

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Base games only — excludes editions/DLC/add-ons that pollute the catalog.
// (Epic categories: `games/edition/base`, `addons`, `digitalextras`, …)
export const EPIC_BASE_CATEGORY = "games/edition/base";

const SEARCH_STORE_QUERY = `
query searchStoreQuery(
  $category: String
  $count: Int
  $country: String!
  $keywords: String
  $locale: String
  $sortBy: String
  $sortDir: String
  $start: Int
  $withPrice: Boolean = false
) {
  Catalog {
    searchStore(
      category: $category
      count: $count
      country: $country
      keywords: $keywords
      locale: $locale
      sortBy: $sortBy
      sortDir: $sortDir
      start: $start
    ) {
      elements {
        title
        id
        namespace
        effectiveDate
        productSlug
        urlSlug
        keyImages {
          type
          url
        }
        tags {
          name
          groupName
        }
        price(country: $country) @include(if: $withPrice) {
          totalPrice {
            discountPrice
            originalPrice
            currencyCode
            currencyInfo {
              decimals
            }
          }
          lineOffers {
            appliedRules {
              endDate
            }
          }
        }
      }
      paging {
        count
        total
      }
    }
  }
}
`.trim();

/** A single offer's price in one currency, in minor units (cents/kuruş). */
export type EpicPrice = {
  originalCents: number;
  /** null when there's no active discount (discount >= original). */
  discountCents: number | null;
  currencyCode: string;
  /** When the active discount ends, if Epic exposes it. */
  discountEndAt: Date | null;
};

/** One catalog element, normalized. Price is for the requested country. */
export type EpicCatalogItem = {
  offerId: string;
  namespace: string;
  title: string;
  effectiveDate: string | null;
  imageUrl: string | null;
  heroImageUrl: string | null;
  productUrl: string | null;
  /** Genre tag names (groupName = "genre"), e.g. ["Action","RPG"]. */
  genres: string[];
  price: EpicPrice | null;
};

type RawKeyImage = { type?: string; url?: string };
type RawElement = {
  title?: string;
  id?: string;
  namespace?: string;
  effectiveDate?: string;
  productSlug?: string;
  urlSlug?: string;
  keyImages?: RawKeyImage[];
  tags?: Array<{ name?: string; groupName?: string }>;
  price?: {
    totalPrice?: {
      discountPrice?: number;
      originalPrice?: number;
      currencyCode?: string;
      currencyInfo?: { decimals?: number };
    };
    lineOffers?: Array<{ appliedRules?: Array<{ endDate?: string }> }>;
  };
};

function pickImage(images: RawKeyImage[], types: string[]): string | null {
  for (const t of types) {
    const hit = images.find((i) => i?.type === t && i?.url);
    if (hit?.url) return hit.url;
  }
  return null;
}

function buildProductUrl(el: RawElement): string | null {
  const slug = el.productSlug?.replace(/\/home$/, "") ?? el.urlSlug ?? null;
  if (!slug) return null;
  return `https://store.epicgames.com/en-US/p/${slug}`;
}

function normalizePrice(el: RawElement): EpicPrice | null {
  const tp = el.price?.totalPrice;
  if (!tp || typeof tp.originalPrice !== "number") return null;

  // Epic integers are in the currency's minor unit per `decimals`. For TRY/USD
  // decimals=2 → already kuruş/cents. If a currency ever reports a different
  // scale, normalize to 2-decimal cents so our columns stay consistent.
  const decimals = tp.currencyInfo?.decimals ?? 2;
  const toCents = (v: number) =>
    decimals === 2 ? Math.round(v) : Math.round((v / 10 ** decimals) * 100);

  const originalCents = toCents(tp.originalPrice);
  if (originalCents <= 0) return null;

  const discountRaw =
    typeof tp.discountPrice === "number" ? toCents(tp.discountPrice) : null;
  const discountCents =
    discountRaw != null && discountRaw < originalCents ? discountRaw : null;

  // Discount end date lives on the applied promotion rule.
  let discountEndAt: Date | null = null;
  if (discountCents != null) {
    for (const lo of el.price?.lineOffers ?? []) {
      for (const rule of lo?.appliedRules ?? []) {
        if (rule?.endDate) {
          const d = new Date(rule.endDate);
          if (!Number.isNaN(d.getTime())) {
            discountEndAt = d;
            break;
          }
        }
      }
      if (discountEndAt) break;
    }
  }

  return {
    originalCents,
    discountCents,
    currencyCode: tp.currencyCode ?? "",
    discountEndAt,
  };
}

function normalizeElement(el: RawElement): EpicCatalogItem | null {
  if (!el?.id || !el?.namespace || !el?.title) return null;
  const images = Array.isArray(el.keyImages) ? el.keyImages : [];
  const genres = Array.isArray(el.tags)
    ? Array.from(
        new Set(
          el.tags
            .filter((t) => t?.groupName === "genre" && t?.name)
            .map((t) => String(t.name).trim())
        )
      )
    : [];
  return {
    genres,
    offerId: String(el.id),
    namespace: String(el.namespace),
    title: String(el.title).trim(),
    effectiveDate: el.effectiveDate ?? null,
    imageUrl: pickImage(images, [
      "OfferImageTall",
      "Thumbnail",
      "DieselStoreFrontTall",
      "ProductLogo",
    ]),
    heroImageUrl: pickImage(images, [
      "OfferImageWide",
      "DieselStoreFrontWide",
      "featuredMedia",
    ]),
    productUrl: buildProductUrl(el),
    price: normalizePrice(el),
  };
}

export type EpicFetchResult = {
  items: EpicCatalogItem[];
  /** Total catalog size reported by Epic for this query (for pagination). */
  total: number;
  /** Items returned in this page (before normalization drops). */
  pageCount: number;
};

type SearchStoreResponse = {
  data?: {
    Catalog?: {
      searchStore?: {
        elements?: RawElement[];
        paging?: { count?: number; total?: number };
      };
    };
  };
  errors?: Array<{ message?: string }>;
};

/**
 * Extract the JSON payload from a FlareSolverr `solution.response`. For a JSON
 * endpoint the headless browser renders the body inside a `<pre>`, so we pull
 * that out and HTML-decode it before parsing. Falls back to parsing the whole
 * string when it's already raw JSON.
 */
function extractJsonFromBrowserHtml(html: string): SearchStoreResponse {
  const trimmed = html.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed) as SearchStoreResponse;

  const pre = trimmed.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
  const raw = pre ? pre[1] : trimmed;
  const decoded = raw
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
  return JSON.parse(decoded) as SearchStoreResponse;
}

/** Issue one searchStore query, transparently routing through FlareSolverr. */
async function searchStoreRequest(
  variables: Record<string, unknown>,
  signal?: AbortSignal
): Promise<SearchStoreResponse> {
  if (FLARESOLVERR_URL) {
    const target = new URL(ENDPOINT);
    target.searchParams.set("operationName", "searchStoreQuery");
    target.searchParams.set("query", SEARCH_STORE_QUERY);
    target.searchParams.set("variables", JSON.stringify(variables));

    const res = await fetch(FLARESOLVERR_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      signal,
      body: JSON.stringify({
        cmd: "request.get",
        url: target.toString(),
        maxTimeout: FLARESOLVERR_TIMEOUT_MS,
      }),
    });
    if (!res.ok) throw new Error(`FlareSolverr HTTP ${res.status}`);

    const fs = (await res.json()) as {
      status?: string;
      message?: string;
      solution?: { status?: number; response?: string };
    };
    if (fs.status !== "ok") {
      throw new Error(`FlareSolverr: ${fs.message ?? "challenge not solved"}`);
    }
    const httpStatus = fs.solution?.status ?? 0;
    if (httpStatus && httpStatus >= 400) {
      throw new Error(`Epic GraphQL ${httpStatus} (via FlareSolverr)`);
    }
    return extractJsonFromBrowserHtml(fs.solution?.response ?? "");
  }

  // Direct POST — works only where Epic isn't Cloudflare-gating the caller
  // (e.g. local testing, or EPIC_GRAPHQL_URL pointed at an unblocked proxy).
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
    cache: "no-store",
    signal,
    body: JSON.stringify({ query: SEARCH_STORE_QUERY, variables }),
  });
  if (!res.ok) throw new Error(`Epic GraphQL ${res.status}`);
  return (await res.json()) as SearchStoreResponse;
}

/**
 * Fetch one page of the Epic catalog for a given country/locale. Returns
 * normalized items plus paging info so the caller can walk `start` to the end.
 */
export async function fetchEpicCatalogPage(opts: {
  country: string;
  locale: string;
  start: number;
  count?: number;
  category?: string;
  signal?: AbortSignal;
}): Promise<EpicFetchResult> {
  const { country, locale, start } = opts;
  const count = opts.count ?? 40;
  const category = opts.category ?? EPIC_BASE_CATEGORY;

  const json = await searchStoreRequest(
    {
      category,
      count,
      country,
      locale,
      sortBy: "releaseDate",
      sortDir: "DESC",
      start,
      withPrice: true,
    },
    opts.signal
  );

  // Epic surfaces field-level resolution failures (e.g. optional mapping
  // sub-services 404ing) as `errors` even while returning usable `data`. Only
  // treat errors as fatal when no catalog data came back at all.
  const hasData = json.data?.Catalog?.searchStore != null;
  if (json.errors?.length && !hasData) {
    throw new Error(
      `Epic GraphQL error: ${json.errors.map((e) => e?.message).join("; ")}`
    );
  }

  const store = json.data?.Catalog?.searchStore;
  const elements = Array.isArray(store?.elements) ? store!.elements! : [];
  const items: EpicCatalogItem[] = [];
  for (const el of elements) {
    const n = normalizeElement(el);
    if (n) items.push(n);
  }

  return {
    items,
    total: store?.paging?.total ?? 0,
    pageCount: elements.length,
  };
}

/**
 * Walk the full Epic catalog for one country, paginating until exhausted or
 * `maxPages` is hit. `onPage` lets the caller stream progress.
 */
export async function fetchEpicCatalog(opts: {
  country: string;
  locale: string;
  count?: number;
  maxPages?: number;
  category?: string;
  onPage?: (info: {
    page: number;
    fetched: number;
    total: number;
  }) => void;
  signal?: AbortSignal;
}): Promise<EpicCatalogItem[]> {
  const count = opts.count ?? 40;
  const maxPages = opts.maxPages ?? 200;
  const out: EpicCatalogItem[] = [];
  let start = 0;

  for (let page = 1; page <= maxPages; page++) {
    const res = await fetchEpicCatalogPage({
      country: opts.country,
      locale: opts.locale,
      start,
      count,
      category: opts.category,
      signal: opts.signal,
    });
    out.push(...res.items);
    opts.onPage?.({ page, fetched: out.length, total: res.total });

    start += count;
    // Stop when Epic returns a short/empty page or we've walked past the total.
    if (res.pageCount < count) break;
    if (res.total > 0 && start >= res.total) break;
  }

  return out;
}

/** Stable composite id for the shared Game.productId column. */
export function epicProductId(namespace: string, offerId: string): string {
  return `epic:${namespace}:${offerId}`;
}
