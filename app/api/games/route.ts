import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  aznToTryCents,
  computeDisplayPrice,
  computeEpicDisplayPrice,
  getSettings,
} from "@/lib/pricing";
import type { Game, Prisma } from "@/lib/generated/prisma/client";
import { Prisma as PrismaSql } from "@/lib/generated/prisma/client";
import { fetchPopularGames } from "@/lib/popularity";
import {
  buildGameBaseWhereSql,
  buildMetadataWhereClauses,
  buildPriceFilter,
} from "@/lib/gameQuery";
import { buildGameCard } from "@/lib/gameCardMapper";
import { buildGameSearchTerms } from "@/lib/gameSearchTerms";
import {
  gameSearchFromSql,
  gameSearchMatchSql,
  gameSearchRelevanceSql,
} from "@/lib/gameSearchSql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Sort =
  | "newest"
  | "priceAsc"
  | "priceDesc"
  | "discount"
  | "discountAsc"
  | "alpha"
  | "popular"
  // PS Store metadata-sına söykənən sıralamalar. Metadata olmayan sətirlər
  // sona düşür (NULLS LAST) — kataloqdan çıxarılmır.
  | "rating"
  | "releaseNew"
  | "releaseOld";

const SORTS = new Set<Sort>([
  "newest",
  "priceAsc",
  "priceDesc",
  "discount",
  "discountAsc",
  "alpha",
  "popular",
  "rating",
  "releaseNew",
  "releaseOld",
]);

const PRODUCT_TYPES = new Set(["ALL", "GAME", "ADDON", "CURRENCY", "OTHER"]);

/**
 * PS Store detal metadata filtrləri. Sorğu yollarının hər üçündən (Prisma
 * `where`, populyarlıq SQL-i, fuzzy SQL-i) eyni obyekt keçir ki, filtr yalnız
 * bir yolda işləyib digərində itməsin.
 */
type MetadataFilters = {
  contentRatings: string[] | null;
  minPsRating: number | null;
  publisher: string | null;
  releaseYearMin: number | null;
  releaseYearMax: number | null;
};

