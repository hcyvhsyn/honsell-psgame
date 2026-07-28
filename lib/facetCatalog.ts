/**
 * Facet landing səhifələri üçün server tərəfli kataloq sorğusu.
 *
 * KRİTİK: ilk səhifə SERVER-də çəkilir. GameBrowser client komponentdir və
 * `/api/games`-dən yükləyir — əgər landing səhifəsi də yalnız ona güvənsəydi,
 * Google səhifəni məhsulsuz görərdi və kateqoriya səhifəsinin bütün mənası
 * itərdi. Server ilk səhifəni hazır HTML kimi verir, sonra client komponent
 * eyni filtri saxlayaraq işi davam etdirir.
 */
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  aznToTryCents,
  computeDisplayPrice,
  getSettings,
  type PricingSettings,
} from "@/lib/pricing";
import { fetchPopularGames } from "@/lib/popularity";
import { buildGameBaseWhereSql, buildGameWhere } from "@/lib/gameQuery";
import type { FacetFilter } from "@/lib/gameFacets";
import type { GameCardData } from "@/components/GameCard";

export const FACET_PAGE_SIZE = 24;

export type FacetCatalogResult = {
  cards: GameCardData[];
  total: number;
  totalPages: number;
};

/**
 * Facet filtrini DB sorğusuna çevirir və ilk səhifəni populyarlıq sırası ilə
 * qaytarır. Qiymət hədləri AZN-dədir və `aznToTryCents` ilə TRY-ə çevrilir —
 * kataloqda qiymətlər lirə saxlanılır (bax: prisma/schema.prisma Game).
 */
async function queryFacet(
  filter: FacetFilter,
  page: number,
  settings: PricingSettings
): Promise<FacetCatalogResult> {
  const priceMinTryCents =
    filter.priceMinAzn != null
      ? aznToTryCents(filter.priceMinAzn, settings, "ceil")
      : null;
  const priceMaxTryCents =
    filter.priceMaxAzn != null
      ? aznToTryCents(filter.priceMaxAzn, settings, "floor")
      : null;

  const shared = {
    store: "PS",
    genres: filter.genres && filter.genres.length > 0 ? filter.genres : null,
    platform: filter.platform ?? null,
    onSale: filter.onSale ?? false,
    titleContains: filter.franchise ?? null,
    priceMinTryCents,
    priceMaxTryCents,
  };

  const whereSql = buildGameBaseWhereSql(shared);
  const where = buildGameWhere(shared);
  const offset = (page - 1) * FACET_PAGE_SIZE;

  const [rows, total] = await Promise.all([
    fetchPopularGames(whereSql, FACET_PAGE_SIZE, offset),
    prisma.game.count({ where }),
  ]);

  const cards: GameCardData[] = rows.map((g) => {
    const price = computeDisplayPrice(g, settings);
    return {
      id: g.id,
      productId: g.productId,
      slug: g.slug,
      title: g.title,
      imageUrl: g.imageUrl,
      platform: g.platform,
      productType: g.productType,
      store: g.store,
      finalAzn: price.finalAzn,
      originalAzn: price.originalAzn,
      discountPct: price.discountPct,
      discountEndAt:
        g.discountTryCents != null && g.discountEndAt
          ? g.discountEndAt.toISOString()
          : null,
    };
  });

  return {
    cards,
    total,
    totalPages: Math.max(1, Math.ceil(total / FACET_PAGE_SIZE)),
  };
}

/**
 * Keşlənmiş variant. Açar facet path + səhifə nömrəsidir; "games" tag-ı ilə
 * bağlıdır, yəni scrape/admin əməliyyatı `revalidateGames()` çağıranda bütün
 * facet səhifələri də təzələnir (bax: lib/revalidate.ts).
 */
export function getFacetCatalog(
  facetPath: string,
  filter: FacetFilter,
  page: number
): Promise<FacetCatalogResult> {
  return unstable_cache(
    async () => {
      const settings = await getSettings();
      return queryFacet(filter, page, settings);
    },
    ["facet-catalog", facetPath, String(page)],
    { revalidate: 600, tags: ["games"] }
  )();
}
