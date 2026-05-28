import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { computeEpicDisplayPrice, getSettings } from "@/lib/pricing";
import GameBrowser from "@/components/GameBrowser";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import type { GameCardData } from "@/components/GameCard";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Epic Games Oyunları — PC Oyun Kataloqu",
  description:
    "Epic Games Store oyunlarının Azərbaycan üçün kataloqu. Endirimli PC oyunları, ən yeni çıxışlar — sərfəli qiymət və etibarlı çatdırılma.",
  alternates: { canonical: "/epic-games" },
  openGraph: {
    title: "Epic Games Oyunları — PC Oyun Kataloqu | Honsell PS Store",
    description:
      "Epic Games Store oyunlarının Azərbaycan üçün kataloqu. Endirimli PC oyunları, ən yeni çıxışlar.",
    url: "/epic-games",
  },
};

const PAGE_SIZE = 24;

// Epic rows have no `isFeatured` concept yet, so the catalog defaults to the
// newest active titles (mirrors /oyunlar but scoped to store="EPIC").
const getEpicPageData = unstable_cache(
  async (page: number) => {
    const offset = (page - 1) * PAGE_SIZE;
    const [games, typeAllCount, typeOnSaleCount, totalsArr, genreRows] = await Promise.all([
      prisma.game.findMany({
        where: { isActive: true, store: "EPIC" },
        orderBy: [{ lastScrapedAt: "desc" }, { title: "asc" }],
        take: PAGE_SIZE,
        skip: offset,
      }),
      prisma.game.count({ where: { isActive: true, store: "EPIC" } }),
      prisma.game.count({
        where: { isActive: true, store: "EPIC", discountTryCents: { not: null } },
      }),
      prisma.game.groupBy({
        by: ["productType"],
        where: { isActive: true, store: "EPIC" },
        _count: { _all: true },
      }),
      // Distinct genre tags across active Epic rows → category filter options.
      prisma.$queryRaw<Array<{ genre: string }>>`
        SELECT DISTINCT unnest("genres") AS genre
        FROM "Game"
        WHERE "store" = 'EPIC' AND "isActive" = true
        ORDER BY genre ASC
      `,
    ]);
    return { games, typeAllCount, typeOnSaleCount, totalsArr, genreRows };
  },
  ["epic-games-page-v1"],
  { revalidate: 600, tags: ["epic-games"] }
);

export default async function EpicGamesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const pageRaw = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const page = Math.max(1, Number(pageRaw) || 1);

  const [settings, { games, typeAllCount, typeOnSaleCount, totalsArr, genreRows }] =
    await Promise.all([getSettings(), getEpicPageData(page)]);

  const categories = genreRows.map((r) => r.genre).filter(Boolean);

  const totals: Record<string, number> = { GAME: 0, ADDON: 0, CURRENCY: 0, OTHER: 0 };
  for (const row of totalsArr) totals[row.productType] = row._count._all;

  const results: GameCardData[] = games.map((g) => {
    const price = computeEpicDisplayPrice(g, settings);
    return {
      id: g.id,
      store: "EPIC",
      // No Epic detail page yet — omitting productId keeps the card link-free
      // (it would otherwise point at /oyunlar/[productId] and 404). Add-to-cart
      // still works via the generic Game `id`.
      title: g.title,
      imageUrl: g.imageUrl,
      platform: g.platform,
      productType: g.productType,
      finalAzn: price.finalAzn,
      // The struck-through "original" is the Epic Azərbaycan price — i.e. the
      // saving vs buying on Epic directly, not a time-limited sale. So no
      // countdown timer for Epic rows.
      originalAzn: price.originalAzn,
      discountPct: price.discountPct,
      discountEndAt: null,
    };
  });

  const initial = {
    total: typeAllCount,
    totalAll: typeAllCount,
    totalOnSale: typeOnSaleCount,
    totals,
    count: results.length,
    results,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(typeAllCount / PAGE_SIZE)),
  };

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
      <SiteHeaderServer />

      <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8 mt-12">
        <GameBrowser
          initial={initial}
          store="EPIC"
          defaultSort="newest"
          categories={categories}
        />
      </section>
    </main>
  );
}
