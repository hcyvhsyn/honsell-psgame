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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Sort = "newest" | "priceAsc" | "priceDesc" | "discount" | "alpha" | "popular";

const SORTS = new Set<Sort>([
  "newest",
  "priceAsc",
  "priceDesc",
  "discount",
  "alpha",
  "popular",
]);

const PRODUCT_TYPES = new Set(["ALL", "GAME", "ADDON", "CURRENCY", "OTHER"]);

/**
 * Unified games listing.
 *   q             search query (min 2 chars; otherwise ignored)
 *   sort          newest | priceAsc | priceDesc | discount | alpha
 *   type          ALL | GAME | ADDON | CURRENCY | OTHER  (default: ALL)
 *   platform      PS4 | PS5
 *   onSale        "1" → only items with an active discount
 *   limit         default 100, max 200
 *   offset        for pagination
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
  const genre = (url.searchParams.get("genre") ?? "").trim();

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
  if (genre && store === "EPIC") where.genres = { has: genre };
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
      genre: genre && store === "EPIC" ? genre : null,
      productType: filterByType ? productType : null,
      platform,
      onSale,
      limit,
      offset,
      priceMinTryCents,
      priceMaxTryCents,
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
      genre: genre && store === "EPIC" ? genre : null,
      priceMinTryCents,
      priceMaxTryCents,
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
    return {
      id: g.id,
      store: g.store,
      // Epic rows have no detail page yet, so don't surface a productId the
      // card would turn into a /oyunlar/[productId] link.
      productId: isEpic ? null : g.productId,
      title: g.title,
      imageUrl: g.imageUrl,
      platform: g.platform,
      productType: g.productType,
      finalAzn: price.finalAzn,
      originalAzn: price.originalAzn,
      discountPct: price.discountPct,
      // Epic's struck-through price is the AZ reference (structural saving), not
      // a timed sale → no countdown for Epic rows.
      discountEndAt:
        !isEpic && g.discountTryCents != null && g.discountEndAt
          ? g.discountEndAt.toISOString()
          : null,
    };
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
    case "discount": {
      const all = await prisma.game.findMany({
        where: { ...where, discountTryCents: { not: null } },
      });
      all.sort((a, b) => {
        const pa = (a.priceTryCents - (a.discountTryCents ?? a.priceTryCents)) / a.priceTryCents;
        const pb = (b.priceTryCents - (b.discountTryCents ?? b.priceTryCents)) / b.priceTryCents;
        return pb - pa;
      });
      return all.slice(skip, skip + take);
    }
  }
}

async function fetchFuzzy({
  q,
  sort,
  store,
  genre,
  productType,
  platform,
  onSale,
  limit,
  offset,
  priceMinTryCents,
  priceMaxTryCents,
}: {
  q: string;
  sort: Sort;
  store: string;
  /** Epic genre filter, or null. */
  genre: string | null;
  /** null when type=ALL (no productType filter applied) */
  productType: string | null;
  platform: string | null;
  onSale: boolean;
  limit: number;
  offset: number;
  priceMinTryCents: number | null;
  priceMaxTryCents: number | null;
}): Promise<{ filteredCount: number; rows: Game[] }> {
  // Prefer typo-tolerant fuzzy search on Postgres when available (pg_trgm).
  // If the extension is not enabled (or the DB blocks it), fall back to
  // the original `contains` behavior so search still works.
  try {
    const whereSql = buildGameWhereSql({
      q,
      store,
      genre,
      productType,
      platform,
      onSale,
      priceMinTryCents,
      priceMaxTryCents,
    });
    // Axtarış həm fuzzy həm AI semantic ilə işləyir; relevance bütün kataloqu
    // əhatə edir. Popular filter-i artıq tətbiq olunmur (popular bütün
    // kataloqda işləyir).

    if (sort === "discount") {
      // This sort is computed (requires discount), so we fetch all matching and
      // sort in JS (same approach as the non-fuzzy codepath).
      const discountWhere = PrismaSql.sql`${whereSql} AND g."discountTryCents" IS NOT NULL`;
      const all = (await prisma.$queryRaw(
        PrismaSql.sql`SELECT g.* FROM "Game" g WHERE ${discountWhere}`
      )) as Game[];

      const filteredCount =
        all.length; /* best-effort; avoids an extra count query in this branch */

      all.sort((a, b) => {
        const pa = (a.priceTryCents - (a.discountTryCents ?? a.priceTryCents)) / a.priceTryCents;
        const pb = (b.priceTryCents - (b.discountTryCents ?? b.priceTryCents)) / b.priceTryCents;
        return pb - pa;
      });
      return { filteredCount, rows: all.slice(offset, offset + limit) };
    }

    const countRow = (await prisma.$queryRaw(
      PrismaSql.sql`SELECT COUNT(*)::int AS count FROM "Game" g WHERE ${whereSql}`
    )) as Array<{ count: number }>;

    const orderSql = buildFuzzyOrderSql(sort, q);
    const rows = (await prisma.$queryRaw(
      PrismaSql.sql`SELECT g.* FROM "Game" g WHERE ${whereSql} ORDER BY ${orderSql} LIMIT ${limit} OFFSET ${offset}`
    )) as Game[];

    return { filteredCount: countRow?.[0]?.count ?? 0, rows };
  } catch {
    // Fallback: simple substring match (existing behavior).
    const where: Prisma.GameWhereInput = { isActive: true, store };
    if (genre) where.genres = { has: genre };
    if (productType) where.productType = productType;
    where.title = { contains: q, mode: "insensitive" };
    if (platform === "PS4" || platform === "PS5") {
      where.OR = [{ platform: { contains: platform } }, { platform: null }];
    }
    if (onSale) where.discountTryCents = { not: null };
    const priceFilter = buildPriceFilter(priceMinTryCents, priceMaxTryCents);
    if (priceFilter) where.AND = [priceFilter];

    const [filteredCount, rows] = await Promise.all([
      prisma.game.count({ where }),
      fetchSorted(where, sort, limit, offset),
    ]);
    return { filteredCount, rows };
  }
}

