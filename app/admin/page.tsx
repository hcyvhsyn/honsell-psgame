import {
  Users,
  ShieldAlert,
  Wallet,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { fmtAzn } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [
    totalUsers,
    verifiedUsers,
    pendingVerifications,
    purchases,
    deposits,
    walletAgg,
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
  ]);

  // Negative purchase amounts (debits) — flip sign for display.
  const grossRevenue = Math.abs(purchases._sum.amountAznCents ?? 0);

  const cards = [
    {
      label: "Total users",
      value: totalUsers.toLocaleString(),
      icon: Users,
      tint: "text-indigo-300 bg-indigo-500/10 ring-indigo-500/30",
      sub: `${verifiedUsers} verified`,
    },
    {
      label: "Pending verification",
      value: pendingVerifications.toLocaleString(),
      icon: ShieldAlert,
      tint: "text-amber-300 bg-amber-500/10 ring-amber-500/30",
      sub: "awaiting OTP",
    },
    {
      label: "Gross revenue",
      value: fmtAzn(grossRevenue),
      icon: TrendingUp,
      tint: "text-emerald-300 bg-emerald-500/10 ring-emerald-500/30",
      sub: `${purchases._count} purchases`,
    },
    {
      label: "Deposits",
      value: fmtAzn(deposits._sum.amountAznCents),
      icon: Wallet,
      tint: "text-fuchsia-300 bg-fuchsia-500/10 ring-fuchsia-500/30",
      sub: `${deposits._count} top-ups`,
    },
    {
      label: "Outstanding wallets",
      value: fmtAzn(walletAgg._sum.walletBalance),
      icon: ShoppingCart,
      tint: "text-cyan-300 bg-cyan-500/10 ring-cyan-500/30",
      sub: "total balance held",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-zinc-400">Snapshot of the store at a glance.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ label, value, icon: Icon, tint, sub }) => (
          <div
            key={label}
            className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5"
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

    </div>
  );
}
