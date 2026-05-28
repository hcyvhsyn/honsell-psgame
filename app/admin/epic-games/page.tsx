import Link from "next/link";
import {
  Search,
  Monitor,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { computeEpicDisplayPrice, getSettings } from "@/lib/pricing";
import StarToggle from "../games/StarToggle";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;
const DISCOUNTS = ["ALL", "WITH", "WITHOUT"] as const;
const DISCOUNT_LABEL: Record<(typeof DISCOUNTS)[number], string> = {
  ALL: "Hamısı",
  WITH: "Endirimli",
  WITHOUT: "Endirimsiz",
};
const SORTS = [
  "NEWEST",
  "PROFIT_DESC",
  "PROFIT_ASC",
  "PRICE_DESC",
  "PRICE_ASC",
  "PCT_DESC",
  "PCT_ASC",
] as const;
type Sort = (typeof SORTS)[number];
const SORT_LABEL: Record<Sort, string> = {
  NEWEST: "Ən yeni",
  PROFIT_DESC: "Mənfəət ₼: çox→az",
  PROFIT_ASC: "Mənfəət ₼: az→çox",
  PRICE_DESC: "Qiymət: baha→ucuz",
  PRICE_ASC: "Qiymət: ucuz→baha",
  PCT_DESC: "Mənfəət %: çox→az",
  PCT_ASC: "Mənfəət %: az→çox",
};
// The percentage sorts are driven by the column-header button, not the dropdown.
const FILTER_SORTS = [
  "NEWEST",
  "PROFIT_DESC",
  "PROFIT_ASC",
  "PRICE_DESC",
  "PRICE_ASC",
] as const;

/** Net profit as a percentage of cost (markup). null when cost is unknown. */
function marginPct(netProfitAzn: number, costAzn: number): number | null {
  return costAzn > 0 ? (netProfitAzn / costAzn) * 100 : null;
}

export default async function AdminEpicGamesPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    discount?: string;
    sort?: string;
    page?: string;
  };
}) {
  const q = (searchParams.q ?? "").trim();
  const discountRaw = String(searchParams.discount ?? "ALL").toUpperCase();
  const discount = (DISCOUNTS as readonly string[]).includes(discountRaw)
    ? (discountRaw as (typeof DISCOUNTS)[number])
    : "ALL";
  const sortRaw = String(searchParams.sort ?? "NEWEST").toUpperCase();
  const sort = (SORTS as readonly string[]).includes(sortRaw)
    ? (sortRaw as (typeof SORTS)[number])
    : "NEWEST";
  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);

  const where = {
    store: "EPIC",
    ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
    ...(discount === "WITH" ? { discountTryCents: { not: null } } : {}),
    ...(discount === "WITHOUT" ? { discountTryCents: null } : {}),
  };

  const [settings, rows, totalEpic, onSaleCount] = await Promise.all([
    getSettings(),
    // Lightweight pull of all matching rows so we can compute & sort by the
    // derived profit/price (which aren't DB columns).
    prisma.game.findMany({
      where,
      select: {
        id: true,
        title: true,
        imageUrl: true,
        productUrl: true,
        isActive: true,
        isFeatured: true,
        priceTryCents: true,
        discountTryCents: true,
        priceUsdCents: true,
        discountUsdCents: true,
        lastScrapedAt: true,
      },
    }),
    prisma.game.count({ where: { store: "EPIC" } }),
    prisma.game.count({ where: { store: "EPIC", discountTryCents: { not: null } } }),
  ]);

  const computed = rows.map((g) => ({ g, price: computeEpicDisplayPrice(g, settings) }));

  computed.sort((a, b) => {
    switch (sort) {
      case "PROFIT_DESC":
        return b.price.netProfitAzn - a.price.netProfitAzn;
      case "PROFIT_ASC":
        return a.price.netProfitAzn - b.price.netProfitAzn;
      case "PRICE_DESC":
        return b.price.finalAzn - a.price.finalAzn;
      case "PRICE_ASC":
        return a.price.finalAzn - b.price.finalAzn;
      case "PCT_DESC":
      case "PCT_ASC": {
        // Rows with no cost (no margin %) sink to the bottom either way.
        const pa = marginPct(a.price.netProfitAzn, a.price.costAzn);
        const pb = marginPct(b.price.netProfitAzn, b.price.costAzn);
        if (pa == null && pb == null) return 0;
        if (pa == null) return 1;
        if (pb == null) return -1;
        return sort === "PCT_DESC" ? pb - pa : pa - pb;
      }
      default:
        return b.g.lastScrapedAt.getTime() - a.g.lastScrapedAt.getTime();
    }
  });

  const filteredCount = computed.length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const pageRows = computed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Sold counts only for the visible slice (avoids a join across the full set).
  const pageIds = pageRows.map((r) => r.g.id);
  const soldByGame = new Map<string, number>();
  if (pageIds.length > 0) {
    const sold = await prisma.transaction.groupBy({
      by: ["gameId"],
      where: { gameId: { in: pageIds }, type: "PURCHASE", status: "SUCCESS" },
      _count: { _all: true },
    });
    for (const s of sold) if (s.gameId) soldByGame.set(s.gameId, s._count._all);
  }

  // Catalog-wide profit snapshot (over all matching rows, not just this page).
  const negativeCount = computed.filter((c) => c.price.netProfitAzn < 0).length;
  const totalNetProfit = computed.reduce((sum, c) => sum + c.price.netProfitAzn, 0);
  const avgNetProfit = filteredCount > 0 ? totalNetProfit / filteredCount : 0;

  function buildHref(overrides: Record<string, string | undefined>) {
    const merged: Record<string, string> = {
      ...(q ? { q } : {}),
      ...(discount !== "ALL" ? { discount } : {}),
      ...(sort !== "NEWEST" ? { sort } : {}),
      page: String(page),
      ...Object.fromEntries(
        Object.entries(overrides).filter(([, v]) => v !== undefined)
      ),
    };
    Object.entries(overrides).forEach(([k, v]) => {
      if (v === undefined || v === "ALL" || v === "" || v === "NEWEST") delete merged[k];
    });
    return `/admin/epic-games?${new URLSearchParams(merged).toString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Monitor className="h-6 w-6 text-indigo-400" />
            Epic Games
          </h1>
          <p className="text-sm text-zinc-400">
            {totalEpic.toLocaleString()} oyun · {onSaleCount.toLocaleString()} endirimli.
            Qiymət{" "}
            <Link href="/admin/settings" className="text-indigo-400 hover:underline">
              Tənzimləmələrdəki
            </Link>{" "}
            mövqe %-i ilə hesablanır.
          </p>
        </div>

        <form className="relative w-full max-w-sm">
          {discount !== "ALL" && <input type="hidden" name="discount" value={discount} />}
          {sort !== "NEWEST" && <input type="hidden" name="sort" value={sort} />}
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Oyun adı ilə axtar…"
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3 text-sm placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
          />
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Cəmi oyun" value={totalEpic.toLocaleString()} />
        <Stat label="Filtrə uyğun" value={filteredCount.toLocaleString()} />
        <Stat label="Orta xalis mənfəət" value={`${avgNetProfit.toFixed(2)} ₼`} />
        <Stat
          label="Zərərli (mənfi mənfəət)"
          value={negativeCount.toLocaleString()}
          tint={negativeCount > 0 ? "rose" : "default"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <FilterRow
          label="Endirim"
          current={discount}
          options={DISCOUNTS}
          getLabel={(v) => DISCOUNT_LABEL[v as (typeof DISCOUNTS)[number]] ?? v}
          build={(v) => buildHref({ discount: v, page: "1" })}
        />
        <FilterRow
          label="Sırala"
          current={sort}
          options={FILTER_SORTS}
          getLabel={(v) => SORT_LABEL[v as Sort] ?? v}
          build={(v) => buildHref({ sort: v, page: "1" })}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-zinc-900/60 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <Th>Popular</Th>
              <Th>Oyun</Th>
              <Th>Maya (TR)</Th>
              <Th>Referans (AZ)</Th>
              <Th>Bizim qiymət</Th>
              <Th>Xalis mənfəət</Th>
              <th className="px-4 py-3 text-left font-medium">
                <Link
                  href={buildHref({
                    sort: sort === "PCT_DESC" ? "PCT_ASC" : "PCT_DESC",
                    page: "1",
                  })}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 ring-1 transition ${
                    sort === "PCT_DESC" || sort === "PCT_ASC"
                      ? "bg-indigo-500/15 text-indigo-300 ring-indigo-500/30"
                      : "bg-zinc-900 text-zinc-400 ring-zinc-800 hover:bg-zinc-800 hover:text-zinc-200"
                  }`}
                  title="Mənfəət faizinə görə sırala"
                >
                  Mənfəət %
                  {sort === "PCT_DESC" ? (
                    <ArrowDown className="h-3.5 w-3.5" />
                  ) : sort === "PCT_ASC" ? (
                    <ArrowUp className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />
                  )}
                </Link>
              </th>
              <Th>Satıldı</Th>
              <Th>Aktiv</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-8 text-center text-zinc-500">
                  Heç bir Epic oyunu tapılmadı. Kataloqu doldurmaq üçün
                  Tənzimləmələrdən “Epic yığımını başlat”.
                </td>
              </tr>
            )}
            {pageRows.map(({ g, price }) => {
              const profitOk = price.netProfitAzn >= 0;
              const pct = marginPct(price.netProfitAzn, price.costAzn);
              return (
                <tr key={g.id} className="hover:bg-zinc-900/40">
                  <Td>
                    <StarToggle gameId={g.id} isFeatured={g.isFeatured} />
                  </Td>
                  <Td>
                    <div className="flex items-center gap-3">
                      {g.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={g.imageUrl}
                          alt=""
                          className="h-12 w-12 rounded-md object-cover ring-1 ring-zinc-800"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-md bg-zinc-900 ring-1 ring-zinc-800" />
                      )}
                      <div className="min-w-0">
                        {g.productUrl ? (
                          <a
                            href={g.productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate font-medium hover:text-indigo-300"
                          >
                            {g.title}
                          </a>
                        ) : (
                          <div className="truncate font-medium">{g.title}</div>
                        )}
                        <div className="truncate text-xs text-zinc-500">PC · Epic</div>
                      </div>
                    </div>
                  </Td>
                  <Td className="text-zinc-300">{price.costAzn.toFixed(2)} ₼</Td>
                  <Td className="text-zinc-300">
                    {price.referenceAzn != null ? (
                      `${price.referenceAzn.toFixed(2)} ₼`
                    ) : (
                      <span className="text-amber-400" title="Azərbaycan (USD) qiyməti tapılmadı — döşəmə tətbiq olunur">
                        yoxdur
                      </span>
                    )}
                  </Td>
                  <Td>
                    <span className="font-medium text-zinc-100">
                      {price.finalAzn.toFixed(2)} ₼
                    </span>
                    {price.floored && (
                      <span className="ml-1 text-[11px] text-amber-400">döşəmə</span>
                    )}
                  </Td>
                  <Td>
                    <span className={profitOk ? "text-emerald-300" : "text-rose-300"}>
                      {price.netProfitAzn.toFixed(2)} ₼
                    </span>
                    {!profitOk && (
                      <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-rose-400" />
                    )}
                    <div className="text-[11px] text-zinc-500">
                      brüt {price.profitAzn.toFixed(2)} ₼
                    </div>
                  </Td>
                  <Td>
                    {pct != null ? (
                      <span
                        className={`text-sm font-semibold ${profitOk ? "text-emerald-300" : "text-rose-300"}`}
                      >
                        {pct >= 0 ? "+" : ""}
                        {pct.toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </Td>
                  <Td className="text-zinc-200">{soldByGame.get(g.id) ?? 0}</Td>
                  <Td>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${
                        g.isActive
                          ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                          : "bg-zinc-800 text-zinc-300 ring-zinc-700"
                      }`}
                    >
                      {g.isActive ? "Aktiv" : "Gizli"}
                    </span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-zinc-400">
          <span>
            Səhifə {page} / {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={buildHref({ page: String(page - 1) })}
                className="rounded-md border border-zinc-800 px-3 py-1.5 hover:bg-zinc-900"
              >
                ← Əvvəlki
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildHref({ page: String(page + 1) })}
                className="rounded-md border border-zinc-800 px-3 py-1.5 hover:bg-zinc-900"
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

function Stat({
  label,
  value,
  tint = "default",
}: {
  label: string;
  value: string;
  tint?: "default" | "rose";
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3">
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div
        className={`mt-1 text-lg font-semibold ${
          tint === "rose" ? "text-rose-300" : "text-zinc-100"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function FilterRow({
  label,
  current,
  options,
  build,
  getLabel,
}: {
  label: string;
  current: string;
  options: readonly string[];
  build: (v: string) => string;
  getLabel?: (v: string) => string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-wider text-zinc-500">{label}</span>
      <div className="flex flex-wrap gap-1">
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
              {getLabel ? getLabel(opt) : opt}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left font-medium">{children}</th>;
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
