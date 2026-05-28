import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma as PrismaSql } from "@/lib/generated/prisma/client";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";
import { fetchPopularGames } from "@/lib/popularity";
import GameBrowser from "@/components/GameBrowser";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import type { GameCardData } from "@/components/GameCard";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "PlayStation Oyunları — PS4 və PS5 Oyun Kataloqu",
  description:
    "Azərbaycanda PlayStation oyunlarının ən böyük kataloqu. PS4, PS5, endirimli oyunlar, ən yeni çıxışlar — anında çatdırılma və etibarlı ödəniş.",
  alternates: { canonical: "/oyunlar" },
  openGraph: {
    title: "PlayStation Oyunları — PS4 və PS5 Oyun Kataloqu | Honsell PS Store",
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

  const [settings, { games, popularCount, typeAllCount, typeOnSaleCount, totalsArr }] = await Promise.all([
    getSettings(),
    getOyunlarPageData(page),
  ]);

  const totals: Record<string, number> = { GAME: 0, ADDON: 0, CURRENCY: 0, OTHER: 0 };
  for (const row of totalsArr) totals[row.productType] = row._count._all;

  const results: GameCardData[] = games.map((g) => {
    const price = computeDisplayPrice(g, settings);
    return {
      id: g.id,
      productId: g.productId,
      title: g.title,
      imageUrl: g.imageUrl,
      platform: g.platform,
      productType: g.productType,
      finalAzn: price.finalAzn,
      originalAzn: price.originalAzn,
      discountPct: price.discountPct,
      discountEndAt:
        g.discountTryCents != null && g.discountEndAt
          ? (g.discountEndAt instanceof Date ? g.discountEndAt.toISOString() : new Date(g.discountEndAt).toISOString())
          : null,
    };
  });

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
        <GameBrowser initial={initial} />
      </section>
    </main>
  );
}
