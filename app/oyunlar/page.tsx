import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";
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
const getOyunlarPageData = unstable_cache(
  async (page: number) => {
    const offset = (page - 1) * PAGE_SIZE;
    const [games, popularCount, typeAllCount, typeOnSaleCount, totalsArr] = await Promise.all([
      prisma.game.findMany({
        where: { isActive: true, isFeatured: true },
        orderBy: [{ lastScrapedAt: "desc" }, { title: "asc" }],
        take: PAGE_SIZE,
        skip: offset,
      }),
      prisma.game.count({ where: { isActive: true, isFeatured: true } }),
      prisma.game.count({ where: { isActive: true } }),
      prisma.game.count({
        where: { isActive: true, discountTryCents: { not: null } },
      }),
      prisma.game.groupBy({
        by: ["productType"],
        where: { isActive: true },
        _count: { _all: true },
      }),
    ]);
    return { games, popularCount, typeAllCount, typeOnSaleCount, totalsArr };
  },
  ["oyunlar-page-v3-all-types"],
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
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeaderServer />
   

      <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8 mt-12">
        <GameBrowser initial={initial} />
      </section>
    </main>
  );
}
