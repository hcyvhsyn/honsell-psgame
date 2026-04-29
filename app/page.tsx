import { prisma } from "@/lib/prisma";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";
import GameBrowser from "@/components/GameBrowser";
import SiteHeader from "@/components/SiteHeader";
import type { GameCardData } from "@/components/GameCard";

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

      <section className="relative overflow-hidden border-b border-zinc-800/80 bg-gradient-to-b from-indigo-950/30 via-zinc-950 to-zinc-950">
        <PlayStationBackdrop />
        <div className="relative mx-auto max-w-6xl px-6 py-14">
          <div className="flex flex-col gap-3">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-200">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
              {totals.GAME.toLocaleString("en-US")} oyun · canlı kataloq
            </span>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
              PlayStation oyunları
            </h1>
       
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-8">
        <GameBrowser initial={initial} />
      </section>

      <footer className="mt-12 border-t border-zinc-800/80">
        <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-zinc-500">
          © {new Date().getFullYear()} Honsell PS Store
        </div>
      </footer>
    </main>
  );
}

function PlayStationBackdrop() {
  const symbols: Array<{
    shape: "triangle" | "circle" | "cross" | "square";
    color: string;
    className: string;
    size: number;
    rotate: number;
    duration: number;
    delay: number;
  }> = [
    { shape: "triangle", color: "#34d399", className: "left-[6%] top-8",     size: 92, rotate: -8,  duration: 7.5, delay: 0 },
    { shape: "circle",   color: "#f87171", className: "right-[8%] top-6",    size: 80, rotate: 0,   duration: 8.5, delay: 1.2 },
    { shape: "cross",    color: "#60a5fa", className: "left-[42%] top-2",    size: 70, rotate: 12,  duration: 6.5, delay: 0.6 },
    { shape: "square",   color: "#f472b6", className: "right-[28%] bottom-4", size: 64, rotate: -14, duration: 9,   delay: 2 },
    { shape: "triangle", color: "#34d399", className: "right-[4%] bottom-8",  size: 56, rotate: 18,  duration: 7,   delay: 1.8 },
    { shape: "circle",   color: "#f87171", className: "left-[24%] bottom-6",  size: 50, rotate: 0,   duration: 8,   delay: 0.4 },
  ];

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute -left-32 top-0 h-72 w-72 animate-pulse rounded-full bg-indigo-600/10 blur-3xl" />
      <div
        className="absolute -right-32 bottom-0 h-72 w-72 animate-pulse rounded-full bg-fuchsia-600/10 blur-3xl"
        style={{ animationDelay: "1.5s" }}
      />
      {symbols.map((s, i) => (
        <span
          key={i}
          className={`ps-float absolute hidden sm:block ${s.className}`}
          style={
            {
              "--ps-rot": `${s.rotate}deg`,
              "--ps-dur": `${s.duration}s`,
              "--ps-delay": `${s.delay}s`,
            } as React.CSSProperties
          }
        >
          <PsGlyph shape={s.shape} color={s.color} size={s.size} />
        </span>
      ))}
    </div>
  );
}

function PsGlyph({
  shape,
  color,
  size,
}: {
  shape: "triangle" | "circle" | "cross" | "square";
  color: string;
  size: number;
}) {
  const stroke = Math.max(2, Math.round(size / 18));
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 64 64",
    fill: "none",
    stroke: color,
    strokeWidth: stroke,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (shape === "triangle") {
    return (
      <svg {...common}>
        <path d="M32 10 L54 50 H10 Z" />
      </svg>
    );
  }
  if (shape === "circle") {
    return (
      <svg {...common}>
        <circle cx="32" cy="32" r="22" />
      </svg>
    );
  }
  if (shape === "cross") {
    return (
      <svg {...common}>
        <path d="M14 14 L50 50 M50 14 L14 50" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="12" y="12" width="40" height="40" rx="2" />
    </svg>
  );
}