/**
 * Unified games listing.
 *   q             search query (min 2 chars; otherwise ignored)
 *   sort          newest | priceAsc | priceDesc | discount | discountAsc | alpha
 *   type          ALL | GAME | ADDON | CURRENCY | OTHER  (default: ALL)
 *   platform      PS4 | PS5
 *   onSale        "1" → only items with an active discount
 *   genre         comma-separated PS Store genre names ("Aksiyon,Nişancı")
 *   rating        comma-separated PEGI labels ("PEGI 18,PEGI 16")
 *   minRating     PS Store user score lower bound (e.g. 4 → 4.0+)
 *   publisher     exact publisher name
 *   yearMin/Max   release-year range
 *   limit         default 100, max 200
 *   offset        for pagination
 *
 * The metadata params above come from the PS Store *detail* page
 * (scripts/enrichGameMetadata.ts). Rows the enricher hasn't reached yet have
 * NULLs and are excluded by those filters — see lib/gameQuery.ts. Option lists
 * for the UI are served by /api/games/facets.
 *
 * Returns:
 *   { total, totalAll, totalOnSale, totals: {GAME, ADDON, CURRENCY, OTHER},
 *     count, results, page, pageSize, totalPages }
 *
 *   - `total`         filtered count (matches the result set)
 *   - `totalAll`      total in the active type, without other filters
 *   - `totalOnSale`   on-sale items in the active type
 *   - `totals`        per-type counts (for the pill switcher)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const qRaw = (url.searchParams.get("q") ?? "").trim();
  const q = qRaw.length >= 2 ? qRaw : "";

  const sortParam = (url.searchParams.get("sort") ?? "newest") as Sort;
  const sort: Sort = SORTS.has(sortParam) ? sortParam : "newest";

  const typeParam = url.searchParams.get("type") ?? "ALL";
  const productType = PRODUCT_TYPES.has(typeParam) ? typeParam : "ALL";
  // When type=ALL we skip the productType filter entirely. The pill switcher
  // then renders a mixed catalog with games, DLCs, currency, and other SKUs.
  const filterByType = productType !== "ALL";

  const platform = url.searchParams.get("platform"); // PS4 | PS5 | null
  const onSale = url.searchParams.get("onSale") === "1";

  // Storefront scope. Defaults to "PS" so existing /oyunlar callers (which
  // don't pass it) keep seeing only PlayStation rows. /epic-games passes EPIC.
  const storeParam = url.searchParams.get("store");
  const store = storeParam === "EPIC" ? "EPIC" : "PS";

  // Epic-only genre/category filter (e.g. "Action", "RPG").
  // Vergüllə ayrılmış janr siyahısı ("Aksiyon,Nişancı") — facet səhifələri bir
  // neçə DB janrını tək landing altında birləşdirir. Tək dəyər də keçərlidir.
  const genres = (url.searchParams.get("genre") ?? "")
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean);
  // Seriya (franchise) landing səhifələri üçün başlıq alt-sətri —
  // "FIFA", "Call of Duty". `q`-dan fərqlidir: `q` semantik axtarış
  // endpoint-inə keçid edir, bu isə sırf filtrdir və sıralamanı dəyişmir.
  const franchise = (url.searchParams.get("franchise") ?? "").trim();

  // ─── PS Store detal metadata filtrləri ────────────────────────────────────
  // Seçimlərin siyahısı `/api/games/facets`-dən gəlir (DB-də real mövcud
  // dəyərlər), ona görə burada sərt whitelist saxlamırıq — dəyər tapılmasa
  // sadəcə 0 nəticə qayıdır.
  const contentRatings = (url.searchParams.get("rating") ?? "")
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
  const minRatingRaw = Number(url.searchParams.get("minRating"));
  const minPsRating =
    Number.isFinite(minRatingRaw) && minRatingRaw > 0 && minRatingRaw <= 5
      ? minRatingRaw
      : null;
  const publisher = (url.searchParams.get("publisher") ?? "").trim() || null;
  const yearMinRaw = Number(url.searchParams.get("yearMin"));
  const yearMaxRaw = Number(url.searchParams.get("yearMax"));
  const isYear = (n: number) => Number.isInteger(n) && n >= 1990 && n <= 2100;
  const releaseYearMin = isYear(yearMinRaw) ? yearMinRaw : null;
  const releaseYearMax = isYear(yearMaxRaw) ? yearMaxRaw : null;

  const metadataFilters = {
    contentRatings: contentRatings.length > 0 ? contentRatings : null,
    minPsRating,
    publisher,
    releaseYearMin,
    releaseYearMax,
  };

  const priceMinRaw = Number(url.searchParams.get("priceMin"));
  const priceMaxRaw = Number(url.searchParams.get("priceMax"));
  const priceMinAzn = Number.isFinite(priceMinRaw) && priceMinRaw > 0 ? priceMinRaw : null;
  const priceMaxAzn = Number.isFinite(priceMaxRaw) && priceMaxRaw > 0 ? priceMaxRaw : null;

  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit")) || 100));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  const page = Math.max(1, Math.floor(offset / limit) + 1);

  const where: Prisma.GameWhereInput = { isActive: true, store };
  if (filterByType) where.productType = productType;
  if (q) where.title = { contains: q, mode: "insensitive" };
  if (platform === "PS4" || platform === "PS5") {
    // The platform column stores either a single value ("PS5"), a
    // comma-separated list for cross-gen titles ("PS5,PS4"), or NULL for
    // PS Store concept entries spanning editions. `contains` covers all
    // three cases for the chosen platform.
    where.OR = [
      { platform: { contains: platform } },
      { platform: null },
    ];
  }
  if (onSale) where.discountTryCents = { not: null };
  // Janr filtri əvvəl yalnız Epic üçün açıq idi, çünki PS sətirlərində
  // `genres` boş olurdu. İndi scripts/enrichGameMetadata.ts PS janrlarını da
  // doldurur, ona görə qapı hər iki storefront üçün açıqdır.
  if (genres.length === 1) where.genres = { has: genres[0] };
  else if (genres.length > 1) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      { genres: { hasSome: genres } },
    ];
  }
  if (franchise) {
    // `q` ilə eyni sütuna yazmır: `q` verilibsə fuzzy yolu onsuz da başlığı
    // filtrləyir, franchise isə ondan asılı olmadan AND kimi əlavə olunur.
    const franchiseClause = { title: { contains: franchise, mode: "insensitive" as const } };
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      franchiseClause,
    ];
  }
  const metadataClauses = buildMetadataWhereClauses(metadataFilters);
  if (metadataClauses.length > 0) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      ...metadataClauses,
    ];
  }
  // Qeyd: "popular" sort artıq bütün kataloq üzərində işləyir (məhsul real
  // istifadəçi davranışına görə sıralanır — bax: lib/popularity.ts). Featured
  // flag-i hələ də skor formulundan yumşaq boost kimi keçir.

  const useFuzzy = q.length >= 2;

  const [typeAllCount, typeOnSaleCount, totalsArr, settings] = await Promise.all([
    prisma.game.count({
      where: filterByType
        ? { isActive: true, store, productType }
        : { isActive: true, store },
    }),
    prisma.game.count({
      where: filterByType
        ? { isActive: true, store, productType, discountTryCents: { not: null } }
        : { isActive: true, store, discountTryCents: { not: null } },
    }),
    prisma.game.groupBy({
      by: ["productType"],
      where: { isActive: true, store },
      _count: { _all: true },
    }),
    getSettings(),
  ]);

  // Translate the AZN price-range UI inputs into TRY-cent thresholds the DB
  // can compare directly. We use floor for the lower bound and ceil for the
  // upper bound so the boundary stays inclusive at AZN-cent granularity.
  const priceMinTryCents =
    priceMinAzn != null ? aznToTryCents(priceMinAzn, settings, "ceil") : null;
  const priceMaxTryCents =
    priceMaxAzn != null ? aznToTryCents(priceMaxAzn, settings, "floor") : null;
  const priceFilter = buildPriceFilter(priceMinTryCents, priceMaxTryCents);
  if (priceFilter) {
    where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), priceFilter];
  }

  let filteredCount: number;
  let rows: Game[];
  if (useFuzzy) {
    ({ filteredCount, rows } = await fetchFuzzy({
      q,
      sort,
      store,
      genres: genres.length > 0 ? genres : null,
      franchise: franchise || null,
      productType: filterByType ? productType : null,
      platform,
      onSale,
      limit,
      offset,
      priceMinTryCents,
      priceMaxTryCents,
      ...metadataFilters,
    }));
  } else if (sort === "popular") {
    // Populyarlıq sıralaması — bütün aktiv kataloq üzrə, real davranış
    // siqnallarına görə skorlanır. `where` ilə eyni filterləri SQL fraqment
    // kimi qururuq (q yoxdur — bu branch yalnız non-fuzzy halda).
    const whereSql = buildGameBaseWhereSql({
      store,
      productType: filterByType ? productType : null,
      platform,
      onSale,
      genres: genres.length > 0 ? genres : null,
      titleContains: franchise || null,
      priceMinTryCents,
      priceMaxTryCents,
      ...metadataFilters,
    });
    [filteredCount, rows] = await Promise.all([
      prisma.game.count({ where }),
      fetchPopularGames(whereSql, limit, offset),
    ]);
  } else {
    filteredCount = await prisma.game.count({ where });
    rows = await fetchSorted(where, sort, limit, offset);
  }

  const totals: Record<string, number> = {
    GAME: 0,
    ADDON: 0,
    CURRENCY: 0,
    OTHER: 0,
  };
  for (const row of totalsArr) totals[row.productType] = row._count._all;

  const results = rows.map((g) => {
    const isEpic = g.store === "EPIC";
    const price = isEpic
      ? computeEpicDisplayPrice(g, settings)
      : computeDisplayPrice(g, settings);
    return buildGameCard(g, price, {
      // Epic rows have no detail page yet, so don't surface a productId the
      // card would turn into a /oyunlar/[productId] link.
      // Epic's struck-through price is the AZ reference (structural saving), not
      // a timed sale → no countdown for Epic rows either.
      suppressLinks: isEpic,
      suppressDiscountEnd: isEpic,
    });
  });

  return NextResponse.json({
    total: filteredCount,
    totalAll: typeAllCount,
    totalOnSale: typeOnSaleCount,
    totals,
    count: results.length,
    results,
    page,
    pageSize: limit,
    totalPages: Math.max(1, Math.ceil(filteredCount / limit)),
  });
}

async function fetchSorted(
  where: Prisma.GameWhereInput,
  sort: Sort,
  take: number,
  skip: number
) {
  switch (sort) {
    case "newest":
      return prisma.game.findMany({
        where,
        orderBy: [{ lastScrapedAt: "desc" }, { id: "asc" }],
        take,
        skip,
      });
    case "alpha":
      return prisma.game.findMany({
        where,
        orderBy: [{ title: "asc" }],
        take,
        skip,
      });
    case "priceAsc":
      return prisma.game.findMany({
        where,
        orderBy: [
          { discountTryCents: { sort: "asc", nulls: "last" } },
          { priceTryCents: "asc" },
        ],
        take,
        skip,
      });
    case "priceDesc":
      return prisma.game.findMany({
        where,
        orderBy: [
          { discountTryCents: { sort: "desc", nulls: "last" } },
          { priceTryCents: "desc" },
        ],
        take,
        skip,
      });
    case "popular":
      return prisma.game.findMany({
        where,
        orderBy: [{ lastScrapedAt: "desc" }, { title: "asc" }],
        take,
        skip,
      });
    case "rating":
      // Metadata-sı olmayan sətirlər NULLS LAST ilə sona düşür — kataloqdan
      // çıxarılmır, sadəcə reytinqi bilinənlərdən sonra gəlir. İkinci açar səs
      // sayıdır: 4.8 (12 səs) ilə 4.8 (80K səs) eyni deyil.
      return prisma.game.findMany({
        where,
        orderBy: [
          { psRatingAvg: { sort: "desc", nulls: "last" } },
          { psRatingCount: { sort: "desc", nulls: "last" } },
          { title: "asc" },
        ],
        take,
        skip,
      });
    case "releaseNew":
      return prisma.game.findMany({
        where,
        orderBy: [{ releaseDate: { sort: "desc", nulls: "last" } }, { title: "asc" }],
        take,
        skip,
      });
    case "releaseOld":
      return prisma.game.findMany({
        where,
        orderBy: [{ releaseDate: { sort: "asc", nulls: "last" } }, { title: "asc" }],
        take,
        skip,
      });
    case "discount":
    case "discountAsc": {
      const all = await prisma.game.findMany({
        where: { ...where, discountTryCents: { not: null } },
      });
      all.sort((a, b) => {
        const pa = (a.priceTryCents - (a.discountTryCents ?? a.priceTryCents)) / a.priceTryCents;
        const pb = (b.priceTryCents - (b.discountTryCents ?? b.priceTryCents)) / b.priceTryCents;
        return sort === "discountAsc" ? pa - pb : pb - pa;
      });
      return all.slice(skip, skip + take);
    }
  }
}

async function fetchFuzzy({
  q,
  sort,
  store,
  genres,
  franchise,
  productType,
  platform,
  onSale,
  limit,
  offset,
  priceMinTryCents,
  priceMaxTryCents,
  ...metadata
}: {
  q: string;
  sort: Sort;
  store: string;
  /** Janr filtri (PS və Epic) — bir neçə dəyərdən hər hansı biri, or null. */
  genres: string[] | null;
  /** Seriya səhifələri üçün başlıq alt-sətri, or null. */
  franchise: string | null;
  /** null when type=ALL (no productType filter applied) */
  productType: string | null;
  platform: string | null;
  onSale: boolean;
  limit: number;
  offset: number;
  priceMinTryCents: number | null;
  priceMaxTryCents: number | null;
} & MetadataFilters): Promise<{ filteredCount: number; rows: Game[] }> {
  // Prefer typo-tolerant fuzzy search on Postgres when available (pg_trgm).
  // If the extension is not enabled (or the DB blocks it), fall back to
  // the original `contains` behavior so search still works.
  try {
    const whereSql = buildGameWhereSql({
      q,
      store,
      genres,
      titleContains: franchise,
      productType,
      platform,
      onSale,
      priceMinTryCents,
      priceMaxTryCents,
      ...metadata,
    });
    // Axtarış həm fuzzy həm AI semantic ilə işləyir; relevance bütün kataloqu
    // əhatə edir. Popular filter-i artıq tətbiq olunmur (popular bütün
    // kataloqda işləyir).

    if (sort === "discount" || sort === "discountAsc") {
      // This sort is computed (requires discount), so we fetch all matching and
      // sort in JS (same approach as the non-fuzzy codepath).
      const discountWhere = PrismaSql.sql`${whereSql} AND g."discountTryCents" IS NOT NULL`;
      const all = (await prisma.$queryRaw(
        PrismaSql.sql`SELECT g.* FROM ${gameSearchFromSql()} WHERE ${discountWhere}`
      )) as Game[];

      const filteredCount =
        all.length; /* best-effort; avoids an extra count query in this branch */

      all.sort((a, b) => {
        const pa = (a.priceTryCents - (a.discountTryCents ?? a.priceTryCents)) / a.priceTryCents;
        const pb = (b.priceTryCents - (b.discountTryCents ?? b.priceTryCents)) / b.priceTryCents;
        return sort === "discountAsc" ? pa - pb : pb - pa;
      });
      return { filteredCount, rows: all.slice(offset, offset + limit) };
    }

    const countRow = (await prisma.$queryRaw(
      PrismaSql.sql`SELECT COUNT(*)::int AS count FROM ${gameSearchFromSql()} WHERE ${whereSql}`
    )) as Array<{ count: number }>;

    const orderSql = buildFuzzyOrderSql(sort, q);
    const rows = (await prisma.$queryRaw(
      PrismaSql.sql`SELECT g.* FROM ${gameSearchFromSql()} WHERE ${whereSql} ORDER BY ${orderSql} LIMIT ${limit} OFFSET ${offset}`
    )) as Game[];

    return { filteredCount: countRow?.[0]?.count ?? 0, rows };
  } catch {
    // Fallback: simple substring match (existing behavior).
    const where: Prisma.GameWhereInput = { isActive: true, store };
    if (genres && genres.length > 0) where.genres = { hasSome: genres };
    if (productType) where.productType = productType;
    where.title = { contains: q, mode: "insensitive" };
    if (platform === "PS4" || platform === "PS5") {
      where.OR = [{ platform: { contains: platform } }, { platform: null }];
    }
    if (onSale) where.discountTryCents = { not: null };
    const and = buildMetadataWhereClauses(metadata);
    const priceFilter = buildPriceFilter(priceMinTryCents, priceMaxTryCents);
    if (priceFilter) and.unshift(priceFilter);
    if (and.length > 0) where.AND = and;

    const [filteredCount, rows] = await Promise.all([
      prisma.game.count({ where }),
      fetchSorted(where, sort, limit, offset),
    ]);
    return { filteredCount, rows };
  }
}

