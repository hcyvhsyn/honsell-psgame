import Link from "next/link";
import { Search, Star } from "lucide-react";
import { prisma } from "@/lib/prisma";
import StarToggle from "./StarToggle";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;
const PLATFORMS = ["ALL", "PS5", "PS4"] as const;
const TYPES = ["ALL", "GAME", "ADDON", "CURRENCY", "OTHER"] as const;

export default async function AdminGamesPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    platform?: string;
    productType?: string;
    featured?: string;
    page?: string;
  };
}) {
  const q = (searchParams.q ?? "").trim();
  const platform = String(searchParams.platform ?? "ALL").toUpperCase();
  const productType = String(searchParams.productType ?? "ALL").toUpperCase();
  const featuredOnly = searchParams.featured === "1";
  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);

  const where = {
    ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
    ...(platform !== "ALL" ? { platform } : {}),
    ...(productType !== "ALL" ? { productType } : {}),
    ...(featuredOnly ? { isFeatured: true } : {}),
  };

  const [total, featuredCount, games] = await Promise.all([
    prisma.game.count({ where }),
    prisma.game.count({ where: { isFeatured: true } }),
    prisma.game.findMany({
      where,
      orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
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
      page: String(page),
      ...Object.fromEntries(
        Object.entries(overrides).filter(([, v]) => v !== undefined)
      ),
    };
    Object.entries(overrides).forEach(([k, v]) => {
      if (v === undefined || v === "ALL" || v === "" || v === "0") delete merged[k];
    });
    return `/admin/games?${new URLSearchParams(merged).toString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Games</h1>
          <p className="text-sm text-zinc-400">
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
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3 text-sm placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
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
        <Link
          href={buildHref({ featured: featuredOnly ? "0" : "1", page: "1" })}
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs ring-1 transition ${
            featuredOnly
              ? "bg-amber-500/15 text-amber-300 ring-amber-500/40"
              : "bg-zinc-900 text-zinc-300 ring-zinc-800 hover:bg-zinc-800"
          }`}
        >
          <Star className={`h-3.5 w-3.5 ${featuredOnly ? "fill-amber-300" : ""}`} />
          Featured only
          <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[10px] text-zinc-300">
            {featuredCount}
          </span>
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/60 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <Th>Popular</Th>
              <Th>Game</Th>
              <Th>Platform</Th>
              <Th>Type</Th>
              <Th>Price (TRY)</Th>
              <Th>Sold</Th>
              <Th>Active</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {games.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-zinc-500">
                  No games match these filters.
                </td>
              </tr>
            )}
            {games.map((g) => (
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
                      <div className="truncate font-medium">{g.title}</div>
                      <div className="truncate text-xs text-zinc-500">
                        {g.productId}
                      </div>
                    </div>
                  </div>
                </Td>
                <Td className="text-zinc-300">{g.platform ?? "—"}</Td>
                <Td className="text-zinc-300">{g.productType}</Td>
                <Td className="text-zinc-300">
                  {g.discountTryCents != null ? (
                    <>
                      <span className="text-emerald-300">
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
                <Td className="text-zinc-200">{g._count.transactions}</Td>
                <Td>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${
                      g.isActive
                        ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                        : "bg-zinc-800 text-zinc-300 ring-zinc-700"
                    }`}
                  >
                    {g.isActive ? "Active" : "Hidden"}
                  </span>
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

function fmtTry(cents: number) {
  return `${(cents / 100).toFixed(2)} TRY`;
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
