"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  Film,
  Gamepad2,
  Gift,
  Loader2,
  Plus,
  Search as SearchIcon,
  Sparkles,
  Tv,
  X,
} from "lucide-react";
import { useCart } from "@/lib/cart";

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
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Cmd/Ctrl + K — global shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
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

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-black/80 p-3 backdrop-blur-md sm:p-6 sm:pt-[8vh]"
          role="dialog"
          aria-modal="true"
          onClick={close}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#0c0e16] to-[#070910] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.95)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3.5 sm:px-5">
              <SearchIcon className="h-5 w-5 shrink-0 text-zinc-500" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Oyun, hədiyyə kartı, film və ya serial axtar..."
                className="flex-1 bg-transparent text-base text-white placeholder:text-zinc-600 focus:outline-none sm:text-lg"
              />
              {loading && <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />}
              <button
                type="button"
                onClick={close}
                aria-label="Bağla"
                className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.04] text-zinc-400 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tabs */}
            {results && hasAny && (
              <div className="flex gap-1 overflow-x-auto border-b border-white/5 px-3 py-2 sm:px-4">
                {(
                  [
                    { key: "ALL", label: "Hamısı" },
                    { key: "GAMES", label: "Oyunlar" },
                    { key: "SERVICES", label: "Servislər" },
                    { key: "STREAMING", label: "Streaming" },
                  ] as { key: Tab; label: string }[]
                ).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      tab === t.key
                        ? "bg-white text-zinc-900"
                        : "bg-white/[0.03] text-zinc-300 hover:bg-white/[0.07]"
                    }`}
                  >
                    {t.label}
                    {counts[t.key] > 0 && (
                      <span
                        className={`rounded-full px-1.5 text-[10px] font-bold ${
                          tab === t.key ? "bg-zinc-900/10 text-zinc-700" : "bg-white/10 text-zinc-400"
                        }`}
                      >
                        {counts[t.key]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {!debounced || debounced.length < 2 ? (
                <EmptyState />
              ) : loading && !results ? (
                <div className="grid place-items-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
                </div>
              ) : !hasAny ? (
                <NoResults q={debounced} />
              ) : (
                <div className="px-3 pb-4 pt-2 sm:px-4">
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
            <div className="border-t border-white/5 bg-black/30 px-4 py-2 text-[11px] text-zinc-500">
              <span className="hidden sm:inline">
                <kbd className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px]">
                  ↵
                </kbd>{" "}
                Aç ·{" "}
                <kbd className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px]">
                  Esc
                </kbd>{" "}
                Bağla
              </span>
              <span className="sm:hidden">Axtarış üçün ən az 2 simvol</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Subcomponents ────────────────────────────────────────── */

function EmptyState() {
  const suggestions = [
    "Spider-Man",
    "PS Plus",
    "Netflix",
    "FIFA",
    "Hogwarts",
    "Stranger Things",
  ];
  return (
    <div className="px-5 py-10 text-center">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.03]">
        <Sparkles className="h-5 w-5 text-amber-300" />
      </div>
      <p className="text-sm font-semibold text-zinc-200">Hər şeyi axtar</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-zinc-500">
        PS oyunları, hədiyyə kartları, hesab açma, streaming film və serialları —
        hamısı bir yerdə.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {suggestions.map((s) => (
          <span
            key={s}
            className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-zinc-400"
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

function NoResults({ q }: { q: string }) {
  return (
    <div className="px-5 py-12 text-center">
      <p className="text-sm font-semibold text-zinc-200">
        &quot;{q}&quot; üçün heç nə tapılmadı
      </p>
      <p className="mt-1 text-xs text-zinc-500">
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
    <div className="mb-4">
      <p className="mb-2 flex items-center gap-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
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
      className="group flex items-center gap-3 rounded-xl border border-transparent p-2 transition hover:border-white/10 hover:bg-white/[0.04]"
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-white/10">
        {item.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={item.imageUrl}
            alt={item.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
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
        <div className="mt-0.5 flex items-baseline gap-2">
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
        className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
          inCart
            ? "bg-emerald-400/15 text-emerald-300"
            : "bg-white text-zinc-900 hover:bg-amber-300"
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
      className="group flex items-center gap-3 rounded-xl border border-transparent p-2 transition hover:border-white/10 hover:bg-white/[0.04]"
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-white/10">
        {item.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={item.imageUrl}
            alt={item.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
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
      <span className="shrink-0 rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 transition group-hover:border-white/30 group-hover:text-white">
        Bax →
      </span>
    </Link>
  );
}
