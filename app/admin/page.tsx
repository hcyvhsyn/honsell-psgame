import {
  Users,
  ShieldAlert,
  Wallet,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { fmtAzn } from "@/lib/format";
import { getSettings, tryCentsToCostAzn } from "@/lib/pricing";
import GamesProfitChart, {
  type GamesProfitDay,
  type UnknownCostGame,
} from "./GamesProfitChart";

export const dynamic = "force-dynamic";

const PROFIT_WINDOW_DAYS = 30;

export default async function AdminDashboard() {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (PROFIT_WINDOW_DAYS - 1));

  const [
    totalUsers,
    verifiedUsers,
    pendingVerifications,
    purchases,
    deposits,
    walletAgg,
    settings,
    gamePurchases,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { emailVerified: true } }),
    prisma.user.count({ where: { emailVerified: false } }),
    prisma.transaction.aggregate({
      where: { type: "PURCHASE", status: "SUCCESS" },
      _sum: { amountAznCents: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: { type: "DEPOSIT", status: "SUCCESS" },
      _sum: { amountAznCents: true },
      _count: true,
    }),
    prisma.user.aggregate({ _sum: { walletBalance: true } }),
    getSettings(),
    prisma.transaction.findMany({
      where: {
        type: "PURCHASE",
        status: "SUCCESS",
        createdAt: { gte: since },
        gameId: { not: null },
      },
      select: {
        amountAznCents: true,
        costAznCents: true,
        createdAt: true,
        game: {
          select: { id: true, title: true, priceTryCents: true },
        },
      },
    }),
  ]);

  const buckets = new Map<string, GamesProfitDay>();
  for (let i = 0; i < PROFIT_WINDOW_DAYS; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, {
      date: key,
      revenueAznCents: 0,
      costAznCents: 0,
      profitAznCents: 0,
      orderCount: 0,
    });
  }
  const profitTotals = { revenue: 0, cost: 0, profit: 0, orders: 0 };
  let unknownRevenue = 0;
  let unknownOrders = 0;
  const unknownGameMap = new Map<string, UnknownCostGame>();

  for (const row of gamePurchases) {
    if (!row.game) continue;
    const key = row.createdAt.toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    const revenue = Math.abs(row.amountAznCents);

    // Maya dəyərini tapırıq: əvvəlcə snapshot (alış anında), olmasa
    // cari FX məzənnəsi ilə hesablama. Heç biri etibarlı deyilsə (snapshot
    // 0 və priceTryCents 0/null), və ya hesablanan maya alış məbləğindən
    // böyükdürsə (köhnə FX məzənnəsi pozulub) → naməlum siyahısına düşür.
    let cost = 0;
    let costKnown = false;
    if (row.costAznCents > 0) {
      cost = row.costAznCents;
      costKnown = true;
    } else if (row.game.priceTryCents > 0) {
      cost = Math.round(tryCentsToCostAzn(row.game.priceTryCents, settings) * 100);
      // Cari rate ilə hesablanan maya alış məbləğindən çox olarsa, FX
      // dəyişib və ya scrape pozulub — etibarsız.
      if (cost <= revenue) {
        costKnown = true;
      } else {
        cost = 0;
      }
    }

    if (costKnown) {
      const profit = revenue - cost;
      bucket.revenueAznCents += revenue;
      bucket.costAznCents += cost;
      bucket.profitAznCents += profit;
      bucket.orderCount += 1;
      profitTotals.revenue += revenue;
      profitTotals.cost += cost;
      profitTotals.profit += profit;
      profitTotals.orders += 1;
    } else {
      unknownRevenue += revenue;
      unknownOrders += 1;
      const existing = unknownGameMap.get(row.game.id);
      if (existing) {
        existing.orderCount += 1;
        existing.revenueAznCents += revenue;
      } else {
        unknownGameMap.set(row.game.id, {
          gameId: row.game.id,
          title: row.game.title,
          orderCount: 1,
          revenueAznCents: revenue,
        });
      }
    }
  }
  const profitDays = Array.from(buckets.values()).sort((a, b) =>
    a.date < b.date ? -1 : 1,
  );
  const unknownGames = Array.from(unknownGameMap.values()).sort(
    (a, b) => b.orderCount - a.orderCount,
  );

  const grossRevenue = Math.abs(purchases._sum.amountAznCents ?? 0);

  const cards = [
    {
      label: "Cəmi istifadəçi",
      value: totalUsers.toLocaleString(),
      icon: Users,
      tint: "text-violet-700 bg-violet-500/10 ring-violet-500/30",
      sub: `${verifiedUsers} təsdiqlənib`,
    },
    {
      label: "Təsdiq gözləyir",
      value: pendingVerifications.toLocaleString(),
      icon: ShieldAlert,
      tint: "text-amber-700 bg-amber-500/10 ring-amber-500/30",
      sub: "OTP təsdiqi gözlənilir",
    },
    {
      label: "Ümumi dövriyyə",
      value: fmtAzn(grossRevenue),
      icon: TrendingUp,
      tint: "text-emerald-700 bg-emerald-500/10 ring-emerald-500/30",
      sub: `${purchases._count} alış`,
    },
    {
      label: "Depozitlər",
      value: fmtAzn(deposits._sum.amountAznCents),
      icon: Wallet,
      tint: "text-fuchsia-700 bg-fuchsia-500/10 ring-fuchsia-500/30",
      sub: `${deposits._count} mədaxil`,
    },
    {
      label: "Cüzdanlardakı qalıq",
      value: fmtAzn(walletAgg._sum.walletBalance),
      icon: ShoppingCart,
      tint: "text-cyan-700 bg-cyan-500/10 ring-cyan-500/30",
      sub: "ümumi balans",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">İdarə paneli</h1>
        <p className="text-sm text-zinc-600">
          Mağazanın anlıq vəziyyəti — istifadəçilər, satışlar və mənfəət.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ label, value, icon: Icon, tint, sub }) => (
          <div
            key={label}
            className="rounded-xl border border-admin-line bg-admin-card p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-zinc-500">
                {label}
              </span>
              <span
                className={`grid h-8 w-8 place-items-center rounded-md ring-1 ${tint}`}
              >
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 text-2xl font-semibold">{value}</div>
            <div className="mt-1 text-xs text-zinc-500">{sub}</div>
          </div>
        ))}
      </div>

      <GamesProfitChart
        days={profitDays}
        totals={profitTotals}
        unknown={{
          orderCount: unknownOrders,
          revenueAznCents: unknownRevenue,
          games: unknownGames,
        }}
      />
    </div>
  );
}
