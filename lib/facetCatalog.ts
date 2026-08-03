/**
 * Facet landing səhifələri üçün server tərəfli kataloq sorğusu.
 *
 * KRİTİK: ilk səhifə SERVER-də çəkilir. GameBrowser client komponentdir və
 * `/api/games`-dən yükləyir — əgər landing səhifəsi də yalnız ona güvənsəydi,
 * Google səhifəni məhsulsuz görərdi və kateqoriya səhifəsinin bütün mənası
 * itərdi. Server ilk səhifəni hazır HTML kimi verir, sonra client komponent
 * eyni filtri saxlayaraq işi davam etdirir.
 *
 * KEŞ SƏRHƏDİ — DİQQƏT:
 * `unstable_cache` sorğu əhatəsindən (request scope) KƏNARDA işləyir, ona görə
 * onun içində React `cache()` ilə memoizasiya olunmuş funksiyanı (`getSettings`)
 * çağırmaq olmaz. Kodbazanın qalan hissəsi də bu qaydaya əməl edir: qiymət
 * parametrləri həmişə kənarda oxunur və parametr kimi ötürülür
 * (bax: app/page.tsx fetchBestSellers). Ona görə burada keşdə YALNIZ xam DB
 * nəticəsi saxlanılır, qiymət hesablaması isə hər sorğuda təzə aparılır —
 * bu, həm də admin qiymət parametrini dəyişəndə facet səhifələrinin dərhal
 * yenilənməsini təmin edir.
 */
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma as PrismaSql } from "@/lib/generated/prisma/client";
import {
  aznToTryCents,
  computeDisplayPrice,
  type PricingSettings,
} from "@/lib/pricing";
import {
  POPULARITY_JOINS_SQL,
  POPULARITY_ORDER_BY_SQL,
} from "@/lib/popularity";
import { buildGameBaseWhereSql, buildGameWhere } from "@/lib/gameQuery";
import { buildGameCard } from "@/lib/gameCardMapper";
import type { FacetFilter } from "@/lib/gameFacets";
import type { GameCardData } from "@/components/GameCard";

export const FACET_PAGE_SIZE = 24;

export type FacetCatalogResult = {
  cards: GameCardData[];
  total: number;
  totalPages: number;
};

/**
 * Kart üçün lazım olan sütunlar. `SELECT g.*` işlətmirik: `Game.embedding`
 * 512 ölçülü Float[] sütundur və onu keşə yazmaq hər facet səhifəsinə onlarla
 * kilobayt lazımsız yük əlavə edərdi.
 */
type FacetRow = {
  id: string;
  productId: string;
  slug: string | null;
  title: string;
  imageUrl: string | null;
  platform: string | null;
  productType: string;
  store: string;
  priceTryCents: number;
  discountTryCents: number | null;
  discountEndAt: Date | null;
  // PS Store detal metadata-sı — kart janr/PEGI/reytinq sətrini bunlardan qurur.
  genres: string[] | null;
  contentRating: string | null;
  psRatingAvg: number | null;
  psRatingCount: number | null;
  publisherName: string | null;
  releaseDate: Date | null;
  editionLabel: string | null;
};

/** Facet filtrini paylaşılan filtr qurucusunun gözlədiyi formaya salır. */
function toFilterInput(filter: FacetFilter, settings: PricingSettings) {
  return {
    store: "PS",
    genres: filter.genres && filter.genres.length > 0 ? filter.genres : null,
    platform: filter.platform ?? null,
    onSale: filter.onSale ?? false,
    titleContains: filter.franchise ?? null,
    // Qiymət hədləri AZN-dədir, kataloqda isə qiymətlər lirə saxlanılır.
    priceMinTryCents:
      filter.priceMinAzn != null
        ? aznToTryCents(filter.priceMinAzn, settings, "ceil")
        : null,
    priceMaxTryCents:
      filter.priceMaxAzn != null
        ? aznToTryCents(filter.priceMaxAzn, settings, "floor")
        : null,
  };
}

