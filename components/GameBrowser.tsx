"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Loader2,
  Gamepad2,
  Filter,
  Tag,
  ChevronDown,
  X,
  Package,
  Coins,
  MoreHorizontal,
} from "lucide-react";
import GameCard, { GameCardData } from "./GameCard";

type ListingResponse = {
  total: number;
  totalAll: number;
  totalOnSale: number;
  totals: Record<string, number>;
  count: number;
  results: GameCardData[];
};

type Sort = "newest" | "popular" | "priceAsc" | "priceDesc" | "discount" | "alpha";
type Platform = "ALL" | "PS4" | "PS5";
type ProductType = "GAME" | "ADDON" | "CURRENCY" | "OTHER";

const DEFAULT_SORT: Sort = "newest";
const DEFAULT_PLATFORM: Platform = "ALL";
const DEFAULT_TYPE: ProductType = "GAME";

const SORT_OPTIONS: { value: Sort; label: string }[] = [
  { value: "newest", label: "Ən yeni" },
  { value: "popular", label: "Ən populyar" },
  { value: "priceAsc", label: "Qiymət: ucuzdan bahaya" },
  { value: "priceDesc", label: "Qiymət: bahadan ucuza" },
  { value: "discount", label: "Ən böyük endirim" },
  { value: "alpha", label: "Əlifba sırası" },
];

const TYPE_TABS: {
  value: ProductType;
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: "GAME", label: "Oyunlar", icon: <Gamepad2 className="h-4 w-4" /> },
  { value: "ADDON", label: "Əlavələr / DLC", icon: <Package className="h-4 w-4" /> },
  { value: "CURRENCY", label: "Pul kartları", icon: <Coins className="h-4 w-4" /> },
  { value: "OTHER", label: "Digər", icon: <MoreHorizontal className="h-4 w-4" /> },
];

