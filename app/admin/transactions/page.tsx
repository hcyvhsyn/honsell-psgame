import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtAzn, fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;
const TYPES = ["ALL", "DEPOSIT", "PURCHASE", "COMMISSION"] as const;
const STATUSES = ["ALL", "SUCCESS", "PENDING", "FAILED"] as const;

export default async function AdminTransactionsPage({
  searchParams,
}: {
  searchParams: { type?: string; status?: string; page?: string };
}) {
  const type = String(searchParams.type ?? "ALL").toUpperCase();
  const status = String(searchParams.status ?? "ALL").toUpperCase();
  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);

  const where = {
    ...(type !== "ALL" ? { type } : {}),
    ...(status !== "ALL" ? { status } : {}),
  };

  const [total, txs, sumPurchase, sumDeposit, sumCommission] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: {
        user: { select: { id: true, email: true, name: true } },
        game: { select: { title: true, platform: true } },
        beneficiary: { select: { email: true } },
      },
    }),
    prisma.transaction.aggregate({
      where: { ...where, type: "PURCHASE", status: "SUCCESS" },
      _sum: { amountAznCents: true },
    }),
    prisma.transaction.aggregate({
      where: { ...where, type: "DEPOSIT", status: "SUCCESS" },
      _sum: { amountAznCents: true },
    }),
    prisma.transaction.aggregate({
      where: { ...where, type: "COMMISSION", status: "SUCCESS" },
      _sum: { amountAznCents: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function buildHref(overrides: Record<string, string | undefined>) {
    const merged: Record<string, string> = {
      ...(type !== "ALL" ? { type } : {}),
      ...(status !== "ALL" ? { status } : {}),
      page: String(page),
      ...Object.fromEntries(
        Object.entries(overrides).filter(([, v]) => v !== undefined)
      ),
    };
    Object.entries(overrides).forEach(([k, v]) => {
      if (v === undefined || v === "ALL") delete merged[k];
    });
    return `/admin/transactions?${new URLSearchParams(merged).toString()}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <p className="text-sm text-zinc-400">
          {total.toLocaleString()} entries match your filters.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SumCard
          label="Purchases"
          value={fmtAzn(Math.abs(sumPurchase._sum.amountAznCents ?? 0))}
        />
        <SumCard label="Deposits" value={fmtAzn(sumDeposit._sum.amountAznCents)} />
        <SumCard
          label="Commissions"
          value={fmtAzn(sumCommission._sum.amountAznCents)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <FilterRow label="Type" current={type} options={TYPES} build={(v) => buildHref({ type: v, page: "1" })} />
        <FilterRow label="Status" current={status} options={STATUSES} build={(v) => buildHref({ status: v, page: "1" })} />
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/60 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <Th>When</Th>
              <Th>User</Th>
              <Th>Type</Th>
              <Th>Detail</Th>
              <Th>Status</Th>
              <Th className="text-right">Amount</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {txs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-zinc-500">
                  No transactions match these filters.
                </td>
              </tr>
            )}
            {txs.map((t) => (
              <tr key={t.id} className="hover:bg-zinc-900/40">
                <Td className="text-zinc-400">{fmtDate(t.createdAt)}</Td>
                <Td>
                  <Link
                    href={`/admin/users/${t.user.id}`}
                    className="hover:text-indigo-300"
                  >
                    {t.user.name ?? t.user.email}
                  </Link>
                  <div className="text-xs text-zinc-500">{t.user.email}</div>
                </Td>
                <Td>
                  <TypeBadge type={t.type} />
                </Td>
                <Td className="text-zinc-300">
                  {t.type === "PURCHASE" && t.game?.title}
                  {t.type === "COMMISSION" &&
                    t.beneficiary &&
                    `→ ${t.beneficiary.email}`}
                  {t.type === "DEPOSIT" && (t.metadata ?? "Wallet top-up")}
                </Td>
                <Td>
                  <StatusBadge status={t.status} />
                </Td>
                <Td
                  className={`text-right font-medium ${
                    t.amountAznCents < 0 ? "text-rose-300" : "text-emerald-300"
                  }`}
                >
                  {t.amountAznCents < 0 ? "−" : "+"}
                  {fmtAzn(Math.abs(t.amountAznCents))}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-zinc-400">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={buildHref({ page: String(page - 1) })}
                className="rounded-md border border-zinc-800 px-3 py-1.5 hover:bg-zinc-900"
              >
                ← Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildHref({ page: String(page + 1) })}
                className="rounded-md border border-zinc-800 px-3 py-1.5 hover:bg-zinc-900"
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SumCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function FilterRow({
  label,
  current,
  options,
  build,
}: {
  label: string;
  current: string;
  options: readonly string[];
  build: (v: string) => string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <div className="flex gap-1">
        {options.map((opt) => {
          const active = current === opt;
          return (
            <Link
              key={opt}
              href={build(opt)}
              className={`rounded-md px-2.5 py-1 text-xs ring-1 ${
                active
                  ? "bg-indigo-500/15 text-indigo-300 ring-indigo-500/30"
                  : "bg-zinc-900 text-zinc-300 ring-zinc-800 hover:bg-zinc-800"
              }`}
            >
              {opt}
            </Link>
          );
        })}
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    SUCCESS: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    PENDING: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
    FAILED: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
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
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={`px-4 py-3 text-left font-medium ${className}`}>{children}</th>
  );
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
