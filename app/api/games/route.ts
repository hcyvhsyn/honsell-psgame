import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";
import type { Prisma } from "@/lib/generated/prisma/client";

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
 *     count, results }
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

  const [
    filteredCount,
    typeAllCount,
    typeOnSaleCount,
    totalsArr,
    settings,
    rows,
  ] = await Promise.all([
    prisma.game.count({ where }),
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
    fetchSorted(where, sort, limit, offset),
  ]);

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
    };
  });

  return NextResponse.json({
    total: filteredCount,
    totalAll: typeAllCount,
    totalOnSale: typeOnSaleCount,
    totals,
    count: results.length,
    results,
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
