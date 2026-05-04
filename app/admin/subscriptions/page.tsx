import Link from "next/link";
import { AlertTriangle, Crown, Calendar } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { fmtAzn } from "@/lib/format";

export const dynamic = "force-dynamic";

const TIER_LABEL: Record<string, string> = {
  ESSENTIAL: "Essential",
  EXTRA: "Extra",
  DELUXE: "Deluxe",
};

function fmtDateAz(d: Date): string {
  return new Date(d).toLocaleDateString("az-AZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function daysUntil(d: Date): number {
  const ms = new Date(d).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const filter = searchParams.filter ?? "EXPIRING";

  const now = new Date();
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const where =
    filter === "ALL"
      ? {}
      : filter === "ACTIVE"
        ? { status: "ACTIVE" as const }
        : filter === "EXPIRED"
          ? { status: "EXPIRED" as const }
          : filter === "AUTO_RENEW"
            ? { status: "ACTIVE" as const, autoRenew: true }
            : // EXPIRING (default)
              { status: "ACTIVE" as const, expiresAt: { lte: in3Days } };

  const [total, expiringCount, autoRenewCount, activeCount, subs] = await Promise.all([
    prisma.subscription.count(),
    prisma.subscription.count({
      where: { status: "ACTIVE", expiresAt: { lte: in3Days } },
    }),
    prisma.subscription.count({
      where: { status: "ACTIVE", autoRenew: true },
    }),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.subscription.findMany({
      where,
      orderBy: [{ status: "asc" }, { expiresAt: "asc" }],
      take: 200,
      include: {
        user: { select: { id: true, email: true, name: true, walletBalance: true } },
        serviceProduct: { select: { title: true } },
        psnAccount: { select: { label: true, psnEmail: true } },
      },
    }),
  ]);

  const filters: Array<{ key: string; label: string; count?: number }> = [
    { key: "EXPIRING", label: "3 günə bitir", count: expiringCount },
    { key: "AUTO_RENEW", label: "Avtomatik yenilənir", count: autoRenewCount },
    { key: "ACTIVE", label: "Aktiv", count: activeCount },
    { key: "EXPIRED", label: "Bitmiş" },
    { key: "ALL", label: "Hamısı", count: total },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Crown className="h-6 w-6 text-amber-400" />
          Abunəliklər
        </h1>
        <p className="text-sm text-zinc-400">
          PS Plus abunəliklərinin status və yenilənmə vəziyyəti.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SumCard label="Aktiv" value={activeCount.toString()} />
        <SumCard
          label="3 günə bitir"
          value={expiringCount.toString()}
          accent={expiringCount > 0 ? "amber" : undefined}
        />
        <SumCard label="Avtomatik yenilənir" value={autoRenewCount.toString()} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs uppercase tracking-wider text-zinc-500">
          Filter
        </span>
        {filters.map((f) => {
          const active = filter === f.key;
          return (
            <Link
              key={f.key}
              href={`/admin/subscriptions?filter=${f.key}`}
              className={`rounded-md px-2.5 py-1 text-xs ring-1 ${
                active
                  ? "bg-indigo-500/15 text-indigo-300 ring-indigo-500/30"
                  : "bg-zinc-900 text-zinc-300 ring-zinc-800 hover:bg-zinc-800"
              }`}
            >
              {f.label}
              {typeof f.count === "number" && (
                <span className="ml-1.5 text-zinc-500">({f.count})</span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/60 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <Th>Müştəri</Th>
              <Th>Plan</Th>
              <Th>PSN</Th>
              <Th>Bitir</Th>
              <Th>Auto-renew</Th>
              <Th>Status</Th>
              <Th className="text-right">Qiymət</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {subs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-zinc-500">
                  Bu filterdə abunəlik yoxdur.
                </td>
              </tr>
            )}
            {subs.map((s) => {
              const days = daysUntil(s.expiresAt);
              const expiringSoon = s.status === "ACTIVE" && days <= 3;
              const lowBalance = s.user.walletBalance < s.priceAznCents;
              const renewWillFail = s.autoRenew && expiringSoon && lowBalance;

              return (
                <tr key={s.id} className="hover:bg-zinc-900/40">
                  <Td>
                    <Link
                      href={`/admin/users/${s.user.id}`}
                      className="hover:text-indigo-300"
                    >
                      {s.user.name ?? s.user.email}
                    </Link>
                    <div className="text-xs text-zinc-500">{s.user.email}</div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300 ring-1 ring-amber-500/40">
                        {TIER_LABEL[s.tier] ?? s.tier}
                      </span>
                      <span className="text-xs text-zinc-400">
                        {s.durationMonths} ay
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-500">
                      {s.serviceProduct.title}
                    </div>
                  </Td>
                  <Td className="text-zinc-300">
                    {s.psnAccount ? (
                      <>
                        <div>{s.psnAccount.label}</div>
                        <div className="text-xs text-zinc-500">
                          {s.psnAccount.psnEmail}
                        </div>
                      </>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5 text-zinc-200">
                      <Calendar className="h-3.5 w-3.5 text-zinc-500" />
                      {fmtDateAz(s.expiresAt)}
                    </div>
                    {s.status === "ACTIVE" && (
                      <div
                        className={`mt-0.5 text-xs ${
                          days <= 1
                            ? "text-rose-300"
                            : days <= 3
                              ? "text-amber-300"
                              : "text-zinc-500"
                        }`}
                      >
                        {days <= 0
                          ? "Bu gün bitir"
                          : days === 1
                            ? "Sabah bitir"
                            : `${days} gün qaldı`}
                      </div>
                    )}
                  </Td>
                  <Td>
                    {s.autoRenew ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 ring-1 ring-emerald-500/40">
                        ON
                      </span>
                    ) : (
                      <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400 ring-1 ring-zinc-700">
                        OFF
                      </span>
                    )}
                    {renewWillFail && (
                      <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-rose-300">
                        <AlertTriangle className="h-3 w-3" />
                        Balans az
                      </div>
                    )}
                  </Td>
                  <Td>
                    <StatusBadge status={s.status} />
                  </Td>
                  <Td className="text-right text-zinc-200">
                    {fmtAzn(s.priceAznCents)}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SumCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "amber";
}) {
  const accentClass =
    accent === "amber"
      ? "border-amber-500/40 bg-amber-500/5"
      : "border-zinc-800 bg-zinc-900/40";
  return (
    <div className={`rounded-xl border p-4 ${accentClass}`}>
      <div className="text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    EXPIRED: "bg-zinc-800 text-zinc-400 ring-zinc-700",
    CANCELLED: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${
        map[status] ?? "bg-zinc-800 text-zinc-300 ring-zinc-700"
      }`}
    >
      {status}
    </span>
  );
}

function Th({
  children,
  className = "text-left",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <th className={`px-4 py-3 font-medium ${className}`}>{children}</th>;
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}
