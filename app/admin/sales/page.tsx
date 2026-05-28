import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtAzn, fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;
const TYPES = ["ALL", "GAME", "ADDON", "CURRENCY", "OTHER"] as const;
const SORTS = [
  { value: "soldDesc", label: "Ən çox satılan" },
  { value: "revenueDesc", label: "Ən çox gəlir" },
  { value: "recent", label: "Ən son satış" },
  { value: "alpha", label: "Əlifba" },
] as const;

type SortValue = (typeof SORTS)[number]["value"];

/**
 * Per-game sales analytics. Aggregates Transaction rows (type=PURCHASE,
 * status=SUCCESS) by gameId to compute sold count, total revenue, savings
 * passed to users, and last-sold timestamp. The result is joined with the
 * Game catalog for title / type / platform context.
 *
 * Two-step approach: groupBy in Postgres, then a single follow-up `findMany`
 * for the Game metadata. Filtering by productType and sorting are applied in
 * JS so we don't need to bake the join into raw SQL — at typical store sizes
 * (a few thousand unique titles ever sold) the JS cost is negligible.
 */
export default async function AdminSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; sort?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const productType = String(sp.type ?? "ALL").toUpperCase();
  const sort: SortValue = (SORTS.find((s) => s.value === sp.sort)?.value ?? "soldDesc") as SortValue;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  // Aggregate every PURCHASE/SUCCESS transaction that has a gameId. We pull
  // the full result set — the number of distinct sold games is bounded by
  // the catalog size and well under any pagination concern at this stage.
  // Explicit orderBy is required when groupBy is used; we use sold-count
  // descending so the heaviest sellers always come back first regardless of
  // the JS-level resort applied below.
  const grouped = await prisma.transaction.groupBy({
    by: ["gameId"],
    where: {
      type: "PURCHASE",
      status: "SUCCESS",
      gameId: { not: null },
    },
    _count: { _all: true },
    _sum: { amountAznCents: true, savingsAznCents: true },
    _max: { createdAt: true },
    orderBy: { _count: { gameId: "desc" } },
  });

  const gameIds = grouped
    .map((g) => g.gameId)
    .filter((id): id is string => Boolean(id));

  const games = await prisma.game.findMany({
    where: { id: { in: gameIds } },
    select: {
      id: true,
      title: true,
      productType: true,
      platform: true,
      imageUrl: true,
      priceTryCents: true,
      discountTryCents: true,
      productId: true,
      isActive: true,
    },
  });
  const gameById = new Map(games.map((g) => [g.id, g]));

  type SalesRow = {
    game: (typeof games)[number];
    soldCount: number;
    revenueCents: number;
    savingsCents: number;
    lastSoldAt: Date | null;
    avgSaleCents: number;
  };

  const allRows: SalesRow[] = grouped
    .map((g) => {
      const game = gameById.get(g.gameId!);
      if (!game) return null;
      const count = g._count._all;
      const revenue = g._sum.amountAznCents ?? 0;
      return {
        game,
        soldCount: count,
        revenueCents: revenue,
        savingsCents: g._sum.savingsAznCents ?? 0,
        lastSoldAt: g._max.createdAt ?? null,
        avgSaleCents: count > 0 ? Math.round(revenue / count) : 0,
      } satisfies SalesRow;
    })
    .filter((r): r is SalesRow => r !== null);

  const filteredRows = allRows.filter((r) =>
    productType === "ALL" ? true : r.game.productType === productType,
  );

  filteredRows.sort((a, b) => {
    switch (sort) {
      case "revenueDesc":
        return b.revenueCents - a.revenueCents;
      case "recent":
        return (b.lastSoldAt?.getTime() ?? 0) - (a.lastSoldAt?.getTime() ?? 0);
      case "alpha":
        return a.game.title.localeCompare(b.game.title);
      case "soldDesc":
      default:
        return b.soldCount - a.soldCount;
    }
  });

  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * PAGE_SIZE;
  const slice = filteredRows.slice(offset, offset + PAGE_SIZE);

  // Catalog-wide totals — computed over the FILTERED rows so they reflect the
  // current view (e.g. switching to ADDON shows only DLC totals).
  const totalSold = filteredRows.reduce((acc, r) => acc + r.soldCount, 0);
  const totalRevenue = filteredRows.reduce((acc, r) => acc + r.revenueCents, 0);
  const totalSavings = filteredRows.reduce((acc, r) => acc + r.savingsCents, 0);
  const uniqueGames = filteredRows.length;

  function buildHref(overrides: Record<string, string | undefined>) {
    const merged: Record<string, string> = {
      ...(productType !== "ALL" ? { type: productType } : {}),
      ...(sort !== "soldDesc" ? { sort } : {}),
      ...(safePage > 1 ? { page: String(safePage) } : {}),
      ...Object.fromEntries(
        Object.entries(overrides).filter(([, v]) => v !== undefined),
      ),
    };
    Object.entries(overrides).forEach(([k, v]) => {
      if (v === undefined || v === "ALL" || v === "" || v === "1") delete merged[k];
    });
    const qs = new URLSearchParams(merged).toString();
    return qs ? `/admin/sales?${qs}` : "/admin/sales";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Satışlar</h1>
        <p className="text-sm text-zinc-400">
          Hər oyundan neçə dənə satılıb. {uniqueGames.toLocaleString()} fərqli
          məhsul, ümumi {totalSold.toLocaleString()} ədəd satış.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SumCard label="Ümumi satış" value={totalSold.toLocaleString()} />
        <SumCard label="Fərqli məhsul" value={uniqueGames.toLocaleString()} />
        <SumCard label="Cəm gəlir" value={fmtAzn(totalRevenue)} />
        <SumCard
          label="İstifadəçilərə qənaət"
          value={fmtAzn(totalSavings)}
          accent="emerald"
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
        <FilterRow
          label="Tip"
          current={productType}
          options={TYPES}
          build={(v) => buildHref({ type: v, page: undefined })}
        />
        <FilterRow
          label="Sırala"
          current={sort}
          options={SORTS.map((s) => s.value) as unknown as readonly string[]}
          optionLabels={Object.fromEntries(SORTS.map((s) => [s.value, s.label]))}
          build={(v) => buildHref({ sort: v, page: undefined })}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/60 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <Th>Məhsul</Th>
              <Th>Tip</Th>
              <Th>Platforma</Th>
              <Th className="text-right">Satılıb</Th>
              <Th className="text-right">Cəm gəlir</Th>
              <Th className="text-right">Orta qiymət</Th>
              <Th className="text-right">Endirim verildi</Th>
              <Th>Sonuncu satış</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {slice.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-zinc-500">
                  Bu filtr üçün satış yoxdur.
                </td>
              </tr>
            )}
            {slice.map((r) => (
              <tr key={r.game.id} className="hover:bg-zinc-900/40">
                <Td>
                  <div className="flex items-center gap-3">
                    {r.game.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.game.imageUrl}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 shrink-0 rounded bg-zinc-800" />
                    )}
                    <div className="min-w-0">
                      {r.game.productId ? (
                        <Link
                          href={`/oyunlar/${r.game.productId}`}
                          target="_blank"
                          className="line-clamp-1 font-medium text-zinc-100 hover:text-indigo-300"
                        >
                          {r.game.title}
                        </Link>
                      ) : (
                        <span className="line-clamp-1 font-medium text-zinc-100">
                          {r.game.title}
                        </span>
                      )}
                      {!r.game.isActive && (
                        <span className="text-[10px] text-zinc-500">Deaktiv</span>
                      )}
                    </div>
                  </div>
                </Td>
                <Td>
                  <TypeBadge productType={r.game.productType} />
                </Td>
                <Td className="text-zinc-400">{r.game.platform ?? "—"}</Td>
                <Td className="text-right font-semibold text-zinc-100">
                  {r.soldCount.toLocaleString()}
                </Td>
                <Td className="text-right font-semibold text-emerald-300">
                  {fmtAzn(r.revenueCents)}
                </Td>
                <Td className="text-right text-zinc-300">
                  {fmtAzn(r.avgSaleCents)}
                </Td>
                <Td className="text-right text-zinc-400">
                  {r.savingsCents > 0 ? fmtAzn(r.savingsCents) : "—"}
                </Td>
                <Td className="text-zinc-400">{fmtDate(r.lastSoldAt)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-500">
            Səhifə {safePage} / {totalPages}
          </span>
          <div className="flex gap-2">
            {safePage > 1 && (
              <Link
                href={buildHref({ page: String(safePage - 1) })}
                className="rounded-lg border border-zinc-800 px-3 py-1.5 text-zinc-300 hover:bg-zinc-900"
              >
                ← Əvvəlki
              </Link>
            )}
            {safePage < totalPages && (
              <Link
                href={buildHref({ page: String(safePage + 1) })}
                className="rounded-lg border border-zinc-800 px-3 py-1.5 text-zinc-300 hover:bg-zinc-900"
              >
                Növbəti →
              </Link>
            )}
          </div>
        </div>
      )}
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
  accent?: "emerald";
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold tabular-nums ${
          accent === "emerald" ? "text-emerald-300" : "text-zinc-100"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function FilterRow({
  label,
  current,
  options,
  optionLabels,
  build,
}: {
  label: string;
  current: string;
  options: readonly string[];
  optionLabels?: Record<string, string>;
  build: (v: string) => string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      {options.map((opt) => {
        const active = opt === current;
        return (
          <Link
            key={opt}
            href={build(opt)}
            className={`rounded-lg border px-3 py-1 text-xs font-semibold transition ${
              active
                ? "border-indigo-500 bg-indigo-500/15 text-indigo-200"
                : "border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
            }`}
          >
            {optionLabels?.[opt] ?? opt}
          </Link>
        );
      })}
    </div>
  );
}

function TypeBadge({ productType }: { productType: string }) {
  const styles: Record<string, string> = {
    GAME: "bg-indigo-500/15 text-indigo-300",
    ADDON: "bg-fuchsia-500/15 text-fuchsia-300",
    CURRENCY: "bg-emerald-500/15 text-emerald-300",
    OTHER: "bg-sky-500/15 text-sky-300",
  };
  const labels: Record<string, string> = {
    GAME: "Oyun",
    ADDON: "Əlavə",
    CURRENCY: "Pul kartı",
    OTHER: "Digər",
  };
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
        styles[productType] ?? "bg-zinc-800 text-zinc-300"
      }`}
    >
      {labels[productType] ?? productType}
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
    <th className={`px-4 py-2.5 text-left font-semibold ${className}`}>
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
