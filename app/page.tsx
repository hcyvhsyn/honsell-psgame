import { prisma } from "@/lib/prisma";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";
import GameBrowser from "@/components/GameBrowser";
import SiteHeader from "@/components/SiteHeader";
import type { GameCardData } from "@/components/GameCard";
import { Sparkles, ShieldCheck, Zap } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const HOMEPAGE_LIMIT = 100;
const DEFAULT_TYPE = "GAME";

export default async function HomePage() {
  const [settings, games, typeAllCount, typeOnSaleCount, totalsArr] =
    await Promise.all([
      getSettings(),
      prisma.game.findMany({
        where: { isActive: true, productType: DEFAULT_TYPE },
        orderBy: { lastScrapedAt: "desc" },
        take: HOMEPAGE_LIMIT,
      }),
      prisma.game.count({
        where: { isActive: true, productType: DEFAULT_TYPE },
      }),
      prisma.game.count({
        where: {
          isActive: true,
          productType: DEFAULT_TYPE,
          discountTryCents: { not: null },
        },
      }),
      prisma.game.groupBy({
        by: ["productType"],
        where: { isActive: true },
        _count: { _all: true },
      }),
    ]);

  const totals: Record<string, number> = {
    GAME: 0,
    ADDON: 0,
    CURRENCY: 0,
    OTHER: 0,
  };
  for (const row of totalsArr) totals[row.productType] = row._count._all;

  const results: GameCardData[] = games.map((g) => {
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

  const initial = {
    total: typeAllCount,
    totalAll: typeAllCount,
    totalOnSale: typeOnSaleCount,
    totals,
    count: results.length,
    results,
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeader />

      <section className="border-b border-zinc-800/80 bg-gradient-to-b from-indigo-950/30 via-zinc-950 to-zinc-950">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex flex-col gap-3">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-200">
              <Sparkles className="h-3 w-3" /> Canlı PS Store kataloqu · {totals.GAME.toLocaleString("en-US")} oyun
            </span>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              PlayStation oyunları, Manatla ödə.
            </h1>
            <p className="max-w-2xl text-sm text-zinc-400 sm:text-base">
              Türkiyə PS Store-dan canlı qiymətlər. Cüzdandan ödəyin, oyun
              birbaşa öz PSN hesabınıza çatdırılır.
            </p>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-zinc-400">
              <span className="inline-flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-indigo-400" /> Anında çatdırılma
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Güvənli ödəniş
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-8">
        <GameBrowser initial={initial} />
      </section>

      <footer className="mt-12 border-t border-zinc-800/80">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-6 py-6 text-xs text-zinc-500 sm:flex-row sm:items-center">
          <span>© {new Date().getFullYear()} Honsell PS Store</span>
          <span>Qiymətlər PS Store TR-dan canlı çəkilir, Manat hesablanır.</span>
        </div>
      </footer>
    </main>
  );
}
