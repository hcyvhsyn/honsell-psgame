import Link from "next/link";
import { Download, ShieldAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { fmtAzn, fmtDate } from "@/lib/format";
import { CopyPhoneButton, UserRowActions } from "./UserRowActions";
import CreateUserButton from "./CreateUserButton";
import UsersFiltersBar from "./UsersFiltersBar";
import SortHeader from "./SortHeader";
import PageSizeSelect from "./PageSizeSelect";
import {
  BulkActionBar,
  HeaderCheckbox,
  RowCheckbox,
  UsersSelectionProvider,
} from "./UsersBulkBar";

export const dynamic = "force-dynamic";

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const ACTIVE_DAYS = 30;
const VALID_SORTS = ["createdAt", "wallet", "spent", "referrals", "orders", "lastActivity"] as const;
type SortKey = (typeof VALID_SORTS)[number];

type RawSearchParams = { [key: string]: string | string[] | undefined };

function pickStr(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

function parse(sp: RawSearchParams) {
  const q = pickStr(sp.q).trim();
  const statusRaw = pickStr(sp.status);
  const status = ["verified", "pending", "disabled"].includes(statusRaw) ? statusRaw : "";
  const roleRaw = pickStr(sp.role);
  const role = ["admin", "user"].includes(roleRaw) ? roleRaw : "";
  const hasOrdersRaw = pickStr(sp.hasOrders);
  const hasOrders = ["yes", "no"].includes(hasOrdersRaw) ? hasOrdersRaw : "";
  const walletMinStr = pickStr(sp.walletMin).trim();
  const walletMaxStr = pickStr(sp.walletMax).trim();
  const walletMin = walletMinStr === "" ? NaN : Number(walletMinStr);
  const walletMax = walletMaxStr === "" ? NaN : Number(walletMaxStr);
  const fromStr = pickStr(sp.from);
  const toStr = pickStr(sp.to);
  const from = fromStr ? new Date(fromStr) : null;
  const to = toStr ? new Date(toStr + "T23:59:59") : null;
  const sortRaw = pickStr(sp.sort) as SortKey;
  const sort: SortKey = VALID_SORTS.includes(sortRaw) ? sortRaw : "createdAt";
  const dir = pickStr(sp.dir) === "asc" ? "asc" : "desc";
  const pageSizeNum = Number(pickStr(sp.pageSize));
  const pageSize = PAGE_SIZE_OPTIONS.includes(pageSizeNum) ? pageSizeNum : 25;
  const page = Math.max(1, Number(pickStr(sp.page)) || 1);
  return {
    q,
    status,
    role,
    hasOrders,
    walletMin,
    walletMax,
    from,
    to,
    sort,
    dir: dir as "asc" | "desc",
    pageSize,
    page,
  };
}

function buildWhere(f: ReturnType<typeof parse>) {
  const where: Record<string, unknown> = {};
  if (f.q) {
    where.OR = [
      { email: { contains: f.q, mode: "insensitive" } },
      { name: { contains: f.q, mode: "insensitive" } },
      { phone: { contains: f.q } },
      { referralCode: { contains: f.q.toUpperCase() } },
    ];
  }
  if (f.status === "verified") where.emailVerified = true;
  else if (f.status === "pending") where.emailVerified = false;
  else if (f.status === "disabled") where.disabled = true;
  if (f.role === "admin") where.role = "ADMIN";
  else if (f.role === "user") where.role = "USER";

  const wallet: Record<string, number> = {};
  if (Number.isFinite(f.walletMin)) wallet.gte = Math.round(f.walletMin * 100);
  if (Number.isFinite(f.walletMax)) wallet.lte = Math.round(f.walletMax * 100);
  if (Object.keys(wallet).length) where.walletBalance = wallet;

  const created: Record<string, Date> = {};
  if (f.from && !isNaN(f.from.getTime())) created.gte = f.from;
  if (f.to && !isNaN(f.to.getTime())) created.lte = f.to;
  if (Object.keys(created).length) where.createdAt = created;

  return where;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: RawSearchParams;
}) {
  const f = parse(searchParams);
  const where = buildWhere(f);

  // ── If hasOrders or aggregate sort is in play, pre-fetch ID set from aggregates ──
  const needsAggregateGroup =
    f.hasOrders !== "" ||
    f.sort === "spent" ||
    f.sort === "orders" ||
    f.sort === "lastActivity";

  let aggregateIds: string[] | null = null;
  if (needsAggregateGroup) {
    const grouped = await prisma.transaction.groupBy({
      by: ["userId"],
      where: {
        status: "SUCCESS",
        type: { in: ["PURCHASE", "SERVICE_PURCHASE"] },
      },
      _sum: { amountAznCents: true },
      _count: { _all: true },
      _max: { createdAt: true },
    });

    if (f.hasOrders === "yes") {
      aggregateIds = grouped.map((g) => g.userId);
      where.id = { in: aggregateIds };
    } else if (f.hasOrders === "no") {
      const buyerIds = grouped.map((g) => g.userId);
      where.id = { notIn: buyerIds };
    }
  }

  // ── KPI cards (always reflect filter scope) ─────────────────────────────────
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const activeCutoff = new Date(Date.now() - ACTIVE_DAYS * 24 * 60 * 60 * 1000);

  const [
    total,
    thisMonthCount,
    walletAgg,
    spentAgg,
    activeUserGrouped,
    disabledCount,
    pendingCount,
  ] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.count({ where: { ...where, createdAt: { gte: monthStart } } }),
    prisma.user.aggregate({ where, _sum: { walletBalance: true } }),
    prisma.transaction.aggregate({
      where: {
        status: "SUCCESS",
        type: { in: ["PURCHASE", "SERVICE_PURCHASE"] },
        user: { is: where },
      },
      _sum: { amountAznCents: true },
    }),
    prisma.transaction.groupBy({
      by: ["userId"],
      where: {
        createdAt: { gte: activeCutoff },
        status: "SUCCESS",
        type: { in: ["PURCHASE", "SERVICE_PURCHASE"] },
        user: { is: where },
      },
    }),
    prisma.user.count({ where: { ...where, disabled: true } }),
    prisma.user.count({ where: { ...where, emailVerified: false } }),
  ]);

  // ── Determine sort+pagination ───────────────────────────────────────────────
  let users: Array<{
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
    role: string;
    emailVerified: boolean;
    disabled: boolean;
    walletBalance: number;
    referralCode: string;
    createdAt: Date;
    _count: { referrals: number };
  }> = [];

  const skip = (f.page - 1) * f.pageSize;

  if (f.sort === "spent" || f.sort === "orders" || f.sort === "lastActivity") {
    // Aggregate-sort path: fetch ID list ordered by aggregate, then fetch user rows
    const all = await prisma.transaction.groupBy({
      by: ["userId"],
      where: {
        status: "SUCCESS",
        type: { in: ["PURCHASE", "SERVICE_PURCHASE"] },
        user: { is: where },
      },
      _sum: { amountAznCents: true },
      _count: { _all: true },
      _max: { createdAt: true },
    });

    // Users without any matching transactions still appear at the bottom.
    const nonBuyerIds: string[] = [];
    if (f.hasOrders !== "yes") {
      const buyerSet = new Set(all.map((g) => g.userId));
      const nonBuyers = await prisma.user.findMany({
        where: { ...where, id: { notIn: Array.from(buyerSet) } },
        select: { id: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      });
      for (const u of nonBuyers) nonBuyerIds.push(u.id);
    }

    type Row = { userId: string; metric: number };
    const rows: Row[] = all.map((g) => ({
      userId: g.userId,
      metric:
        f.sort === "spent"
          ? Math.abs(g._sum.amountAznCents ?? 0)
          : f.sort === "orders"
            ? g._count._all
            : g._max.createdAt
              ? g._max.createdAt.getTime()
              : 0,
    }));

    rows.sort((a, b) => (f.dir === "asc" ? a.metric - b.metric : b.metric - a.metric));

    const orderedIds = [
      ...rows.map((r) => r.userId),
      ...(f.dir === "asc" ? nonBuyerIds : nonBuyerIds.slice().reverse()),
    ];

    const pageIds = orderedIds.slice(skip, skip + f.pageSize);

    if (pageIds.length > 0) {
      const fetched = await prisma.user.findMany({
        where: { id: { in: pageIds } },
        include: { _count: { select: { referrals: true } } },
      });
      const byId = new Map(fetched.map((u) => [u.id, u]));
      users = pageIds.map((id) => byId.get(id)!).filter(Boolean);
    }
  } else {
    const orderBy: Record<string, unknown> =
      f.sort === "wallet"
        ? { walletBalance: f.dir }
        : f.sort === "referrals"
          ? { referrals: { _count: f.dir } }
          : { createdAt: f.dir };

    users = await prisma.user.findMany({
      where,
      orderBy,
      take: f.pageSize,
      skip,
      include: { _count: { select: { referrals: true } } },
    });
  }

  // ── Per-page aggregates: spent, order count, last activity ──────────────────
  const ids = users.map((u) => u.id);
  const aggRows = ids.length
    ? await prisma.transaction.groupBy({
        by: ["userId"],
        where: {
          userId: { in: ids },
          status: "SUCCESS",
          type: { in: ["PURCHASE", "SERVICE_PURCHASE"] },
        },
        _sum: { amountAznCents: true },
        _count: { _all: true },
        _max: { createdAt: true },
      })
    : [];
  const aggByUser = new Map<
    string,
    { spent: number; orders: number; lastActivity: Date | null }
  >();
  for (const r of aggRows) {
    aggByUser.set(r.userId, {
      spent: Math.abs(r._sum.amountAznCents ?? 0),
      orders: r._count._all,
      lastActivity: r._max.createdAt,
    });
  }

  // ── Suspicious indicator: duplicate phones in the visible page ──────────────
  const phoneDupGrouped = ids.length
    ? await prisma.user.groupBy({
        by: ["phone"],
        where: { phone: { in: users.map((u) => u.phone).filter((p): p is string => !!p) } },
        _count: { _all: true },
        having: { phone: { _count: { gt: 1 } } },
      })
    : [];
  const duplicatePhones = new Set(phoneDupGrouped.map((g) => g.phone).filter((p): p is string => !!p));

  const totalPages = Math.max(1, Math.ceil(total / f.pageSize));
  const activeCount = activeUserGrouped.length;

  const exportParams = new URLSearchParams();
  if (f.q) exportParams.set("q", f.q);
  if (f.status) exportParams.set("status", f.status);
  if (f.role) exportParams.set("role", f.role);
  if (f.from) exportParams.set("from", pickStr(searchParams.from));
  if (f.to) exportParams.set("to", pickStr(searchParams.to));

  const visibleIds = users.map((u) => u.id);

  return (
    <UsersSelectionProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Users</h1>
            <p className="text-sm text-zinc-600">
              {total.toLocaleString()} {total === 1 ? "user" : "users"} matched.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`/api/admin/users/export?${exportParams.toString()}`}
              className="inline-flex items-center gap-2 rounded-md border border-admin-line px-3 py-2 text-sm font-medium text-zinc-800 transition hover:bg-admin-chip"
              title="CSV ixrac"
            >
              <Download className="h-4 w-4" />
              CSV
            </a>
            <CreateUserButton />
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi label="Cəmi" value={total.toLocaleString()} />
          <Kpi label="Bu ay" value={thisMonthCount.toLocaleString()} tone="indigo" />
          <Kpi label={`Aktiv (${ACTIVE_DAYS} g)`} value={activeCount.toLocaleString()} tone="emerald" />
          <Kpi label="Cüzdan cəmi" value={fmtAzn(walletAgg._sum.walletBalance ?? 0)} />
          <Kpi
            label="Cəmi xərclənmiş"
            value={fmtAzn(Math.abs(spentAgg._sum.amountAznCents ?? 0))}
          />
          <Kpi
            label="Pending / Blok"
            value={`${pendingCount} / ${disabledCount}`}
            tone={disabledCount > 0 ? "rose" : "amber"}
          />
        </div>

        {/* Filters */}
        <UsersFiltersBar />

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-admin-line">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-admin-card text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="w-10 px-4 py-3">
                  <HeaderCheckbox ids={visibleIds} />
                </th>
                <th className="px-4 py-3 text-left font-medium">İstifadəçi</th>
                <th className="px-4 py-3 text-left font-medium">Nömrə</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <SortHeader label="Cüzdan" field="wallet" />
                <SortHeader label="Xərclənmiş" field="spent" />
                <SortHeader label="Sifariş" field="orders" />
                <SortHeader label="Referal" field="referrals" />
                <SortHeader label="Son aktivlik" field="lastActivity" />
                <SortHeader label="Qeydiyyat" field="createdAt" />
                <th className="px-4 py-3 text-right font-medium">Əməliyyat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-line">
              {users.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-5 py-12 text-center text-zinc-500">
                    Bu filtrə uyğun istifadəçi tapılmadı.
                  </td>
                </tr>
              )}
              {users.map((u) => {
                const agg = aggByUser.get(u.id);
                const isDupPhone = !!u.phone && duplicatePhones.has(u.phone);
                return (
                  <tr key={u.id} className="hover:bg-admin-chip">
                    <td className="px-4 py-3 align-top">
                      <RowCheckbox id={u.id} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Link href={`/admin/users/${u.id}`} className="block min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-zinc-900">
                            {u.name ?? <span className="text-zinc-500">—</span>}
                          </span>
                          {isDupPhone && (
                            <span
                              title="Bu telefon nömrəsi birdən çox hesabda istifadə olunub"
                              className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-500/30"
                            >
                              <ShieldAlert className="h-3 w-3" />
                              dup
                            </span>
                          )}
                        </div>
                        <div className="truncate text-xs text-zinc-500">{u.email}</div>
                        <div className="mt-0.5 inline-block rounded bg-admin-card px-1.5 py-0.5 font-mono text-[10px] text-zinc-600 ring-1 ring-admin-line">
                          {u.referralCode}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 align-top text-zinc-700">
                      {u.phone ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs">{u.phone}</span>
                          <CopyPhoneButton phone={u.phone} />
                        </div>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col gap-1">
                        {u.disabled ? (
                          <span className="self-start rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-medium text-rose-700 ring-1 ring-rose-500/30">
                            Bloklanıb
                          </span>
                        ) : u.emailVerified ? (
                          <span className="self-start rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-500/30">
                            Verified
                          </span>
                        ) : (
                          <span className="self-start rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-500/30">
                            Pending
                          </span>
                        )}
                        {u.role === "ADMIN" && (
                          <span className="self-start rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-violet-500/30">
                            Admin
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">{fmtAzn(u.walletBalance)}</td>
                    <td className="px-4 py-3 align-top text-zinc-700">
                      {fmtAzn(agg?.spent ?? 0)}
                    </td>
                    <td className="px-4 py-3 align-top text-zinc-700">{agg?.orders ?? 0}</td>
                    <td className="px-4 py-3 align-top">{u._count.referrals}</td>
                    <td className="px-4 py-3 align-top text-zinc-600">
                      {agg?.lastActivity ? fmtDate(agg.lastActivity) : <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="px-4 py-3 align-top text-zinc-600">{fmtDate(u.createdAt)}</td>
                    <td className="px-4 py-3 text-right align-top">
                      <UserRowActions
                        userId={u.id}
                        email={u.email}
                        phone={u.phone}
                        name={u.name}
                        role={u.role}
                        disabled={u.disabled}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination + page size */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-600">
          <PageSizeSelect value={f.pageSize} />
          <div className="flex items-center gap-3">
            <span>
              Page {f.page} / {totalPages}
            </span>
            <div className="flex gap-2">
              {f.page > 1 && (
                <PageLink searchParams={searchParams} page={f.page - 1} label="← Previous" />
              )}
              {f.page < totalPages && (
                <PageLink searchParams={searchParams} page={f.page + 1} label="Next →" />
              )}
            </div>
          </div>
        </div>

        <BulkActionBar />
      </div>
    </UsersSelectionProvider>
  );
}

function PageLink({
  searchParams,
  page,
  label,
}: {
  searchParams: RawSearchParams;
  page: number;
  label: string;
}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (typeof v === "string" && v) params.set(k, v);
  }
  params.set("page", String(page));
  return (
    <Link
      href={`/admin/users?${params.toString()}`}
      className="rounded-md border border-admin-line px-3 py-1.5 hover:bg-admin-chip"
    >
      {label}
    </Link>
  );
}

function Kpi({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "indigo" | "emerald" | "amber" | "rose";
}) {
  const ring =
    tone === "indigo"
      ? "ring-violet-500/20"
      : tone === "emerald"
        ? "ring-emerald-500/20"
        : tone === "amber"
          ? "ring-amber-500/20"
          : tone === "rose"
            ? "ring-rose-500/20"
            : "ring-admin-line";
  return (
    <div className={`rounded-xl border border-admin-line bg-admin-card p-3 ring-1 ${ring}`}>
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-zinc-900">{value}</div>
    </div>
  );
}
