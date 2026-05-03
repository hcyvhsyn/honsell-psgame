import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";
import type { Game, Prisma } from "@/lib/generated/prisma/client";
import { Prisma as PrismaSql } from "@/lib/generated/prisma/client";

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

const PRODUCT_TYPES = new Set(["GAME", "ADDON", "CURRENCY", "OTHER"]);

/**
 * Unified games listing.
 *   q             search query (min 2 chars; otherwise ignored)
 *   sort          newest | priceAsc | priceDesc | discount | alpha
 *   type          GAME | ADDON | CURRENCY | OTHER  (default: GAME)
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

  const typeParam = url.searchParams.get("type") ?? "GAME";
  const productType = PRODUCT_TYPES.has(typeParam) ? typeParam : "GAME";

  const platform = url.searchParams.get("platform"); // PS4 | PS5 | null
  const onSale = url.searchParams.get("onSale") === "1";

  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit")) || 100));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  const page = Math.max(1, Math.floor(offset / limit) + 1);

  const where: Prisma.GameWhereInput = { isActive: true, productType };
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
  if (sort === "popular") where.isFeatured = true;

  const useFuzzy = q.length >= 2;

  const [typeAllCount, typeOnSaleCount, totalsArr, settings] = await Promise.all([
    prisma.game.count({ where: { isActive: true, productType } }),
    prisma.game.count({
      where: { isActive: true, productType, discountTryCents: { not: null } },
    }),
    prisma.game.groupBy({
      by: ["productType"],
      where: { isActive: true },
      _count: { _all: true },
    }),
    getSettings(),
  ]);

  const { filteredCount, rows } = useFuzzy
    ? await fetchFuzzy({ q, sort, productType, platform, onSale, limit, offset })
    : {
        filteredCount: await prisma.game.count({ where }),
        rows: await fetchSorted(where, sort, limit, offset),
      };

  const totals: Record<string, number> = {
    GAME: 0,
    ADDON: 0,
    CURRENCY: 0,
    OTHER: 0,
  };
  for (const row of totalsArr) totals[row.productType] = row._count._all;

  const results = rows.map((g) => {
    const price = computeDisplayPrice(g, settings);
    return {
      id: g.id,
      title: g.title,
      imageUrl: g.imageUrl,
      platform: g.platform,
      productType: g.productType,
      finalAzn: price.finalAzn,
      originalAzn: price.originalAzn,
      discountPct: price.discountPct,
      discountEndAt: g.discountTryCents != null && g.discountEndAt ? g.discountEndAt.toISOString() : null,
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
  productType,
  platform,
  onSale,
  limit,
  offset,
}: {
  q: string;
  sort: Sort;
  productType: string;
  platform: string | null;
  onSale: boolean;
  limit: number;
  offset: number;
}): Promise<{ filteredCount: number; rows: Game[] }> {
  // Prefer typo-tolerant fuzzy search on Postgres when available (pg_trgm).
  // If the extension is not enabled (or the DB blocks it), fall back to
  // the original `contains` behavior so search still works.
  try {
    let whereSql = buildGameWhereSql({ q, productType, platform, onSale });
    if (sort === "popular") whereSql = PrismaSql.sql`${whereSql} AND g."isFeatured" = true`;

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
    const where: Prisma.GameWhereInput = { isActive: true, productType };
    where.title = { contains: q, mode: "insensitive" };
    if (platform === "PS4" || platform === "PS5") {
      where.OR = [{ platform: { contains: platform } }, { platform: null }];
    }
    if (onSale) where.discountTryCents = { not: null };
    if (sort === "popular") where.isFeatured = true;

    const [filteredCount, rows] = await Promise.all([
      prisma.game.count({ where }),
      fetchSorted(where, sort, limit, offset),
    ]);
    return { filteredCount, rows };
  }
}

function buildGameWhereSql({
  q,
  productType,
  platform,
  onSale,
}: {
  q: string;
  productType: string;
  platform: string | null;
  onSale: boolean;
}) {
  // Base filters.
  const parts: PrismaSql.Sql[] = [
    PrismaSql.sql`g."isActive" = true`,
    PrismaSql.sql`g."productType" = ${productType}`,
  ];

  if (onSale) parts.push(PrismaSql.sql`g."discountTryCents" IS NOT NULL`);

  if (platform === "PS4" || platform === "PS5") {
    parts.push(
      PrismaSql.sql`(g."platform" ILIKE ${`%${platform}%`} OR g."platform" IS NULL)`
    );
  }

  // Fuzzy match:
  // - keep a permissive similarity threshold so short queries like "gta" still work
  // - always allow substring hits (ILIKE) as a strong signal
  parts.push(
    PrismaSql.sql`(g."title" ILIKE ${`%${q}%`} OR similarity(g."title", ${q}) >= 0.15)`
  );

  const whereSql = PrismaSql.join(parts, " AND ");
  return whereSql;
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