export default function GameBrowser({ initial }: { initial: ListingResponse }) {
  const [data, setData] = useState<ListingResponse>(initial);
  const [productType, setProductType] = useState<ProductType>(DEFAULT_TYPE);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);
  const [platform, setPlatform] = useState<Platform>(DEFAULT_PLATFORM);
  const [onSale, setOnSale] = useState(false);
  const [loading, setLoading] = useState(false);

  const reqId = useRef(0);
  // Skip the very first effect run — server already rendered `initial` for
  // the default state. After that, every change refetches so a cleared
  // search or a tab roundtrip reloads the correct data.
  const hasMounted = useRef(false);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

    const myReq = ++reqId.current;
    setLoading(true);

    const handle = setTimeout(async () => {
      const params = new URLSearchParams();
      const q = query.trim();
      if (q.length >= 2) params.set("q", q);
      params.set("sort", sort);
      params.set("type", productType);
      if (platform !== "ALL") params.set("platform", platform);
      if (onSale) params.set("onSale", "1");
      params.set("limit", "100");

      try {
        const res = await fetch(`/api/games?${params.toString()}`);
        const json: ListingResponse = await res.json();
        if (myReq !== reqId.current) return;
        setData(json);
      } catch {
        if (myReq === reqId.current) {
          setData((d) => ({ ...d, total: 0, count: 0, results: [] }));
        }
      } finally {
        if (myReq === reqId.current) setLoading(false);
      }
    }, 250);

    return () => clearTimeout(handle);
  }, [query, sort, platform, onSale, productType]);

  const hasActiveFilter =
    query.trim().length >= 2 ||
    platform !== DEFAULT_PLATFORM ||
    onSale ||
    sort !== DEFAULT_SORT;

  const clearFilters = () => {
    setQuery("");
    setSort(DEFAULT_SORT);
    setPlatform(DEFAULT_PLATFORM);
    setOnSale(false);
  };

  const showingCount = useMemo(() => {
    if (sort === "discount") return Math.min(data.total, data.totalOnSale);
    return data.total;
  }, [sort, data.total, data.totalOnSale]);

  const activeTab = TYPE_TABS.find((t) => t.value === productType)!;

  return (
    <>
      <div className="mb-5 flex flex-wrap gap-2">
        {TYPE_TABS.map((tab) => {
          const count = data.totals?.[tab.value] ?? 0;
          const active = tab.value === productType;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setProductType(tab.value)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition ${
                active
                  ? "border-indigo-500/60 bg-indigo-500/15 text-indigo-200"
                  : "border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-zinc-700"
              }`}
            >
              {tab.icon}
              {tab.label}
              <span
                className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${
                  active ? "bg-indigo-500/20 text-indigo-100" : "bg-zinc-800 text-zinc-400"
                }`}
              >
                {count.toLocaleString("en-US")}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-zinc-300">
          <span className="font-semibold text-white">
            {data.totalAll.toLocaleString("en-US")}
          </span>{" "}
          <span className="text-zinc-500">{activeTab.label.toLowerCase()} kataloqda</span>
          <span className="text-zinc-600"> · </span>
          <span className="font-semibold text-emerald-400">
            {data.totalOnSale.toLocaleString("en-US")}
          </span>
          <span className="text-zinc-500"> endirimdə</span>
        </p>
        {hasActiveFilter && (
          <p className="text-zinc-400">
            <span className="font-semibold text-white">
              {showingCount.toLocaleString("en-US")}
            </span>{" "}
            nəticə göstərilir
          </p>
        )}
      </div>

      <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`${activeTab.label} axtar…`}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 py-2.5 pl-10 pr-10 text-sm placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-500" />
          )}
        </div>

        <SelectField
          icon={<Filter className="h-4 w-4" />}
          value={sort}
          onChange={(v) => setSort(v as Sort)}
          options={SORT_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
        />

        <SelectField
          icon={<Gamepad2 className="h-4 w-4" />}
          value={platform}
          onChange={(v) => setPlatform(v as Platform)}
          options={[
            { value: "ALL", label: "Bütün platformalar" },
            { value: "PS5", label: "PS5" },
            { value: "PS4", label: "PS4" },
          ]}
        />

        <button
          type="button"
          onClick={() => setOnSale((v) => !v)}
          className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
            onSale
              ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
              : "border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700"
          }`}
        >
          <Tag className="h-4 w-4" /> Endirimdə
        </button>
      </div>

      {hasActiveFilter && (
        <div className="mb-4">
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1 text-xs text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
          >
            <X className="h-3 w-3" /> Filtrləri sıfırla
          </button>
        </div>
      )}

      {data.results.length === 0 ? (
        <EmptyState query={query} hasActiveFilter={hasActiveFilter} />
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.results.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </ul>
      )}
    </>
  );
}

function SelectField({
  icon,
  value,
  onChange,
  options,
}: {
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
        {icon}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-lg border border-zinc-800 bg-zinc-900/60 py-2.5 pl-10 pr-9 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-zinc-900">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
    </div>
  );
}

function EmptyState({
  query,
  hasActiveFilter,
}: {
  query: string;
  hasActiveFilter: boolean;
}) {
  if (hasActiveFilter) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-10 text-center">
        <p className="text-sm text-zinc-400">
          {query.trim().length >= 2
            ? `"${query.trim()}" üzrə cari filtrlərlə nəticə tapılmadı.`
            : "Cari filtrlərlə heç bir nəticə tapılmadı."}
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-10 text-center">
      <Gamepad2 className="mx-auto h-10 w-10 text-zinc-600" />
      <p className="mt-3 text-sm text-zinc-400">
        Bu kateqoriyada hələ heç nə yoxdur. Admin panelindən scraping işə sal.
      </p>
      <a
        href="/admin/settings"
        className="mt-4 inline-flex items-center justify-center rounded-md border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800"
      >
        Admin panelə keç
      </a>
    </div>
  );
}
