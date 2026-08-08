import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma as PrismaSql } from "@/lib/generated/prisma/client";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";
import { fetchPopularGames } from "@/lib/popularity";
import GameBrowser from "@/components/GameBrowser";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import type { GameCardData } from "@/components/GameCard";
import { ALL_FACETS } from "@/lib/gameFacets";
import { getFacetCounts } from "@/lib/facetCatalog";
import { buildGameCard } from "@/lib/gameCardMapper";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "PlayStation Oyunları — PS4 və PS5 Oyun Kataloqu",
  description:
    "Azərbaycanda PlayStation oyunlarının ən böyük kataloqu. PS4, PS5, endirimli oyunlar, ən yeni çıxışlar — anında çatdırılma və etibarlı ödəniş.",
  alternates: { canonical: "/oyunlar" },
  openGraph: {
    title: "PlayStation Oyunları — PS4 və PS5 Oyun Kataloqu | Honsell Store",
    description:
      "Azərbaycanda PlayStation oyunlarının ən böyük kataloqu. Endirimli oyunlar, ən yeni çıxışlar — anında çatdırılma.",
    url: "/oyunlar",
  },
};

const PAGE_SIZE = 24;

// /oyunlar is the unified catalog: games, DLCs, currency, and other SKUs are
// served together so users can browse the full PS Store catalog from one page.
// The type pill switcher inside GameBrowser narrows the view client-side.
//
// İlkin sıralama populyarlıqdandır (lib/popularity.ts) — bütün aktiv PS kataloqu
// üzərində uğurlu alış, favorit, təsdiqlənmiş rəy sayı + curated/endirim
// boost-larından çəkili skor. Köhnə `isFeatured = true` filtri götürülüb: artıq
// featured flag-i yalnız sıralamada yumşaq boost kimi keçir.
const getOyunlarPageData = unstable_cache(
  async (page: number) => {
    const offset = (page - 1) * PAGE_SIZE;
    const whereSql = PrismaSql.sql`g."isActive" = true AND g."store" = 'PS'`;
    const [games, typeAllCount, typeOnSaleCount, totalsArr] = await Promise.all([
      fetchPopularGames(whereSql, PAGE_SIZE, offset),
      prisma.game.count({ where: { isActive: true, store: "PS" } }),
      prisma.game.count({
        where: { isActive: true, store: "PS", discountTryCents: { not: null } },
      }),
      prisma.game.groupBy({
        by: ["productType"],
        where: { isActive: true, store: "PS" },
        _count: { _all: true },
      }),
    ]);
    // popularCount = filtersiz total: indi typeAllCount-la eyni (featured
    // məhdudlaşması yoxdur). Adı GameBrowser-də "total" kimi istifadə olunduğu
    // üçün geri uyğunluq xatirinə saxlayırıq.
    return {
      games,
      popularCount: typeAllCount,
      typeAllCount,
      typeOnSaleCount,
      totalsArr,
    };
  },
  ["oyunlar-page-v4-popular-all"],
  { revalidate: 600, tags: ["games"] }
);

export default async function OyunlarPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const pageRaw = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const page = Math.max(1, Number(pageRaw) || 1);
  // Navbar modalındakı "Kataloqda filtrlərlə axtar" keçidi sorğunu `?q=` ilə
  // ötürür. İlkin data keşlənmiş populyar siyahıdır — GameBrowser mount-da
  // dərhal /api/games-i bu sorğu ilə çağırır və siyahını əvəz edir.
  const qRaw = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const initialQuery = (qRaw ?? "").trim().slice(0, 80);

  const [settings, { games, popularCount, typeAllCount, typeOnSaleCount, totalsArr }] = await Promise.all([
    getSettings(),
    getOyunlarPageData(page),
  ]);

  const totals: Record<string, number> = { GAME: 0, ADDON: 0, CURRENCY: 0, OTHER: 0 };
  for (const row of totalsArr) totals[row.productType] = row._count._all;

  const results: GameCardData[] = games.map((g) =>
    buildGameCard(g, computeDisplayPrice(g, settings))
  );

  // Boş kateqoriyaları göstərmək istifadəçini boş səhifəyə aparır. Janr
  // facet-ləri `scripts/enrichGameMetadata.ts` işləyənə qədər boş olur, ona
  // görə onlar data gələnə qədər avtomatik gizlənir.
  const facetCounts = await getFacetCounts(ALL_FACETS, settings).catch(
    () => ({}) as Record<string, number>
  );
  const categoryLinks = ALL_FACETS.filter((f) => (facetCounts[f.path] ?? 0) > 0).map(
    (f) => ({ path: f.path, label: f.h1 })
  );

  const initial = {
    total: popularCount,
    totalAll: typeAllCount,
    totalOnSale: typeOnSaleCount,
    totals,
    count: results.length,
    results,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(popularCount / PAGE_SIZE)),
  };

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
      <SiteHeaderServer />
   

      <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8 mt-12">
        <GameBrowser
          initial={initial}
          categoryLinks={categoryLinks}
          initialQuery={initialQuery}
        />
      </section>
    </main>
  );
}
