import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Hash, Wallet, Calendar } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { fmtAzn, fmtDate } from "@/lib/format";
import RoleToggle from "./RoleToggle";
import UserAdminActions from "./UserAdminActions";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await prisma.user.findUnique({
    where: { id: params.id },
    include: {
      referredBy: {
        select: { id: true, email: true, name: true, referralCode: true },
      },
      referrals: {
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          emailVerified: true,
          walletBalance: true,
        },
        orderBy: { createdAt: "desc" },
      },
      transactions: {
        orderBy: { createdAt: "desc" },
        include: {
          game: { select: { title: true, platform: true } },
          psnAccount: { select: { label: true, psnEmail: true } },
        },
      },
      commissions: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { email: true } } },
      },
    },
  });

  if (!user) notFound();

  const purchases = user.transactions.filter((t) => t.type === "PURCHASE");
  const deposits = user.transactions.filter((t) => t.type === "DEPOSIT");

  const purchasedTotal = purchases.reduce(
    (sum, t) => sum + Math.abs(t.amountAznCents),
    0
  );
  const depositedTotal = deposits.reduce(
    (sum, t) => sum + t.amountAznCents,
    0
  );

  return (
    <div className="space-y-6">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200"
      >
        <ArrowLeft className="h-4 w-4" /> All users
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
        <div>
          <h1 className="text-2xl font-semibold">
            {user.name ?? user.email}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-400">
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-4 w-4" />
              {user.email}
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono">
              <Hash className="h-4 w-4" />
              {user.referralCode}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              Joined {fmtDate(user.createdAt)}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {user.emailVerified ? (
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/30">
                Email verified
              </span>
            ) : (
              <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300 ring-1 ring-amber-500/30">
                Email pending
              </span>
            )}
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
                user.role === "ADMIN"
                  ? "bg-indigo-500/15 text-indigo-300 ring-indigo-500/30"
                  : "bg-zinc-800 text-zinc-300 ring-zinc-700"
              }`}
            >
              {user.role}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <RoleToggle userId={user.id} role={user.role} />
          <UserAdminActions
            userId={user.id}
            email={user.email}
            walletBalance={user.walletBalance}
            cashbackBalanceCents={user.cashbackBalanceCents}
            referralBalanceCents={user.referralBalanceCents}
            referralCode={user.referralCode}
            referredByCode={user.referredBy?.referralCode ?? null}
          />
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Wallet balance"
          value={fmtAzn(user.walletBalance)}
          icon={<Wallet className="h-4 w-4" />}
          tint="text-cyan-300 bg-cyan-500/10 ring-cyan-500/30"
        />
        <Stat
          label="Cashback"
          value={fmtAzn(user.cashbackBalanceCents)}
          tint="text-emerald-300 bg-emerald-500/10 ring-emerald-500/30"
        />
        <Stat
          label="Referral balance"
          value={fmtAzn(user.referralBalanceCents)}
          tint="text-amber-300 bg-amber-500/10 ring-amber-500/30"
        />
        <Stat
          label="Total deposited"
          value={fmtAzn(depositedTotal)}
          tint="text-fuchsia-300 bg-fuchsia-500/10 ring-fuchsia-500/30"
        />
        <Stat
          label="Total spent"
          value={fmtAzn(purchasedTotal)}
          tint="text-indigo-300 bg-indigo-500/10 ring-indigo-500/30"
        />
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40">
        <header className="border-b border-zinc-800 px-5 py-3">
          <h2 className="text-sm font-semibold">Affiliate</h2>
        </header>
        <div className="grid grid-cols-1 gap-6 p-5 md:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-500">
              Referred by
            </div>
            {user.referredBy ? (
              <Link
                href={`/admin/users/${user.referredBy.id}`}
                className="mt-2 flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm hover:border-indigo-500/40"
              >
                <div>
                  <div>{user.referredBy.name ?? user.referredBy.email}</div>
                  <div className="text-xs text-zinc-500">
                    {user.referredBy.email}
                  </div>
                </div>
                <span className="font-mono text-xs text-zinc-400">
                  {user.referredBy.referralCode}
                </span>
              </Link>
            ) : (
              <div className="mt-2 text-sm text-zinc-500">
                Joined directly — no referrer.
              </div>
            )}
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-500">
              Referred users ({user.referrals.length})
            </div>
            {user.referrals.length === 0 ? (
              <div className="mt-2 text-sm text-zinc-500">
                Nobody has used this referral code yet.
              </div>
            ) : (
              <ul className="mt-2 divide-y divide-zinc-900 rounded-md border border-zinc-800 bg-zinc-950">
                {user.referrals.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/admin/users/${r.id}`}
                      className="flex items-center justify-between px-3 py-2 text-sm hover:bg-zinc-900"
                    >
                      <div className="min-w-0">
                        <div className="truncate">
                          {r.name ?? r.email}
                        </div>
                        <div className="truncate text-xs text-zinc-500">
                          {r.email} · {fmtDate(r.createdAt)}
                        </div>
                      </div>
                      <span
                        className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] ring-1 ${
                          r.emailVerified
                            ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                            : "bg-amber-500/15 text-amber-300 ring-amber-500/30"
                        }`}
                      >
                        {r.emailVerified ? "Verified" : "Pending"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40">
        <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
          <h2 className="text-sm font-semibold">
            Purchases ({purchases.length})
          </h2>
        </header>
        {purchases.length === 0 ? (
          <p className="px-5 py-6 text-sm text-zinc-500">No purchases yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/60 text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <Th>Game</Th>
                <Th>Platform</Th>
                <Th>PSN account</Th>
                <Th>Status</Th>
                <Th>Amount</Th>
                <Th>Date</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {purchases.map((t) => (
                <tr key={t.id}>
                  <Td>{t.game?.title ?? "—"}</Td>
                  <Td className="text-zinc-400">{t.game?.platform ?? "—"}</Td>
                  <Td className="text-zinc-400">
                    {t.psnAccount
                      ? `${t.psnAccount.label} (${t.psnAccount.psnEmail})`
                      : "—"}
                  </Td>
                  <Td>
                    <StatusBadge status={t.status} />
                  </Td>
                  <Td className="font-medium text-rose-300">
                    −{fmtAzn(Math.abs(t.amountAznCents))}
                  </Td>
                  <Td className="text-zinc-400">{fmtDate(t.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40">
        <header className="border-b border-zinc-800 px-5 py-3">
          <h2 className="text-sm font-semibold">
            Deposits & commissions ({deposits.length + user.commissions.length})
          </h2>
        </header>
        {deposits.length + user.commissions.length === 0 ? (
          <p className="px-5 py-6 text-sm text-zinc-500">
            No wallet activity yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/60 text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <Th>Type</Th>
                <Th>Source</Th>
                <Th>Status</Th>
                <Th>Amount</Th>
                <Th>Date</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {[...deposits, ...user.commissions]
                .sort(
                  (a, b) =>
                    b.createdAt.getTime() - a.createdAt.getTime()
                )
                .map((t) => (
                  <tr key={t.id}>
                    <Td>
                      <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-300 ring-1 ring-zinc-700">
                        {t.type}
                      </span>
                    </Td>
                    <Td className="text-zinc-400">
                      {t.type === "COMMISSION" && "user" in t && t.user
                        ? `from ${t.user.email}`
                        : t.metadata ?? "—"}
                    </Td>
                    <Td>
                      <StatusBadge status={t.status} />
                    </Td>
                    <Td className="font-medium text-emerald-300">
                      +{fmtAzn(t.amountAznCents)}
                    </Td>
                    <Td className="text-zinc-400">{fmtDate(t.createdAt)}</Td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  tint,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  tint: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-zinc-500">
          {label}
        </span>
        {icon && (
          <span className={`grid h-7 w-7 place-items-center rounded-md ring-1 ${tint}`}>
            {icon}
          </span>
        )}
      </div>
      <div className="mt-2 text-lg font-semibold">{value}</div>
    </div>
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

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 text-left font-medium">{children}</th>;
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-2 align-top ${className}`}>{children}</td>;
}
