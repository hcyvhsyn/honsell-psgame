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
  Library,
  Sparkles,
  Check,
} from "lucide-react";
import GameCard, { GameCardData } from "./GameCard";
import PlatformInfoButton from "./PlatformInfoButton";

type ListingResponse = {
  total: number;
  totalAll: number;
  totalOnSale: number;
  totals: Record<string, number>;
  count: number;
  results: GameCardData[];
  page?: number;
  pageSize?: number;
  totalPages?: number;
};

type Sort = "newest" | "popular" | "priceAsc" | "priceDesc" | "discount" | "alpha";
type Platform = "ALL" | "PS4" | "PS5";
type ProductType = "GAME" | "ADDON" | "CURRENCY" | "OTHER";

const DEFAULT_SORT: Sort = "newest";
const DEFAULT_PLATFORM: Platform = "ALL";
const DEFAULT_TYPE: ProductType = "GAME";
const DEFAULT_PAGE_SIZE = 24;

const SORT_OPTIONS: { value: Sort; label: string }[] = [
  { value: "newest", label: "Ən yeni" },
  { value: "popular", label: "Ən populyar" },
  { value: "priceAsc", label: "Qiymət: ucuzdan bahaya" },
  { value: "priceDesc", label: "Qiymət: bahadan ucuza" },
  { value: "discount", label: "Ən böyük endirim" },
  { value: "alpha", label: "Əlifba sırası" },
];

type Accent = "indigo" | "fuchsia" | "emerald" | "sky";

const TYPE_TABS: {
  value: ProductType;
  label: string;
  singular: string;
  icon: React.ReactNode;
  accent: Accent;
}[] = [
  { value: "GAME", label: "Oyunlar", singular: "Oyun", icon: <Gamepad2 className="h-4 w-4" />, accent: "indigo" },
  { value: "ADDON", label: "Əlavələr", singular: "Əlavə", icon: <Package className="h-4 w-4" />, accent: "fuchsia" },
  { value: "CURRENCY", label: "Pul kartları", singular: "Pul kartı", icon: <Coins className="h-4 w-4" />, accent: "emerald" },
  { value: "OTHER", label: "Digər", singular: "Məhsul", icon: <MoreHorizontal className="h-4 w-4" />, accent: "sky" },
];

const ACCENT_STYLES: Record<
  Accent,
  {
    activeWrap: string;
    activeIcon: string;
    activeBadge: string;
    activeText: string;
    glow: string;
    hoverIcon: string;
  }
> = {
  indigo: {
    activeWrap: "border-indigo-500/60 bg-gradient-to-br from-indigo-500/20 via-indigo-500/10 to-transparent",
    activeIcon: "bg-indigo-500/25 text-indigo-200 ring-indigo-400/40",
    activeBadge: "bg-indigo-500/25 text-indigo-100",
    activeText: "text-indigo-100",
    glow: "shadow-[0_8px_28px_-12px_rgba(99,102,241,0.6)]",
    hoverIcon: "group-hover:text-indigo-300",
  },
  fuchsia: {
    activeWrap: "border-fuchsia-500/60 bg-gradient-to-br from-fuchsia-500/20 via-fuchsia-500/10 to-transparent",
    activeIcon: "bg-fuchsia-500/25 text-fuchsia-200 ring-fuchsia-400/40",
    activeBadge: "bg-fuchsia-500/25 text-fuchsia-100",
    activeText: "text-fuchsia-100",
    glow: "shadow-[0_8px_28px_-12px_rgba(217,70,239,0.6)]",
    hoverIcon: "group-hover:text-fuchsia-300",
  },
  emerald: {
    activeWrap: "border-emerald-500/60 bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-transparent",
    activeIcon: "bg-emerald-500/25 text-emerald-200 ring-emerald-400/40",
    activeBadge: "bg-emerald-500/25 text-emerald-100",
    activeText: "text-emerald-100",
    glow: "shadow-[0_8px_28px_-12px_rgba(16,185,129,0.6)]",
    hoverIcon: "group-hover:text-emerald-300",
  },
  sky: {
    activeWrap: "border-sky-500/60 bg-gradient-to-br from-sky-500/20 via-sky-500/10 to-transparent",
    activeIcon: "bg-sky-500/25 text-sky-200 ring-sky-400/40",
    activeBadge: "bg-sky-500/25 text-sky-100",
    activeText: "text-sky-100",
    glow: "shadow-[0_8px_28px_-12px_rgba(14,165,233,0.6)]",
    hoverIcon: "group-hover:text-sky-300",
  },
};