/**
 * Fuzzy axtarış üçün SQL fraqmenti: baza filterlər (lib/gameQuery.ts) +
 * başlıq üzrə oxşarlıq clauseı. `g.` aliası istifadə edir.
 */
function buildGameWhereSql({
  q,
  store,
  genres,
  titleContains,
  productType,
  platform,
  onSale,
  priceMinTryCents,
  priceMaxTryCents,
  ...metadata
}: {
  q: string;
  store: string;
  genres: string[] | null;
  titleContains?: string | null;
  /** null when type=ALL (no productType filter applied) */
  productType: string | null;
  platform: string | null;
  onSale: boolean;
  priceMinTryCents: number | null;
  priceMaxTryCents: number | null;
} & MetadataFilters) {
  const baseSql = buildGameBaseWhereSql({
    store,
    genres,
    titleContains,
    productType,
    platform,
    onSale,
    priceMinTryCents,
    priceMaxTryCents,
    ...metadata,
  });
  // Başlıq uyğunluğu navbar modalı ilə EYNİ mühərrikdən keçir
  // (lib/gameSearchSql.ts): abbreviatura ("gta 5" → Grand Theft Auto V),
  // defis/apostrof ("spiderman" → Marvel's Spider-Man), diakritik
  // ("ragnarok" → Ragnarök) və typo toleransı. Sadə `ILIKE '%q%'` bunların
  // heç birini tutmurdu.
  const titleClause = gameSearchMatchSql(buildGameSearchTerms(q));
  return PrismaSql.sql`${baseSql} AND ${titleClause}`;
}

