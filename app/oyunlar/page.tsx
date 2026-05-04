import { prisma } from "@/lib/prisma";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";
import GameBrowser from "@/components/GameBrowser";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import type { GameCardData } from "@/components/GameCard";
import { Gamepad2 } from "lucide-react";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;
const TYPE = "GAME";

export default async function OyunlarPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const pageRaw = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const page = Math.max(1, Number(pageRaw) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [settings, games, typeAllCount, typeOnSaleCount, totalsArr] = await Promise.all([
    getSettings(),
    prisma.game.findMany({
      where: { isActive: true, productType: TYPE },
      orderBy: { lastScrapedAt: "desc" },
      take: PAGE_SIZE,
      skip: offset,
    }),
    prisma.game.count({ where: { isActive: true, productType: TYPE } }),
    prisma.game.count({
      where: { isActive: true, productType: TYPE, discountTryCents: { not: null } },
    }),
    prisma.game.groupBy({
      by: ["productType"],
      where: { isActive: true },
      _count: { _all: true },
    }),
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
      discountEndAt: g.discountTryCents != null && g.discountEndAt ? g.discountEndAt.toISOString() : null,
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
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeaderServer />
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-indigo-600/15 to-zinc-900/40 p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-200">
            <Gamepad2 className="h-3.5 w-3.5" />
            Oyun kataloqu
          </div>
          <h1 className="mt-4 text-3xl font-black text-white sm:text-4xl">PlayStation Oyunları</h1>
          <p className="mt-2 text-sm text-zinc-400">Axtar, filtr et və ən sərfəli qiymətlərlə dərhal al.</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6">
        <GameBrowser initial={initial} />
      </section>
    </main>
  );
}
