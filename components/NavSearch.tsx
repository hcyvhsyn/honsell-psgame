"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Brain,
  Check,
  Crown,
  Eraser,
  Film,
  Gamepad2,
  Gift,
  Loader2,
  Music,
  Plus,
  Search as SearchIcon,
  Sparkles,
  Trophy,
  Tv,
  X,
} from "lucide-react";
import { useCart } from "@/lib/cart";
import {
  DEFAULT_SEARCH_SUGGESTIONS,
  type SearchSuggestionDto,
  type SearchSuggestionIconKey,
} from "@/lib/searchSuggestions";

const SUGGESTION_ICONS: Record<
  SearchSuggestionIconKey,
  React.ComponentType<{ className?: string }>
> = {
  SEARCH: SearchIcon,
  GAMEPAD: Gamepad2,
  GIFT: Gift,
  TV: Tv,
  FILM: Film,
  SPARKLES: Sparkles,
  TROPHY: Trophy,
  CROWN: Crown,
  MUSIC: Music,
  BRAIN: Brain,
};

type CartPayload = {
  id: string;
  title: string;
  imageUrl: string | null;
  finalAzn: number;
  productType: string;
};

type GameResult = {
  kind: "GAME";
  id: string;
  productId: string;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  href: string;
  productType: string;
  finalAzn: number;
  originalAzn: number | null;
  cartPayload: CartPayload;
};

type ServiceResult = {
  kind: "SERVICE";
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  href: string;
  finalAzn: number;
  originalAzn: number | null;
  cartPayload: CartPayload;
};

type StreamingTitleResult = {
  kind: "STREAMING_TITLE";
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  href: string;
};

type StreamingServiceResult = {
  kind: "STREAMING_SERVICE";
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  href: string;
};

type SearchResults = {
  games: GameResult[];
  services: ServiceResult[];
  streamingServices: StreamingServiceResult[];
  streamingTitles: StreamingTitleResult[];
};

type Tab = "ALL" | "GAMES" | "SERVICES" | "STREAMING";

