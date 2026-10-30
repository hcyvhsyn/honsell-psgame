import Link from "next/link";
import { Search, Star } from "lucide-react";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import StarToggle from "./StarToggle";
import PriceEditor from "./PriceEditor";
import { computeDisplayPrice, getSettings, tryCentsToCostAzn } from "@/lib/pricing";
import { gameTierPct } from "@/lib/gameMargin";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;
const PLATFORMS = ["ALL", "PS5", "PS4", "PC"] as const;
const TYPES = ["ALL", "GAME", "ADDON", "CURRENCY", "OTHER"] as const;
const DISCOUNTS = ["ALL", "WITH", "WITHOUT"] as const;
const DISCOUNT_LABEL: Record<(typeof DISCOUNTS)[number], string> = {
  ALL: "Hamısı",
  WITH: "Endirimli",
  WITHOUT: "Endirimsiz",
};
const PRICINGS = ["ALL", "CUSTOM"] as const;
const PRICING_LABEL: Record<(typeof PRICINGS)[number], string> = {
  ALL: "Hamısı",
  CUSTOM: "Custom",
};
const SORTS = ["DEFAULT", "PRICE_ASC", "PRICE_DESC"] as const;
const SORT_LABEL: Record<(typeof SORTS)[number], string> = {
  DEFAULT: "Default",
  PRICE_ASC: "Ucuzdan bahaya",
  PRICE_DESC: "Bahadan ucuza",
};