export default function GameBrowser({ initial }: { initial: ListingResponse }) {
  const [data, setData] = useState<ListingResponse>(initial);
  const [productType, setProductType] = useState<ProductType>(DEFAULT_TYPE);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);
  const [platform, setPlatform] = useState<Platform>(DEFAULT_PLATFORM);
  const [onSale, setOnSale] = useState(false);
  const [loading, setLoading] = useState(false);
  const pageSize = initial.pageSize ?? DEFAULT_PAGE_SIZE;
  const [page, setPage] = useState<number>(initial.page ?? 1);

  const reqId = useRef(0);
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
      params.set("limit", String(pageSize));
      params.set("offset", String((page - 1) * pageSize));

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
  }, [query, sort, platform, onSale, productType, page, pageSize]);

  // Filtrlər dəyişəndə ilk səhifəyə qayıt.
  useEffect(() => {
    setPage(1);
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

  const activeFilterChips: { key: string; label: string; onRemove: () => void }[] = [];
  if (query.trim().length >= 2) {
    activeFilterChips.push({
      key: "q",
      label: `“${query.trim()}”`,
      onRemove: () => setQuery(""),
    });
  }
  if (platform !== DEFAULT_PLATFORM) {
    activeFilterChips.push({
      key: "platform",
      label: platform,
      onRemove: () => setPlatform(DEFAULT_PLATFORM),
    });
  }
  if (onSale) {
    activeFilterChips.push({
      key: "onSale",
      label: "Endirimdə",
      onRemove: () => setOnSale(false),
    });
  }
  if (sort !== DEFAULT_SORT) {
    activeFilterChips.push({
      key: "sort",
      label: SORT_OPTIONS.find((s) => s.value === sort)?.label ?? sort,
      onRemove: () => setSort(DEFAULT_SORT),
    });
  }

  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {TYPE_TABS.map((tab) => {
          const count = data.totals?.[tab.value] ?? 0;
          const active = tab.value === productType;
          const a = ACCENT_STYLES[tab.accent];
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setProductType(tab.value)}
              className={`group relative inline-flex items-center gap-2.5 overflow-hidden rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${
                active
                  ? `${a.activeWrap} ${a.activeText} ${a.glow}`
                  : "border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:-translate-y-0.5 hover:border-zinc-700 hover:bg-zinc-900/70"
              }`}
            >
              <span
                className={`grid h-7 w-7 place-items-center rounded-md ring-1 transition ${
                  active
                    ? a.activeIcon
                    : `bg-zinc-800/70 text-zinc-400 ring-zinc-700/60 ${a.hoverIcon}`
                }`}
              >
                {tab.icon}
              </span>
              <span className="font-semibold tracking-tight">{tab.label}</span>
              <span
                className={`rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums ${
                  active ? a.activeBadge : "bg-zinc-800 text-zinc-400"
                }`}
              >
                {count.toLocaleString("en-US")}
              </span>
              {active && (
                <span
                  aria-hidden
                  className={`absolute inset-x-3 -bottom-px h-px bg-gradient-to-r from-transparent via-current to-transparent ${a.activeText} opacity-60`}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs">
            <Library className="h-3.5 w-3.5 text-zinc-500" />
            <span className="font-bold tabular-nums text-white">
              {data.totalAll.toLocaleString("en-US")}
            </span>
            <span className="text-zinc-500">kataloqda</span>
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            <span className="font-bold tabular-nums text-emerald-200">
              {data.totalOnSale.toLocaleString("en-US")}
            </span>
            <span className="text-emerald-300/70">endirimdə</span>
          </span>
        </div>
        {loading ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs text-indigo-200">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Yüklənir…
          </span>
        ) : hasActiveFilter ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-300">
            <span className="font-bold tabular-nums text-white">
              {showingCount.toLocaleString("en-US")}
            </span>
            nəticə
          </span>
        ) : null}
      </div>

      <div className="relative z-40 mb-3 rounded-2xl border border-zinc-800/80 bg-gradient-to-br from-zinc-900/70 via-zinc-900/30 to-zinc-900/70 p-2 shadow-inner shadow-black/40 backdrop-blur">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`${activeTab.singular} axtar…`}
              className="w-full rounded-lg border border-transparent bg-zinc-950/60 py-2.5 pl-10 pr-10 text-sm placeholder:text-zinc-500 focus:border-indigo-500/60 focus:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            {loading ? (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-indigo-400" />
            ) : query.length > 0 ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Axtarışı təmizlə"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          <Dropdown
            icon={<Filter className="h-4 w-4" />}
            value={sort}
            onChange={(v) => setSort(v as Sort)}
            options={SORT_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
            ariaLabel="Sıralama"
          />

          <div className="flex items-center gap-1.5">
            <Dropdown
              icon={<Gamepad2 className="h-4 w-4" />}
              value={platform}
              onChange={(v) => setPlatform(v as Platform)}
              options={[
                { value: "ALL", label: "Bütün platformalar" },
                { value: "PS5", label: "PS5" },
                { value: "PS4", label: "PS4" },
              ]}
              ariaLabel="Platforma"
              align="end"
            />
            <PlatformInfoButton />
          </div>

          <button
            type="button"
            onClick={() => setOnSale((v) => !v)}
            className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
              onSale
                ? "border-emerald-500/60 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 text-emerald-200 shadow-[0_6px_24px_-10px_rgba(16,185,129,0.6)]"
                : "border-transparent bg-zinc-950/60 text-zinc-300 hover:bg-zinc-900"
            }`}
          >
            <Tag className={`h-4 w-4 ${onSale ? "text-emerald-300" : ""}`} />
            Endirimdə
            {onSale && (
              <span className="ml-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            )}
          </button>
        </div>
      </div>

      {activeFilterChips.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {activeFilterChips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-xs text-indigo-200"
            >
              {chip.label}
              <button
                type="button"
                onClick={chip.onRemove}
                aria-label={`${chip.label} filtrini sil`}
                className="rounded-full p-0.5 hover:bg-indigo-500/20"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200"
          >
            Hamısını təmizlə
          </button>
        </div>
      )}

      <div className="relative">
        {loading && <ProgressBar />}

        {loading && data.results.length === 0 ? (
          <SkeletonGrid />
        ) : data.results.length === 0 ? (
          <EmptyState query={query} hasActiveFilter={hasActiveFilter} onClear={clearFilters} />
        ) : (
          <ul
            className={`grid grid-cols-1 gap-5 transition duration-200 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${
              loading ? "pointer-events-none opacity-50" : "opacity-100"
            }`}
            aria-busy={loading}
          >
            {data.results.map((g, i) => (
              <GameCard key={g.id} game={g} priority={i < 4} />
            ))}
          </ul>
        )}
      </div>

      <Pagination
        page={page}
        totalPages={data.totalPages ?? Math.max(1, Math.ceil((data.total || 0) / pageSize))}
        loading={loading}
        onPageChange={setPage}
      />
    </>
  );
}

function ProgressBar() {
  return (
    <div className="absolute -top-1 left-0 right-0 z-10 h-0.5 overflow-hidden rounded-full bg-zinc-800/60">
      <div className="ps-progress h-full w-1/3 rounded-full bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-indigo-500" />
      <style jsx>{`
        .ps-progress {
          animation: ps-progress 1.1s ease-in-out infinite;
        }
        @keyframes ps-progress {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(150%);
          }
          100% {
            transform: translateX(350%);
          }
        }
      `}</style>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <ul
      aria-hidden
      className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <li
          key={i}
          className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40"
        >
          <div className="aspect-square w-full animate-pulse bg-zinc-800/60" />
          <div className="space-y-3 p-4">
            <div className="h-4 w-4/5 animate-pulse rounded bg-zinc-800/70" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-800/70" />
            <div className="h-7 w-1/2 animate-pulse rounded bg-zinc-800/80" />
            <div className="h-9 w-full animate-pulse rounded bg-zinc-800/60" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Dropdown({
  icon,
  value,
  onChange,
  options,
  ariaLabel,
  align = "start",
}: {
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % options.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + options.length) % options.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const opt = options[activeIndex];
        if (opt) {
          onChange(opt.value);
          setOpen(false);
        }
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, options, activeIndex, onChange]);

  useEffect(() => {
    if (open) {
      const i = options.findIndex((o) => o.value === value);
      setActiveIndex(i >= 0 ? i : 0);
    }
  }, [open, options, value]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className={`group inline-flex w-full min-w-[10rem] items-center gap-2 rounded-lg border bg-zinc-950/60 py-2.5 pl-3 pr-2 text-sm text-zinc-100 transition hover:bg-zinc-900 ${
          open
            ? "border-indigo-500/60 bg-zinc-950 ring-2 ring-indigo-500/20"
            : "border-transparent"
        }`}
      >
        <span className="text-zinc-500">{icon}</span>
        <span className="flex-1 truncate text-left">{selected?.label}</span>
        <ChevronDown
          className={`h-4 w-4 text-zinc-500 transition-transform duration-200 ${
            open ? "rotate-180 text-indigo-400" : ""
          }`}
        />
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute z-[60] mt-2 min-w-full origin-top overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/95 p-1 shadow-2xl shadow-black/60 ring-1 ring-black/40 backdrop-blur ${
            align === "end" ? "right-0" : "left-0"
          }`}
          style={{ animation: "dropdown-in 140ms ease-out" }}
        >
          {options.map((o, i) => {
            const isSelected = o.value === value;
            const isActive = i === activeIndex;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 whitespace-nowrap rounded-md px-3 py-2 text-left text-sm transition ${
                  isSelected
                    ? "bg-indigo-500/15 text-indigo-100"
                    : isActive
                      ? "bg-zinc-800/70 text-zinc-100"
                      : "text-zinc-300"
                }`}
              >
                <span>{o.label}</span>
                {isSelected ? (
                  <Check className="h-4 w-4 text-indigo-300" />
                ) : (
                  <span className="h-4 w-4" />
                )}
              </button>
            );
          })}
          <style jsx>{`
            @keyframes dropdown-in {
              from {
                opacity: 0;
                transform: translateY(-4px) scale(0.98);
              }
              to {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}

function EmptyState({
  query,
  hasActiveFilter,
  onClear,
}: {
  query: string;
  hasActiveFilter: boolean;
  onClear: () => void;
}) {
  if (hasActiveFilter) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-10 text-center">
        <Search className="mx-auto h-10 w-10 text-zinc-600" />
        <p className="mt-3 text-sm text-zinc-300">
          {query.trim().length >= 2
            ? `“${query.trim()}” üzrə nəticə tapılmadı.`
            : "Seçilmiş filtrlərə uyğun nəticə tapılmadı."}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Filtrləri sıfırlayıb yenidən cəhd edin.
        </p>
        <button
          type="button"
          onClick={onClear}
          className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
        >
          <X className="h-4 w-4" /> Filtrləri sıfırla
        </button>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-10 text-center">
      <Gamepad2 className="mx-auto h-10 w-10 text-zinc-600" />
      <p className="mt-3 text-sm text-zinc-400">
        Bu kateqoriyada hələ məhsul yoxdur.
      </p>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  loading,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  loading: boolean;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  const clampedPage = Math.min(Math.max(1, page), totalPages);
  const canPrev = clampedPage > 1 && !loading;
  const canNext = clampedPage < totalPages && !loading;

  // Keep the UI stable if page got out-of-range after filtering.
  if (clampedPage !== page) {
    queueMicrotask(() => onPageChange(clampedPage));
  }

  const pages: number[] = [];
  const push = (p: number) => {
    if (p >= 1 && p <= totalPages && !pages.includes(p)) pages.push(p);
  };
  push(1);
  push(clampedPage - 1);
  push(clampedPage);
  push(clampedPage + 1);
  push(totalPages);
  pages.sort((a, b) => a - b);

  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        disabled={!canPrev}
        onClick={() => onPageChange(clampedPage - 1)}
        className={`rounded-lg border px-3 py-2 text-sm transition ${
          canPrev
            ? "border-zinc-800 bg-zinc-950/60 text-zinc-200 hover:bg-zinc-900"
            : "border-zinc-900 bg-zinc-950/40 text-zinc-600"
        }`}
      >
        Əvvəlki
      </button>

      <div className="flex items-center gap-1">
        {pages.map((p, idx) => {
          const prev = pages[idx - 1];
          const showDots = idx > 0 && prev !== undefined && p - prev > 1;
          return (
            <span key={p} className="flex items-center gap-1">
              {showDots && <span className="px-1 text-zinc-600">…</span>}
              <button
                type="button"
                disabled={loading}
                onClick={() => onPageChange(p)}
                className={`min-w-[2.5rem] rounded-lg border px-3 py-2 text-sm font-semibold tabular-nums transition ${
                  p === clampedPage
                    ? "border-indigo-500/60 bg-indigo-500/10 text-indigo-100 shadow-[0_6px_24px_-14px_rgba(99,102,241,0.7)]"
                    : "border-zinc-800 bg-zinc-950/60 text-zinc-200 hover:bg-zinc-900"
                } ${loading ? "opacity-60" : ""}`}
                aria-current={p === clampedPage ? "page" : undefined}
              >
                {p}
              </button>
            </span>
          );
        })}
      </div>

      <button
        type="button"
        disabled={!canNext}
        onClick={() => onPageChange(clampedPage + 1)}
        className={`rounded-lg border px-3 py-2 text-sm transition ${
          canNext
            ? "border-zinc-800 bg-zinc-950/60 text-zinc-200 hover:bg-zinc-900"
            : "border-zinc-900 bg-zinc-950/40 text-zinc-600"
        }`}
      >
        Növbəti
      </button>

      <span className="ml-1 text-xs text-zinc-500">
        Səhifə <span className="font-bold text-zinc-200">{clampedPage}</span> /{" "}
        <span className="font-bold text-zinc-200">{totalPages}</span>
      </span>
    </div>
  );
}