export default function NavSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("ALL");
  const [mounted, setMounted] = useState(false);
  const [suggestions, setSuggestions] =
    useState<SearchSuggestionDto[]>(DEFAULT_SEARCH_SUGGESTIONS);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Modal ilk dəfə açılanda populyar axtarışları admin paneldəki konfiqurasiyadan çək.
  // Default siyahı API-dən cavab gəlməyincə (və ya boş gələndə) qalır.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/search/suggestions")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (Array.isArray(d?.suggestions) && d.suggestions.length > 0) {
          setSuggestions(d.suggestions as SearchSuggestionDto[]);
        }
      })
      .catch(() => {
        /* fallback default-da qalır */
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Trigger görünməyəndə (alternativ breakpoint instansiyası) Cmd+K bu modalı açmasın —
  // əks halda portala görə görünməz parent-də olan instans da modal yaradır.
  function isTriggerVisible() {
    return triggerRef.current?.offsetParent != null;
  }

  // Cmd/Ctrl + K — global shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        if (!isTriggerVisible()) return;
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape" && open) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Body scroll-u modal açılanda kilitlə
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Açılanda input-u fokusla
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Debounce sorğunu — istifadəçi yazmağı dayandırandan ~250ms sonra fetch edirik.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  // Fetch results
  useEffect(() => {
    if (!open) return;
    if (debounced.length < 2) {
      setResults(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(debounced)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setResults(d.results && typeof d.results === "object" ? (d.results as SearchResults) : null);
      })
      .catch(() => {
        if (!cancelled) setResults(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, open]);

  function close() {
    setOpen(false);
    setQ("");
    setDebounced("");
    setResults(null);
    setTab("ALL");
  }

  const hasAny =
    !!results &&
    (results.games.length > 0 ||
      results.services.length > 0 ||
      results.streamingTitles.length > 0 ||
      results.streamingServices.length > 0);

  const counts = {
    ALL: results
      ? results.games.length +
        results.services.length +
        results.streamingTitles.length +
        results.streamingServices.length
      : 0,
    GAMES: results?.games.length ?? 0,
    SERVICES: results?.services.length ?? 0,
    STREAMING:
      (results?.streamingServices.length ?? 0) + (results?.streamingTitles.length ?? 0),
  };

  return (
    <>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Axtar"
        className="group inline-flex h-11 w-full items-center gap-3 rounded-[20px] border border-violet-500/30 bg-[#090914]/85 px-4 text-left text-sm text-zinc-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_28px_-22px_rgba(124,58,237,0.9)] transition hover:border-violet-400/50 hover:bg-[#101022] hover:text-zinc-200 md:h-12 xl:h-12"
      >
        <SearchIcon className="h-5 w-5 shrink-0 text-zinc-200" />
        <span className="min-w-0 flex-1 truncate">GTA V, Netflix, PS Plus, Spotify axtar...</span>
        <span className="hidden rounded-lg border border-white/10 bg-white/[0.07] px-2.5 py-1 text-xs font-semibold text-zinc-200 md:inline">
          ⌘K
        </span>
      </button>

      {/* Modal — render to body so the header's backdrop-filter doesn't trap fixed positioning */}
      {open && mounted && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/85 p-3 backdrop-blur-xl sm:p-6 sm:pt-[10vh]"
          role="dialog"
          aria-modal="true"
          onClick={close}
        >
          {/* Decorative glow behind modal */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[8vh] h-[420px] w-[640px] -translate-x-1/2 rounded-full bg-gradient-to-br from-violet-600/30 via-fuchsia-500/15 to-transparent blur-3xl"
          />

          <div
            className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a14]/95 shadow-[0_50px_140px_-20px_rgba(99,1,243,0.45),0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top gradient accent line */}
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent"
            />

            {/* Search input */}
            <div className="relative flex items-center gap-3 px-5 py-5 sm:px-6 sm:py-6">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/25 to-fuchsia-500/10 ring-1 ring-inset ring-violet-400/30">
                <SearchIcon className="h-5 w-5 text-violet-200" />
              </div>
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Oyun, hədiyyə kartı, film və ya serial axtar..."
                className="flex-1 bg-transparent text-lg font-medium text-white placeholder:text-zinc-500 focus:outline-none sm:text-xl"
              />
              {loading && <Loader2 className="h-5 w-5 animate-spin text-violet-300" />}
              {q && !loading && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  aria-label="Mətni təmizlə"
                  title="Mətni təmizlə"
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/[0.05] px-3 text-[11px] font-semibold text-zinc-400 ring-1 ring-inset ring-white/[0.07] transition hover:bg-white/[0.1] hover:text-white"
                >
                  <Eraser className="h-3.5 w-3.5" />
                  Sil
                </button>
              )}
              <button
                type="button"
                onClick={close}
                aria-label="Modalı bağla"
                title="Bağla (Esc)"
                className="grid h-9 w-9 place-items-center rounded-xl border border-rose-400/30 bg-rose-500/10 text-rose-200 transition hover:border-rose-400/60 hover:bg-rose-500/20 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tabs */}
            {results && hasAny && (
              <div className="border-b border-white/[0.06] px-5 pb-4 sm:px-6">
                <div className="inline-flex items-center gap-1 rounded-2xl border border-white/[0.08] bg-black/40 p-1">
                  {(
                    [
                      { key: "ALL", label: "Hamısı" },
                      { key: "GAMES", label: "Oyunlar" },
                      { key: "SERVICES", label: "Servislər" },
                      { key: "STREAMING", label: "Streaming" },
                    ] as { key: Tab; label: string }[]
                  ).map((t) => {
                    const active = tab === t.key;
                    const c = counts[t.key];
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setTab(t.key)}
                        className={`relative inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                          active
                            ? "bg-gradient-to-b from-violet-500 to-violet-600 text-white shadow-[0_4px_16px_-4px_rgba(124,58,237,0.7)]"
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        {t.label}
                        {c > 0 && (
                          <span
                            className={`grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold tabular-nums ${
                              active ? "bg-white/25 text-white" : "bg-white/[0.08] text-zinc-300"
                            }`}
                          >
                            {c}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {!debounced || debounced.length < 2 ? (
                <EmptyState onPick={setQ} suggestions={suggestions} />
              ) : loading && !results ? (
                <div className="grid place-items-center py-24">
                  <Loader2 className="h-7 w-7 animate-spin text-violet-400" />
                </div>
              ) : !hasAny ? (
                <NoResults q={debounced} />
              ) : (
                <div className="px-3 pb-5 pt-3 sm:px-5">
                  {(tab === "ALL" || tab === "GAMES") && results!.games.length > 0 && (
                    <Group title="Oyunlar" icon={<Gamepad2 className="h-3.5 w-3.5" />}>
                      {results!.games.map((g) => (
                        <ProductRow key={g.id} item={g} onPick={close} />
                      ))}
                    </Group>
                  )}
                  {(tab === "ALL" || tab === "SERVICES") &&
                    results!.services.length > 0 && (
                      <Group title="Servislər" icon={<Gift className="h-3.5 w-3.5" />}>
                        {results!.services.map((s) => (
                          <ProductRow key={s.id} item={s} onPick={close} />
                        ))}
                      </Group>
                    )}
                  {(tab === "ALL" || tab === "STREAMING") &&
                    results!.streamingServices.length > 0 && (
                      <Group title="Streaming xidmətləri" icon={<Tv className="h-3.5 w-3.5" />}>
                        {results!.streamingServices.map((s) => (
                          <LinkRow key={s.id} item={s} onPick={close} />
                        ))}
                      </Group>
                    )}
                  {(tab === "ALL" || tab === "STREAMING") &&
                    results!.streamingTitles.length > 0 && (
                      <Group title="Film və seriallar" icon={<Film className="h-3.5 w-3.5" />}>
                        {results!.streamingTitles.map((t) => (
                          <LinkRow key={t.id} item={t} onPick={close} />
                        ))}
                      </Group>
                    )}
                </div>
              )}
            </div>

            {/* Footer hint */}
            <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] bg-black/40 px-5 py-3 text-[11px] text-zinc-500 sm:px-6">
              <div className="flex items-center gap-4">
                <span className="hidden items-center gap-1.5 sm:inline-flex">
                  <kbd className="grid h-5 min-w-5 place-items-center rounded-md border border-white/10 bg-white/[0.05] px-1.5 font-mono text-[10px] font-semibold text-zinc-300">
                    ↵
                  </kbd>
                  <span>Aç</span>
                </span>
                <span className="hidden items-center gap-1.5 sm:inline-flex">
                  <kbd className="grid h-5 min-w-5 place-items-center rounded-md border border-white/10 bg-white/[0.05] px-1.5 font-mono text-[10px] font-semibold text-zinc-300">
                    Esc
                  </kbd>
                  <span>Bağla</span>
                </span>
                <span className="sm:hidden">Ən az 2 simvol yaz</span>
              </div>
              <span className="hidden items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] text-zinc-600 sm:inline-flex">
                <Sparkles className="h-3 w-3 text-violet-400/70" /> Honsell Search
              </span>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/* ─── Subcomponents ────────────────────────────────────────── */

function EmptyState({
  onPick,
  suggestions,
}: {
  onPick: (q: string) => void;
  suggestions: SearchSuggestionDto[];
}) {
  return (
    <div className="px-5 py-12 text-center">
      <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 ring-1 ring-inset ring-violet-400/25">
        <Sparkles className="h-6 w-6 text-violet-200" />
      </div>
      <p className="text-base font-bold text-white">Hər şeyi axtar</p>
      <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-zinc-500">
        PS oyunları, hədiyyə kartları, hesab açma, streaming film və serialları —
        hamısı bir yerdə.
      </p>
      {suggestions.length > 0 && (
        <>
      <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">
        Populyar axtarışlar
      </p>
      <div className="mx-auto mt-3 flex max-w-md flex-wrap justify-center gap-2">
        {suggestions.map((s) => {
          const Icon = SUGGESTION_ICONS[s.iconKey] ?? SearchIcon;
          return (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick(s.label)}
            className="group inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-zinc-300 transition hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-white"
          >
            <Icon className="h-3 w-3 text-zinc-500 transition group-hover:text-violet-300" />
            {s.label}
          </button>
          );
        })}
      </div>
        </>
      )}
    </div>
  );
}

function NoResults({ q }: { q: string }) {
  return (
    <div className="px-5 py-14 text-center">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
        <SearchIcon className="h-5 w-5 text-zinc-500" />
      </div>
      <p className="text-sm font-bold text-white">
        &quot;{q}&quot; üçün heç nə tapılmadı
      </p>
      <p className="mx-auto mt-1.5 max-w-sm text-xs text-zinc-500">
        Başqa sözlə cəhd et və ya yazılışı yoxla.
      </p>
    </div>
  );
}

function Group({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5 last:mb-0">
      <p className="mb-2 flex items-center gap-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300/70">
        {icon} {title}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function ProductRow({
  item,
  onPick,
}: {
  item: GameResult | ServiceResult;
  onPick: () => void;
}) {
  const cart = useCart();
  const inCart = cart.has(item.cartPayload.id);

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (inCart) return;
    cart.add(item.cartPayload);
  }

  return (
    <Link
      href={item.href}
      onClick={onPick}
      className="group flex items-center gap-3 rounded-2xl border border-transparent p-2.5 transition hover:border-violet-400/20 hover:bg-gradient-to-r hover:from-violet-500/[0.08] hover:to-transparent"
    >
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-white/10 transition group-hover:ring-violet-400/40">
        {item.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={item.imageUrl}
            alt={item.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-zinc-700">
            {item.kind === "GAME" ? (
              <Gamepad2 className="h-5 w-5" />
            ) : (
              <Gift className="h-5 w-5" />
            )}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{item.title}</p>
        <p className="truncate text-[11px] text-zinc-500">{item.subtitle}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-sm font-bold text-amber-300 tabular-nums">
            {item.finalAzn.toFixed(2)} ₼
          </span>
          {item.originalAzn != null && item.originalAzn > item.finalAzn && (
            <span className="text-[11px] text-zinc-600 line-through tabular-nums">
              {item.originalAzn.toFixed(2)} ₼
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={handleAdd}
        disabled={inCart}
        className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition ${
          inCart
            ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/30"
            : "bg-white text-zinc-900 shadow-[0_4px_14px_-4px_rgba(255,255,255,0.4)] hover:bg-amber-300 hover:shadow-[0_4px_14px_-4px_rgba(252,211,77,0.6)]"
        }`}
      >
        {inCart ? (
          <>
            <Check className="h-3.5 w-3.5" /> Səbətdə
          </>
        ) : (
          <>
            <Plus className="h-3.5 w-3.5" /> Səbətə
          </>
        )}
      </button>
    </Link>
  );
}

function LinkRow({
  item,
  onPick,
}: {
  item: StreamingTitleResult | StreamingServiceResult;
  onPick: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onPick}
      className="group flex items-center gap-3 rounded-2xl border border-transparent p-2.5 transition hover:border-violet-400/20 hover:bg-gradient-to-r hover:from-violet-500/[0.08] hover:to-transparent"
    >
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-white/10 transition group-hover:ring-violet-400/40">
        {item.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={item.imageUrl}
            alt={item.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-zinc-700">
            {item.kind === "STREAMING_TITLE" ? (
              <Film className="h-5 w-5" />
            ) : (
              <Tv className="h-5 w-5" />
            )}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{item.title}</p>
        <p className="truncate text-[11px] text-zinc-500">{item.subtitle}</p>
      </div>
      <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[11px] font-semibold text-zinc-300 transition group-hover:border-violet-400/40 group-hover:bg-violet-500/10 group-hover:text-white">
        Bax →
      </span>
    </Link>
  );
}
