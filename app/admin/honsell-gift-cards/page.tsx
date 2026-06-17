import Link from "next/link";
import { Gift, Search } from "lucide-react";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  HONSELL_GIFT_CARD_SERVICE_TYPE,
  formatHonsellGiftCardCode,
  normalizeHonsellGiftCardCode,
} from "@/lib/honsellGiftCard";
import HonsellProductsAdmin from "./HonsellProductsAdmin";
import PendingGiftCardsDelivery from "./PendingGiftCardsDelivery";

export const dynamic = "force-dynamic";

type Search = {
  q?: string;
  status?: string;
};

export default async function HonsellGiftCardsAdminPage({
  searchParams,
}: {
  searchParams?: Search;
}) {
  const rawQ = (searchParams?.q ?? "").trim();
  const rawStatus = searchParams?.status?.toUpperCase();
  const statusFilter =
    rawStatus === "REDEEMED"
      ? "REDEEMED"
      : rawStatus === "ACTIVE"
        ? "ACTIVE"
        : rawStatus === "PENDING"
          ? "PENDING"
          : null;

  const where: Prisma.HonsellGiftCardWhereInput = {};
  if (statusFilter) where.status = statusFilter;
  if (rawQ) {
    const normalized = normalizeHonsellGiftCardCode(rawQ);
    where.OR = [
      { code: { contains: normalized, mode: "insensitive" } },
      { purchasedBy: { email: { contains: rawQ, mode: "insensitive" } } },
      { redeemedBy: { email: { contains: rawQ, mode: "insensitive" } } },
    ];
  }

  const products = await prisma.serviceProduct.findMany({
    where: { type: HONSELL_GIFT_CARD_SERVICE_TYPE },
    orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
  });

  const [cards, totals, pendingCards] = await Promise.all([
    prisma.honsellGiftCard.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        purchasedBy: { select: { id: true, email: true, name: true } },
        redeemedBy: { select: { id: true, email: true, name: true } },
      },
    }),
    prisma.honsellGiftCard.groupBy({
      by: ["status"],
      _count: { _all: true },
      _sum: { amountAznCents: true },
    }),
    prisma.honsellGiftCard.findMany({
      where: { status: "PENDING" },
      orderBy: { purchasedAt: "asc" },
      include: { purchasedBy: { select: { email: true, name: true } } },
    }),
  ]);

  const summary = {
    pending: { count: 0, amount: 0 },
    active: { count: 0, amount: 0 },
    redeemed: { count: 0, amount: 0 },
  };
  for (const t of totals) {
    const bucket =
      t.status === "ACTIVE"
        ? summary.active
        : t.status === "REDEEMED"
          ? summary.redeemed
          : summary.pending;
    bucket.count = t._count._all;
    bucket.amount = (t._sum.amountAznCents ?? 0) / 100;
  }

  const dateFmt = new Intl.DateTimeFormat("az-AZ", { dateStyle: "medium", timeStyle: "short" });
  const now = Date.now();

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs text-violet-700">
            <Gift className="h-3.5 w-3.5" />
            Honsell Hədiyyə Kartları
          </div>
          <h1 className="mt-2 text-2xl font-bold text-zinc-900">Honsell hədiyyə kartları</h1>
          <p className="text-sm text-zinc-600">
            Bütün alınmış kartlar — kod, məbləğ, alıcı, aktivləşdirən və müddət.
          </p>
        </div>
        <Link
          href="/hediyye-kartlari/honsell"
          className="self-start rounded-lg border border-admin-line px-3 py-1.5 text-xs text-zinc-700 hover:bg-admin-chip"
        >
          Public səhifə →
        </Link>
      </header>

      <PendingGiftCardsDelivery
        cards={pendingCards.map((c) => ({
          id: c.id,
          amountAznCents: c.amountAznCents,
          purchasedAt: c.purchasedAt.toISOString(),
          expiresAt: c.expiresAt.toISOString(),
          purchaser: c.purchasedBy
            ? { email: c.purchasedBy.email, name: c.purchasedBy.name }
            : null,
        }))}
      />

      <HonsellProductsAdmin
        products={products.map((p) => {
          const meta = (p.metadata as Record<string, unknown> | null) ?? null;
          const denomination =
            typeof meta?.denominationAzn === "number"
              ? (meta.denominationAzn as number)
              : p.priceAznCents / 100;
          return {
            id: p.id,
            title: p.title,
            description: p.description,
            imageUrl: p.imageUrl,
            priceAznCents: p.priceAznCents,
            isActive: p.isActive,
            sortOrder: p.sortOrder,
            denominationAzn: denomination,
          };
        })}
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Təslim gözləyir" value={String(summary.pending.count)} sub={`${summary.pending.amount.toFixed(2)} AZN`} tone="amber" />
        <SummaryCard label="Aktiv kartlar" value={String(summary.active.count)} sub={`${summary.active.amount.toFixed(2)} AZN`} tone="violet" />
        <SummaryCard label="Aktivləşdirilmiş" value={String(summary.redeemed.count)} sub={`${summary.redeemed.amount.toFixed(2)} AZN`} tone="emerald" />
        <SummaryCard
          label="Cəmi satılmış"
          value={String(summary.pending.count + summary.active.count + summary.redeemed.count)}
          sub={`${(summary.pending.amount + summary.active.amount + summary.redeemed.amount).toFixed(2)} AZN`}
          tone="zinc"
        />
      </section>

      <form className="flex flex-col gap-3 rounded-2xl border border-admin-line bg-admin-card p-4 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="block text-[11px] uppercase tracking-wider text-zinc-500">Axtarış</span>
          <div className="mt-1 flex items-center gap-2 rounded-lg border border-admin-line bg-admin-card px-3 py-2 focus-within:border-violet-500/60">
            <Search className="h-4 w-4 text-zinc-500" />
            <input
              type="text"
              name="q"
              defaultValue={rawQ}
              placeholder="kod, alıcı email, aktivləşdirən email"
              className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-600"
            />
          </div>
        </label>
        <label>
          <span className="block text-[11px] uppercase tracking-wider text-zinc-500">Status</span>
          <select
            name="status"
            defaultValue={statusFilter ?? ""}
            className="mt-1 rounded-lg border border-admin-line bg-admin-card px-3 py-2 text-sm text-zinc-900 outline-none focus:border-violet-500/60"
          >
            <option value="">Hamısı</option>
            <option value="PENDING">Təslim gözləyir</option>
            <option value="ACTIVE">Aktiv</option>
            <option value="REDEEMED">Aktivləşdirilmiş</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
        >
          Filtrlə
        </button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-admin-line">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-admin-card text-left text-[11px] uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-3 py-2">Kod</th>
              <th className="px-3 py-2">Məbləğ</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Alıcı</th>
              <th className="px-3 py-2">Alındı</th>
              <th className="px-3 py-2">Aktivləşdirən</th>
              <th className="px-3 py-2">Aktivləşdi</th>
              <th className="px-3 py-2">Bitir</th>
            </tr>
          </thead>
          <tbody>
            {cards.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-xs text-zinc-500">
                  Heç bir kart tapılmadı.
                </td>
              </tr>
            )}
            {cards.map((c) => {
              const expired = c.expiresAt.getTime() <= now;
              return (
                <tr key={c.id} className="border-t border-admin-line hover:bg-admin-chip">
                  <td className="px-3 py-2 font-mono text-xs text-zinc-800">
                    {c.code ? formatHonsellGiftCardCode(c.code) : <span className="text-zinc-600">—</span>}
                  </td>
                  <td className="px-3 py-2 font-semibold text-zinc-900">
                    {(c.amountAznCents / 100).toFixed(2)} AZN
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={c.status} expired={expired && c.status === "ACTIVE"} />
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-700">
                    {c.purchasedBy?.email ?? <span className="text-zinc-600">—</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-600">{dateFmt.format(c.purchasedAt)}</td>
                  <td className="px-3 py-2 text-xs text-zinc-700">
                    {c.redeemedBy?.email ?? <span className="text-zinc-600">—</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-600">
                    {c.redeemedAt ? dateFmt.format(c.redeemedAt) : <span className="text-zinc-600">—</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-600">
                    {dateFmt.format(c.expiresAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "violet" | "emerald" | "zinc" | "amber";
}) {
  const toneCls =
    tone === "violet"
      ? "border-violet-500/30 bg-violet-500/10 text-violet-700"
      : tone === "emerald"
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
        : tone === "amber"
          ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
          : "border-admin-line bg-admin-card text-zinc-700";
  return (
    <div className={`rounded-2xl border p-4 ${toneCls}`}>
      <div className="text-[11px] uppercase tracking-wider opacity-80">{label}</div>
      <div className="mt-1 text-xl font-bold text-zinc-900">{value}</div>
      <div className="text-[11px] opacity-80">{sub}</div>
    </div>
  );
}

function StatusBadge({ status, expired }: { status: string; expired: boolean }) {
  if (expired) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 ring-1 ring-amber-500/30">
        Müddəti bitib
      </span>
    );
  }
  if (status === "REDEEMED") {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-500/30">
        Aktivləşdirilib
      </span>
    );
  }
  if (status === "PENDING") {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 ring-1 ring-amber-500/30">
        Təslim gözləyir
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-700 ring-1 ring-violet-500/30">
      Aktiv
    </span>
  );
}