export default async function AdminGamesPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    platform?: string;
    store?: string;
    productType?: string;
    featured?: string;
    discount?: string;
    pricing?: string;
    sort?: string;
    page?: string;
  };
}) {
  const q = (searchParams.q ?? "").trim();
  const platform = String(searchParams.platform ?? "ALL").toUpperCase();
  const productType = String(searchParams.productType ?? "ALL").toUpperCase();
  const featuredOnly = searchParams.featured === "1";
  const discount = String(searchParams.discount ?? "ALL").toUpperCase() as (typeof DISCOUNTS)[number];
  const discountFilter = (DISCOUNTS as readonly string[]).includes(discount) ? discount : "ALL";
  const pricing = String(searchParams.pricing ?? "ALL").toUpperCase();
  const customOnly = pricing === "CUSTOM";
  const sortRaw = String(searchParams.sort ?? "DEFAULT").toUpperCase();
  const sort = (SORTS as readonly string[]).includes(sortRaw)
    ? (sortRaw as (typeof SORTS)[number])
    : "DEFAULT";
  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);

  const where = {
    ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
    // Epic silinib (2026-10) — köhnə Epic sətirləri bazada qalsa da burada görünmür.
    store: "PS",
    ...(platform !== "ALL" ? { platform } : {}),
    ...(productType !== "ALL" ? { productType } : {}),
    ...(featuredOnly ? { isFeatured: true } : {}),
    ...(discountFilter === "WITH" ? { discountTryCents: { not: null } } : {}),
    ...(discountFilter === "WITHOUT" ? { discountTryCents: null } : {}),
    ...(customOnly
      ? { OR: [{ customMarginPct: { not: null } }, { customPriceAznCents: { not: null } }] }
      : {}),
  };

  const orderBy: Prisma.GameOrderByWithRelationInput[] =
    sort === "PRICE_ASC"
      ? [{ priceTryCents: "asc" }, { updatedAt: "desc" }]
      : sort === "PRICE_DESC"
        ? [{ priceTryCents: "desc" }, { updatedAt: "desc" }]
        : [{ isFeatured: "desc" }, { updatedAt: "desc" }];

  const [settings, total, featuredCount, games] = await Promise.all([
    getSettings(),
    prisma.game.count({ where }),
    prisma.game.count({ where: { isFeatured: true } }),
    prisma.game.findMany({
      where,
      orderBy,
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: {
        _count: {
          select: {
            transactions: { where: { type: "PURCHASE", status: "SUCCESS" } },
          },
        },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function buildHref(overrides: Record<string, string | undefined>) {
    const merged: Record<string, string> = {
      ...(q ? { q } : {}),
      ...(platform !== "ALL" ? { platform } : {}),
      ...(productType !== "ALL" ? { productType } : {}),
      ...(featuredOnly ? { featured: "1" } : {}),
      ...(discountFilter !== "ALL" ? { discount: discountFilter } : {}),
      ...(customOnly ? { pricing: "CUSTOM" } : {}),
      ...(sort !== "DEFAULT" ? { sort } : {}),
      page: String(page),
      ...Object.fromEntries(
        Object.entries(overrides).filter(([, v]) => v !== undefined)
      ),
    };
    Object.entries(overrides).forEach(([k, v]) => {
      if (
        v === undefined ||
        v === "ALL" ||
        v === "" ||
        v === "0" ||
        v === "DEFAULT"
      )
        delete merged[k];
    });
    return `/admin/games?${new URLSearchParams(merged).toString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Games</h1>
          <p className="text-sm text-zinc-600">
            {total.toLocaleString()} catalog items.
          </p>
        </div>

        <form className="relative w-full max-w-sm">
          {platform !== "ALL" && (
            <input type="hidden" name="platform" value={platform} />
          )}
          {productType !== "ALL" && (
            <input type="hidden" name="productType" value={productType} />
          )}
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search title…"
            className="w-full rounded-md border border-admin-line bg-admin-card py-2 pl-9 pr-3 text-sm placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none"
          />
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <FilterRow
          label="Platform"
          current={platform}
          options={PLATFORMS}
          build={(v) => buildHref({ platform: v, page: "1" })}
        />
        <FilterRow
          label="Type"
          current={productType}
          options={TYPES}
          build={(v) => buildHref({ productType: v, page: "1" })}
        />
        <FilterRow
          label="Endirim"
          current={discountFilter}
          options={DISCOUNTS}
          getLabel={(v) => DISCOUNT_LABEL[v as (typeof DISCOUNTS)[number]] ?? v}
          build={(v) => buildHref({ discount: v, page: "1" })}
        />
        <FilterRow
          label="Qiymət"
          current={customOnly ? "CUSTOM" : "ALL"}
          options={PRICINGS}
          getLabel={(v) => PRICING_LABEL[v as (typeof PRICINGS)[number]] ?? v}
          build={(v) => buildHref({ pricing: v, page: "1" })}
        />
        <FilterRow
          label="Sırala"
          current={sort}
          options={SORTS}
          getLabel={(v) => SORT_LABEL[v as (typeof SORTS)[number]] ?? v}
          build={(v) => buildHref({ sort: v, page: "1" })}
        />
        <Link
          href={buildHref({ featured: featuredOnly ? "0" : "1", page: "1" })}
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs ring-1 transition ${
            featuredOnly
              ? "bg-amber-500/15 text-amber-700 ring-amber-500/40"
              : "bg-admin-card text-zinc-700 ring-admin-line hover:bg-admin-chip2"
          }`}
        >
          <Star className={`h-3.5 w-3.5 ${featuredOnly ? "fill-amber-300" : ""}`} />
          Featured only
          <span className="rounded bg-admin-chip px-1.5 py-0.5 text-[10px] text-zinc-700">
            {featuredCount}
          </span>
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-admin-line">
        <table className="w-full min-w-[1400px] text-sm">
          <thead className="bg-admin-card text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <Th>Popular</Th>
              <Th>Game</Th>
              <Th>Platform</Th>
              <Th>Type</Th>
              <Th>Price (TRY)</Th>
              <Th>Maya</Th>
              <Th>Satış</Th>
              <Th>Mənfəət</Th>
              <Th>Qiymət</Th>
              <Th>Endirim bitir</Th>
              <Th>Sold</Th>
              <Th>Active</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-line">
            {games.length === 0 && (
              <tr>
                <td colSpan={12} className="px-5 py-8 text-center text-zinc-500">
                  No games match these filters.
                </td>
              </tr>
            )}
            {games.map((g) => {
              const price = computeDisplayPrice(g, settings);
              const discountActive =
                g.discountTryCents != null &&
                g.discountTryCents < g.priceTryCents &&
                (g.discountEndAt == null || g.discountEndAt.getTime() > Date.now());
              const costAzn = tryCentsToCostAzn(
                discountActive ? g.discountTryCents! : g.priceTryCents,
                settings
              );
              const profit = price.finalAzn - costAzn;
              return (
                <tr key={g.id} className="hover:bg-admin-chip">
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
                          className="h-12 w-12 rounded-md object-cover ring-1 ring-admin-line"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-md bg-admin-card ring-1 ring-admin-line" />
                      )}
                      <div className="min-w-0">
                        <div className="truncate font-medium">{g.title}</div>
                        <div className="truncate text-xs text-zinc-500">
                          {g.productId}
                        </div>
                      </div>
                    </div>
                  </Td>
                  <Td className="text-zinc-700">{g.platform ?? "—"}</Td>
                  <Td className="text-zinc-700">{g.productType}</Td>
                  <Td className="text-zinc-700">
                    {g.discountTryCents != null ? (
                      <>
                        <span className="text-emerald-700">
                          {fmtTry(g.discountTryCents)}
                        </span>
                        <span className="ml-2 text-xs text-zinc-500 line-through">
                          {fmtTry(g.priceTryCents)}
                        </span>
                      </>
                    ) : (
                      fmtTry(g.priceTryCents)
                    )}
                  </Td>
                  <Td className="text-zinc-700">{costAzn.toFixed(2)} ₼</Td>
                  <Td className="text-zinc-900">
                    <span className="font-medium">{price.finalAzn.toFixed(2)} ₼</span>
                    {price.originalAzn != null && (
                      <span className="ml-2 text-xs text-zinc-500 line-through">
                        {price.originalAzn.toFixed(2)}
                      </span>
                    )}
                  </Td>
                  <Td className={profit < 0 ? "text-rose-700" : "text-zinc-700"}>
                    {profit.toFixed(2)} ₼
                    <div className="text-xs text-zinc-500">
                      {costAzn > 0 ? `${((profit / costAzn) * 100).toFixed(1)}%` : "—"}
                    </div>
                  </Td>
                  <Td>
                    <PriceEditor
                      gameId={g.id}
                      customMarginPct={g.customMarginPct}
                      customPriceAznCents={g.customPriceAznCents}
                      costAzn={costAzn}
                      autoPct={gameTierPct(
                        costAzn,
                        settings.gameMarginTiers,
                        settings.profitMarginGamesPct
                      )}
                    />
                  </Td>
                  <Td className="text-zinc-700">
                    {g.discountTryCents != null && g.discountEndAt ? (
                      <DiscountEnd date={g.discountEndAt} />
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </Td>
                  <Td className="text-zinc-800">{g._count.transactions}</Td>
                  <Td>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${
                        g.isActive
                          ? "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30"
                          : "bg-admin-chip text-zinc-700 ring-admin-line2"
                      }`}
                    >
                      {g.isActive ? "Active" : "Hidden"}
                    </span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-zinc-600">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={buildHref({ page: String(page - 1) })}
                className="rounded-md border border-admin-line px-3 py-1.5 hover:bg-admin-chip"
              >
                ← Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildHref({ page: String(page + 1) })}
                className="rounded-md border border-admin-line px-3 py-1.5 hover:bg-admin-chip"
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

function fmtTry(cents: number) {
  return `${(cents / 100).toFixed(2)} TRY`;
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
                  ? "bg-violet-500/15 text-violet-700 ring-violet-500/30"
                  : "bg-admin-card text-zinc-700 ring-admin-line hover:bg-admin-chip2"
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

function DiscountEnd({ date }: { date: Date }) {
  const ms = new Date(date).getTime() - Date.now();
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  const dateStr = new Date(date).toLocaleDateString("az-AZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  let hint: { text: string; className: string };
  if (days < 0) hint = { text: "Bitib", className: "text-zinc-500" };
  else if (days === 0) hint = { text: "Bu gün", className: "text-rose-700" };
  else if (days <= 3) hint = { text: `${days} gün`, className: "text-amber-700" };
  else hint = { text: `${days} gün`, className: "text-zinc-500" };
  return (
    <div>
      <div className="text-zinc-800">{dateStr}</div>
      <div className={`text-xs ${hint.className}`}>{hint.text}</div>
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
