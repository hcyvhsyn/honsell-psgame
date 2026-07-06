"use client";

import {
  startTransition,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  BadgeCheck,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Quote,
  Search,
  ShieldCheck,
  Star,
  X,
  type LucideIcon,
} from "lucide-react";
import TierBadge from "@/components/TierBadge";
import type {
  PublicTestimonialItem,
  PublicTestimonialsPage,
} from "@/lib/publicTestimonials";
import styles from "./TestimonialsRail.module.css";

const PLATFORM_LABELS: Record<string, string> = {
  GAME: "Oyun",
  PS_PLUS: "PS Plus",
  GIFT_CARD: "Hədiyyə kartı",
  ACCOUNT_CREATION: "Hesab açma",
  STREAMING: "Streaming",
  MUSIC: "Musiqi",
};

const PLATFORM_OPTIONS = [
  { value: "", label: "Bütün məhsullar" },
  ...Object.entries(PLATFORM_LABELS).map(([value, label]) => ({ value, label })),
];

const RATING_OPTIONS = [
  { value: "", label: "Bütün reytinqlər" },
  ...[5, 4, 3, 2, 1].map((value) => ({ value: String(value), label: `${value} ulduz` })),
];

type DropdownOption = { value: string; label: string };

function CustomDropdown({
  value,
  options,
  onChange,
  label,
  Icon,
  className = "",
}: {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  label: string;
  Icon: LucideIcon;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = useId();
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const selected = options[selectedIndex] ?? options[0];

  useEffect(() => {
    if (!open) return;

    function closeOnOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function openAndFocus(index: number) {
    setOpen(true);
    requestAnimationFrame(() => optionRefs.current[index]?.focus());
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openAndFocus(selectedIndex);
    }
  }

  function handleOptionKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowDown") nextIndex = (index + 1) % options.length;
    if (event.key === "ArrowUp") nextIndex = (index - 1 + options.length) % options.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = options.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    optionRefs.current[nextIndex]?.focus();
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={label}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
        className="flex h-11 w-full items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 text-left text-xs font-semibold text-zinc-700 outline-none transition hover:border-violet-300 focus-visible:border-violet-400 focus-visible:ring-2 focus-visible:ring-violet-400/20 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:border-violet-300/30"
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{selected.label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={label}
          className={`${styles.dropdownPanel} absolute left-0 top-full z-[90] mt-2 min-w-full overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/95 p-1.5 shadow-2xl shadow-zinc-950/15 backdrop-blur-xl dark:border-white/10 dark:bg-[#18151f]/95 dark:shadow-black/50`}
        >
          {options.map((option, index) => {
            const active = option.value === value;
            return (
              <button
                key={option.value || "all"}
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold outline-none transition focus-visible:bg-violet-100 dark:focus-visible:bg-violet-400/15 ${
                  active
                    ? "bg-violet-100 text-violet-800 dark:bg-violet-400/15 dark:text-violet-200"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
                }`}
              >
                <span className="grid h-4 w-4 shrink-0 place-items-center">
                  {active && <Check className="h-3.5 w-3.5" aria-hidden />}
                </span>
                <span className="whitespace-nowrap">{option.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function AdminReply({ item }: { item: PublicTestimonialItem }) {
  const text = item.adminReply;
  const imageUrl = item.adminReplyImageUrl;
  const isLong = Boolean(text && text.length > 220);
  const shellClass =
    "mt-4 rounded-2xl border border-violet-200/80 bg-violet-50/70 px-3.5 py-3 dark:border-violet-300/15 dark:bg-violet-400/[0.06]";
  const heading = (
    <div className="flex items-center gap-2 text-[11px] font-bold text-violet-700 dark:text-violet-200">
      <span className="grid h-5 w-5 place-items-center rounded-lg bg-violet-600 text-white shadow-sm shadow-violet-500/30">
        <ShieldCheck className="h-3 w-3" aria-hidden />
      </span>
      Honsell cavabı
    </div>
  );

  if (!isLong) {
    return (
      <div className={shellClass}>
        {heading}
        {text && <p className="mt-2 text-xs leading-5 text-zinc-700 dark:text-zinc-300">{text}</p>}
        {imageUrl && <ReplyImage src={imageUrl} />}
      </div>
    );
  }

  return (
    <details className={`group/reply ${shellClass}`}>
      <summary className="cursor-pointer list-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50 [&::-webkit-details-marker]:hidden">
        {heading}
        <p className="mt-2 line-clamp-3 text-xs leading-5 text-zinc-700 group-open/reply:hidden dark:text-zinc-300">
          {text}
        </p>
        {imageUrl && <ReplyImage src={imageUrl} />}
        <span className="mt-2 flex w-fit items-center gap-1 rounded-full border border-violet-200 bg-white/70 px-2.5 py-1 text-[10px] font-bold text-violet-700 transition hover:border-violet-300 hover:bg-white group-open/reply:bg-violet-100 dark:border-violet-300/20 dark:bg-white/[0.05] dark:text-violet-200 dark:hover:bg-white/[0.09] dark:group-open/reply:bg-violet-400/10">
          <span className="group-open/reply:hidden">Davamını oxu</span>
          <span className="hidden group-open/reply:inline">Bağla</span>
          <ChevronDown className="h-3 w-3 transition-transform group-open/reply:rotate-180" aria-hidden />
        </span>
      </summary>
      <p className="mt-2 text-xs leading-5 text-zinc-700 dark:text-zinc-300">{text}</p>
    </details>
  );
}

function ReplyImage({ src }: { src: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Honsell cavabı"
      className="mt-2 max-h-28 w-full rounded-xl border border-violet-100 object-cover dark:border-white/10"
    />
  );
}

function ReviewCard({ item }: { item: PublicTestimonialItem }) {
  const rating = Math.max(1, Math.min(5, item.rating));

  return (
    <figure className="relative flex h-[430px] w-[min(390px,calc(100vw-2rem))] flex-none snap-start flex-col rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-violet-300/60 hover:shadow-xl dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-violet-300/25 sm:h-[440px] sm:p-6">
      <Quote className="absolute right-5 top-5 h-8 w-8 text-violet-500/15 dark:text-violet-300/15" />

      <div className={`${styles.cardBody} min-h-0 flex-1 overflow-y-auto pr-1`}>
        <div className="flex items-center gap-1 text-amber-400">
          {Array.from({ length: 5 }).map((_, index) => (
            <Star
              key={index}
              className={`h-4 w-4 ${index < rating ? "fill-current" : "text-zinc-300 dark:text-zinc-700"}`}
            />
          ))}
        </div>
        <blockquote className="mt-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          “{item.text}”
        </blockquote>
        {item.adminReply || item.adminReplyImageUrl ? <AdminReply item={item} /> : null}
      </div>

      <figcaption className="mt-4 flex shrink-0 items-center gap-3 border-t border-zinc-100 pt-4 dark:border-white/10">
        <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-violet-600/10 text-sm font-black text-violet-700 dark:bg-violet-400/10 dark:text-violet-200">
          {item.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.avatarUrl} alt={item.name} className="h-full w-full object-cover" />
          ) : (
            initials(item.name)
          )}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-sm font-bold text-zinc-900 dark:text-white">
            <span className="truncate">{item.name}</span>
            <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-violet-500" />
          </div>
          <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
            Təsdiqlənmiş alıcı · {item.productTitle ?? PLATFORM_LABELS[item.platform] ?? "Məhsul"}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
            <span>Status:</span>
            {item.tier ? (
              <TierBadge tier={item.tier} full className="px-1.5 py-0 text-[9px]" />
            ) : (
              <span className="rounded-full border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 font-semibold text-zinc-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-300">
                Honsell müştərisi
              </span>
            )}
          </div>
        </div>
      </figcaption>
    </figure>
  );
}

type Filters = { query: string; platform: string; rating: string };

export default function TestimonialsRail({
  initialData,
}: {
  initialData: PublicTestimonialsPage;
}) {
  const [data, setData] = useState(initialData);
  const [draftQuery, setDraftQuery] = useState("");
  const [filters, setFilters] = useState<Filters>({ query: "", platform: "", rating: "" });
  const [page, setPage] = useState(initialData.page);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const initialRender = useRef(true);
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    const controller = new AbortController();
    let active = true;
    const params = new URLSearchParams({ page: String(page) });
    if (filters.query) params.set("q", filters.query);
    if (filters.platform) params.set("platform", filters.platform);
    if (filters.rating) params.set("rating", filters.rating);

    setLoading(true);
    setError("");
    fetch(`/api/testimonials?${params.toString()}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Rəylər yüklənmədi.");
        return payload as PublicTestimonialsPage;
      })
      .then((payload) => {
        if (!active) return;
        startTransition(() => {
          setData(payload);
          setPage(payload.page);
          railRef.current?.scrollTo({ left: 0, behavior: "smooth" });
        });
      })
      .catch((fetchError: unknown) => {
        if (!active) return;
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setError(fetchError instanceof Error ? fetchError.message : "Rəylər yüklənmədi.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [filters, page]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setFilters((current) => ({ ...current, query: draftQuery.trim() }));
  }

  function updateFilter(key: "platform" | "rating", value: string) {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function clearFilters() {
    setDraftQuery("");
    setPage(1);
    setFilters({ query: "", platform: "", rating: "" });
  }

  function scrollRail(direction: -1 | 1) {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * Math.max(300, rail.clientWidth * 0.82), behavior: "smooth" });
  }

  const hasFilters = Boolean(filters.query || filters.platform || filters.rating);

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <form onSubmit={submitSearch} className="flex min-w-0 items-center rounded-2xl border border-zinc-200 bg-white p-1 dark:border-white/10 dark:bg-white/[0.04] sm:w-80">
            <Search className="ml-2 h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
            <input
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value)}
              placeholder="Müştəri və ya məhsul axtar"
              aria-label="Müştəri və ya məhsul axtar"
              className="min-w-0 flex-1 bg-transparent px-2 py-2 text-xs text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-white"
            />
            <button type="submit" className="rounded-xl bg-violet-600 px-3 py-2 text-[10px] font-bold text-white transition hover:bg-violet-500">
              Axtar
            </button>
          </form>

          <CustomDropdown
            value={filters.platform}
            options={PLATFORM_OPTIONS}
            onChange={(value) => updateFilter("platform", value)}
            label="Məhsul növü"
            Icon={Filter}
            className="w-full sm:w-44"
          />

          <CustomDropdown
            value={filters.rating}
            options={RATING_OPTIONS}
            onChange={(value) => updateFilter("rating", value)}
            label="Ulduz sayı"
            Icon={Star}
            className="w-full sm:w-40"
          />

          {hasFilters && (
            <button type="button" onClick={clearFilters} className="inline-flex h-10 items-center gap-1 rounded-xl px-2 text-[10px] font-bold text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/[0.06] dark:hover:text-white">
              <X className="h-3.5 w-3.5" aria-hidden /> Təmizlə
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            <b className="text-zinc-900 dark:text-white">{data.total}</b> rəy tapıldı
          </span>
          <div className="flex gap-1">
            <button type="button" onClick={() => scrollRail(-1)} aria-label="Sola sürüşdür" className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-200 bg-white text-zinc-600 transition hover:border-violet-300 hover:text-violet-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => scrollRail(1)} aria-label="Sağa sürüşdür" className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-200 bg-white text-zinc-600 transition hover:border-violet-300 hover:text-violet-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {error && <p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200">{error}</p>}

      <div className="relative">
        <div ref={railRef} className={`${styles.rail} flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 ${loading ? "opacity-55" : "opacity-100"}`} aria-busy={loading}>
          {data.items.map((item) => <ReviewCard key={item.id} item={item} />)}
          {data.items.length === 0 && (
            <div className="flex h-56 w-full items-center justify-center rounded-3xl border border-dashed border-zinc-300 text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-400">
              Bu filtrə uyğun rəy tapılmadı.
            </div>
          )}
        </div>
      </div>

      <Pagination page={data.page} totalPages={data.totalPages} onPage={setPage} disabled={loading} />
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onPage,
  disabled,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
  disabled: boolean;
}) {
  if (totalPages <= 1) return null;
  const visible = Array.from(new Set([1, page - 1, page, page + 1, totalPages]))
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b);

  return (
    <nav className="mt-4 flex flex-wrap items-center justify-center gap-1.5" aria-label="Rəy səhifələri">
      <button type="button" aria-label="Əvvəlki səhifə" disabled={disabled || page <= 1} onClick={() => onPage(page - 1)} className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-200 text-zinc-600 transition hover:border-violet-300 disabled:opacity-35 dark:border-white/10 dark:text-zinc-300">
        <ChevronLeft className="h-4 w-4" />
      </button>
      {visible.map((value, index) => (
        <span key={value} className="contents">
          {index > 0 && value - visible[index - 1] > 1 && <span className="px-1 text-xs text-zinc-400">…</span>}
          <button
            type="button"
            disabled={disabled}
            aria-current={value === page ? "page" : undefined}
            onClick={() => onPage(value)}
            className={`h-9 min-w-9 rounded-xl px-2 text-xs font-bold transition ${
              value === page
                ? "bg-violet-600 text-white shadow-lg shadow-violet-600/20"
                : "border border-zinc-200 text-zinc-600 hover:border-violet-300 dark:border-white/10 dark:text-zinc-300"
            }`}
          >
            {value}
          </button>
        </span>
      ))}
      <button type="button" aria-label="Növbəti səhifə" disabled={disabled || page >= totalPages} onClick={() => onPage(page + 1)} className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-200 text-zinc-600 transition hover:border-violet-300 disabled:opacity-35 dark:border-white/10 dark:text-zinc-300">
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}