/**
 * Xam DB nəticəsi — keşlənən hissə budur.
 *
 * `settings` argument kimi ötürülür (keşin İÇİNDƏ oxunmur), çünki qiymət
 * hədləri TRY-ə çevrilməlidir. Keş açarına isə yalnız facet path + səhifə
 * düşür; qiymət parametri dəyişəndə admin `revalidateGames()` çağırır və
 * "games" tag-ı bu keşi də təmizləyir (bax: lib/revalidate.ts).
 */
function getFacetRows(
  facetPath: string,
  filter: FacetFilter,
  page: number,
  settings: PricingSettings
): Promise<{ rows: FacetRow[]; total: number }> {
  return unstable_cache(
    async () => {
      const input = toFilterInput(filter, settings);
      const whereSql = buildGameBaseWhereSql(input);
      const where = buildGameWhere(input);
      const offset = (page - 1) * FACET_PAGE_SIZE;

      const [rows, total] = await Promise.all([
        prisma.$queryRaw<FacetRow[]>(PrismaSql.sql`
          SELECT g."id", g."productId", g."slug", g."title", g."imageUrl",
                 g."platform", g."productType", g."store", g."priceTryCents",
                 g."discountTryCents", g."discountEndAt", g."genres",
                 g."contentRating", g."psRatingAvg", g."psRatingCount",
                 g."publisherName", g."releaseDate", g."editionLabel"
          FROM "Game" g
          ${POPULARITY_JOINS_SQL}
          WHERE ${whereSql}
          ORDER BY ${POPULARITY_ORDER_BY_SQL}
          LIMIT ${FACET_PAGE_SIZE} OFFSET ${offset}
        `),
        prisma.game.count({ where }),
      ]);

      return { rows, total };
    },
    ["facet-catalog", facetPath, String(page)],
    { revalidate: 600, tags: ["games"] }
  )();
}

/**
 * Bütün facet-lərin məhsul sayı — kateqoriya çiplərini göstərmək üçün.
 *
 * Boş facet-i istifadəçiyə göstərmək mənasızdır: klikləyib boş səhifə görür.
 * Xüsusən janr facet-ləri `scripts/enrichGameMetadata.ts` işləyənə qədər boş
 * qalır (PS sətirlərində `genres` doldurulmayıb), ona görə onlar data gələnə
 * qədər avtomatik gizlənir və sonra özləri görünür.
 *
 * 16 sayğac paralel işləyir və nəticə 10 dəqiqə keşlənir — hər səhifə
 * yüklənməsində 16 sorğu atılmır.
 */
export function getFacetCounts(
  facets: { path: string; filter: FacetFilter }[],
  settings: PricingSettings
): Promise<Record<string, number>> {
  return unstable_cache(
    async () => {
      const entries = await Promise.all(
        facets.map(async (f) => {
          const total = await prisma.game.count({
            where: buildGameWhere(toFilterInput(f.filter, settings)),
          });
          return [f.path, total] as const;
        })
      );
      return Object.fromEntries(entries);
    },
    ["facet-counts", facets.map((f) => f.path).join(",")],
    { revalidate: 600, tags: ["games"] }
  )();
}

/**
 * Facet səhifəsinin ilk səhifəsi. `settings` çağıran tərəfdən gəlir — keşin
 * içində `getSettings()` çağırmaq olmaz (yuxarıdakı "KEŞ SƏRHƏDİ" qeydi).
 */
export async function getFacetCatalog(
  facetPath: string,
  filter: FacetFilter,
  page: number,
  settings: PricingSettings
): Promise<FacetCatalogResult> {
  const { rows, total } = await getFacetRows(facetPath, filter, page, settings);

  const cards: GameCardData[] = rows.map((g) =>
    buildGameCard(g, computeDisplayPrice(g, settings))
  );

  return {
    cards,
    total,
    totalPages: Math.max(1, Math.ceil(total / FACET_PAGE_SIZE)),
  };
}