function buildFuzzyOrderSql(sort: Sort, q: string) {
  // Rank relevance first, then apply the chosen sort as a tie-breaker.
  // Note: "popular" is handled as a filter in the Prisma path; here we keep it
  // as a deterministic secondary order.
  const relevance = gameSearchRelevanceSql(buildGameSearchTerms(q));

  switch (sort) {
    case "alpha":
      return PrismaSql.sql`${relevance}, g."title" ASC`;
    case "priceAsc":
      return PrismaSql.sql`${relevance},
        g."discountTryCents" ASC NULLS LAST,
        g."priceTryCents" ASC`;
    case "priceDesc":
      return PrismaSql.sql`${relevance},
        g."discountTryCents" DESC NULLS LAST,
        g."priceTryCents" DESC`;
    case "newest":
      return PrismaSql.sql`${relevance}, g."lastScrapedAt" DESC, g."id" ASC`;
    case "popular":
      return PrismaSql.sql`${relevance}, g."lastScrapedAt" DESC, g."title" ASC`;
    case "rating":
      return PrismaSql.sql`${relevance},
        g."psRatingAvg" DESC NULLS LAST,
        g."psRatingCount" DESC NULLS LAST`;
    case "releaseNew":
      return PrismaSql.sql`${relevance}, g."releaseDate" DESC NULLS LAST`;
    case "releaseOld":
      return PrismaSql.sql`${relevance}, g."releaseDate" ASC NULLS LAST`;
    case "discount":
    case "discountAsc":
      // handled above
      return PrismaSql.sql`${relevance}`;
  }
}

/**
 * Build a Prisma `WhereInput` fragment that filters rows by the effective
 * price (discount when present and not expired in display logic, else base
 * price). Returns null when neither bound is set so callers can skip the
 * AND clause entirely.
 *
 * The OR shape lets the planner push the bound into the right column index
 * — discount-bearing rows hit a `discountTryCents BETWEEN` scan, the rest
 * fall back to the `priceTryCents` index.
 */