/**
 * Filterləri SQL fraqmentinə çevirir — q (axtarış) clauseı YOXDUR.
 * Həm fuzzy axtarış (buildGameWhereSql), həm də populyarlıq sıralaması üçün
 * baza filter dəstidir. `g.` aliası istifadə edir.
 */
function buildGameBaseWhereSql({
  store,
  genre,
  productType,
  platform,
  onSale,
  priceMinTryCents,
  priceMaxTryCents,
}: {
  store: string;
  genre: string | null;
  productType: string | null;
  platform: string | null;
  onSale: boolean;
  priceMinTryCents: number | null;
  priceMaxTryCents: number | null;
}): PrismaSql.Sql {
  const parts: PrismaSql.Sql[] = [
    PrismaSql.sql`g."isActive" = true`,
    PrismaSql.sql`g."store" = ${store}`,
  ];
  if (genre) parts.push(PrismaSql.sql`${genre} = ANY(g."genres")`);
  if (productType) parts.push(PrismaSql.sql`g."productType" = ${productType}`);
  if (onSale) parts.push(PrismaSql.sql`g."discountTryCents" IS NOT NULL`);
  if (platform === "PS4" || platform === "PS5") {
    parts.push(
      PrismaSql.sql`(g."platform" ILIKE ${`%${platform}%`} OR g."platform" IS NULL)`
    );
  }
  // Price range — filter on the effective price (discount when present, else
  // base price). COALESCE keeps the comparison single-column on the DB side.
  if (priceMinTryCents != null) {
    parts.push(
      PrismaSql.sql`COALESCE(g."discountTryCents", g."priceTryCents") >= ${priceMinTryCents}`
    );
  }
  if (priceMaxTryCents != null) {
    parts.push(
      PrismaSql.sql`COALESCE(g."discountTryCents", g."priceTryCents") <= ${priceMaxTryCents}`
    );
  }
  return PrismaSql.join(parts, " AND ");
}

function buildGameWhereSql({
  q,
  store,
  genre,
  productType,
  platform,
  onSale,
  priceMinTryCents,
  priceMaxTryCents,
}: {
  q: string;
  store: string;
  genre: string | null;
  /** null when type=ALL (no productType filter applied) */
  productType: string | null;
  platform: string | null;
  onSale: boolean;
  priceMinTryCents: number | null;
  priceMaxTryCents: number | null;
}) {
  const baseSql = buildGameBaseWhereSql({
    store,
    genre,
    productType,
    platform,
    onSale,
    priceMinTryCents,
    priceMaxTryCents,
  });
  // Fuzzy match:
  // - keep a permissive similarity threshold so short queries like "gta" still work
  // - always allow substring hits (ILIKE) as a strong signal
  const titleClause = PrismaSql.sql`(g."title" ILIKE ${`%${q}%`} OR similarity(g."title", ${q}) >= 0.15)`;
  return PrismaSql.sql`${baseSql} AND ${titleClause}`;
}

function buildFuzzyOrderSql(sort: Sort, q: string) {
  // Rank relevance first, then apply the chosen sort as a tie-breaker.
  // Note: "popular" is handled as a filter in the Prisma path; here we keep it
  // as a deterministic secondary order.
  const relevance = PrismaSql.sql`
    (CASE WHEN g."title" ILIKE ${`%${q}%`} THEN 1 ELSE 0 END) DESC,
    similarity(g."title", ${q}) DESC
  `;

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
    case "discount":
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
function buildPriceFilter(
  minTryCents: number | null,
  maxTryCents: number | null
): Prisma.GameWhereInput | null {
  if (minTryCents == null && maxTryCents == null) return null;

  const range = (col: "discountTryCents" | "priceTryCents") => {
    const r: Prisma.IntFilter = {};
    if (minTryCents != null) r.gte = minTryCents;
    if (maxTryCents != null) r.lte = maxTryCents;
    return { [col]: r } as Prisma.GameWhereInput;
  };

  return {
    OR: [
      { discountTryCents: { not: null }, ...range("discountTryCents") },
      { discountTryCents: null, ...range("priceTryCents") },
    ],
  };
}
