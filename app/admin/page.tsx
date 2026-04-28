import Link from "next/link";
import {
  Users,
  ShieldAlert,
  Wallet,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { fmtAzn, fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [
    totalUsers,
    verifiedUsers,
    pendingVerifications,
    purchases,
    deposits,
    walletAgg,
    recentUsers,
    recentTx,
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
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        createdAt: true,
      },
    }),
    prisma.transaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        user: { select: { email: true } },
        game: { select: { title: true } },
      },
    }),
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40">
          <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
            <h2 className="text-sm font-semibold">Newest users</h2>
            <Link href="/admin/users" className="text-xs text-indigo-400 hover:text-indigo-300">
              View all →
            </Link>
          </header>
          <ul className="divide-y divide-zinc-800">
            {recentUsers.length === 0 && (
              <li className="px-5 py-4 text-sm text-zinc-500">No users yet.</li>
            )}
            {recentUsers.map((u) => (
              <li key={u.id}>
                <Link
                  href={`/admin/users/${u.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-zinc-900"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {u.name ?? u.email}
                    </div>
                    <div className="truncate text-xs text-zinc-500">{u.email}</div>
                  </div>
                  <div className="flex items-center gap-3 whitespace-nowrap">
                    {u.emailVerified ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300 ring-1 ring-emerald-500/30">
                        Verified
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300 ring-1 ring-amber-500/30">
                        Pending
                      </span>
                    )}
                    <span className="text-xs text-zinc-500">{fmtDate(u.createdAt)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40">
          <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
            <h2 className="text-sm font-semibold">Recent transactions</h2>
            <Link href="/admin/transactions" className="text-xs text-indigo-400 hover:text-indigo-300">
              View all →
            </Link>
          </header>
          <ul className="divide-y divide-zinc-800">
            {recentTx.length === 0 && (
              <li className="px-5 py-4 text-sm text-zinc-500">No transactions yet.</li>
            )}
            {recentTx.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <TypeBadge type={t.type} />
                    <span className="truncate text-zinc-200">
                      {t.game?.title ?? t.user.email}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500">{fmtDate(t.createdAt)}</div>
                </div>
                <div
                  className={`text-sm font-semibold ${
                    t.amountAznCents < 0 ? "text-rose-300" : "text-emerald-300"
                  }`}
                >
                  {t.amountAznCents < 0 ? "−" : "+"}
                  {fmtAzn(Math.abs(t.amountAznCents))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    DEPOSIT: "bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-500/30",
    PURCHASE: "bg-indigo-500/15 text-indigo-300 ring-indigo-500/30",
    COMMISSION: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${
        map[type] ?? "bg-zinc-800 text-zinc-300 ring-zinc-700"
      }`}
    >
      {type}
    </span>
  );
}
