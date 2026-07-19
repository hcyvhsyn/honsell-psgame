"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X, Loader2, Gamepad2, Package } from "lucide-react";

export type ScopeProduct = {
  id: string;
  title: string;
  imageUrl: string | null;
  subtitle: string;
  /** Yalnız servis məhsullarında. */
  type?: string;
};

type ApiResult = { games: ScopeProduct[]; services: ScopeProduct[] };

/**
 * Kupona konkret oyun / servis məhsulu bağlamaq üçün axtarış-seç picker-i.
 * Seçim id ilə saxlanır (metadata qruplaşması kövrəkdir) — Spotify kimi çox
 * planlı platformalarda admin bütün planları seçir.
 */
export default function PromoScopePicker({
  gameIds,
  serviceProductIds,
  onChange,
  onNamesChange,
}: {
  gameIds: string[];
  serviceProductIds: string[];
  onChange: (next: { gameIds: string[]; serviceProductIds: string[] }) => void;
  /** Seçilmiş məhsul id → ad (müştəri mətni üçün valideynə ötürülür). */
  onNamesChange?: (names: Record<string, string>) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ApiResult>({ games: [], services: [] });
  const [searching, setSearching] = useState(false);
  /** Seçilmiş id → məhsul (ad göstərmək üçün; forma açılanda API-dən doldurulur). */
  const [known, setKnown] = useState<Record<string, ScopeProduct>>({});
  const reqId = useRef(0);

  const selectedIds = [...gameIds, ...serviceProductIds];
  const selectedKey = selectedIds.join(",");

  // Seçilmiş id-lərin adları həll olunduqca valideynə xəbər ver (müştəri mətni).
  useEffect(() => {
    if (!onNamesChange) return;
    const names: Record<string, string> = {};
    for (const id of selectedIds) if (known[id]) names[id] = known[id].title;
    onNamesChange(names);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, known]);

  // Yadda saxlanmış scope id-lərinin adlarını yüklə (yalnız naməlum olanları).
  useEffect(() => {
    const missing = selectedIds.filter((id) => !known[id]);
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/promo-codes/products?ids=${missing.join(",")}`, {
          cache: "no-store",
        });
        const data: ApiResult = await res.json();
        if (cancelled) return;
        setKnown((prev) => {
          const next = { ...prev };
          for (const p of [...(data.games ?? []), ...(data.services ?? [])]) next[p.id] = p;
          return next;
        });
      } catch {
        // ad göstərilməsə də id ilə işləyir
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  // Axtarış (debounce).
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults({ games: [], services: [] });
      setSearching(false);
      return;
    }
    setSearching(true);
    const myId = ++reqId.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/promo-codes/products?q=${encodeURIComponent(term)}`, {
          cache: "no-store",
        });
        const data: ApiResult = await res.json();
        if (myId !== reqId.current) return; // köhnə cavab
        setResults({ games: data.games ?? [], services: data.services ?? [] });
      } catch {
        if (myId === reqId.current) setResults({ games: [], services: [] });
      } finally {
        if (myId === reqId.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const toggle = useCallback(
    (p: ScopeProduct, isGame: boolean) => {
      setKnown((prev) => ({ ...prev, [p.id]: p }));
      if (isGame) {
        onChange({
          gameIds: gameIds.includes(p.id) ? gameIds.filter((x) => x !== p.id) : [...gameIds, p.id],
          serviceProductIds,
        });
      } else {
        onChange({
          gameIds,
          serviceProductIds: serviceProductIds.includes(p.id)
            ? serviceProductIds.filter((x) => x !== p.id)
            : [...serviceProductIds, p.id],
        });
      }
    },
    [gameIds, serviceProductIds, onChange],
  );

  function removeId(id: string) {
    onChange({
      gameIds: gameIds.filter((x) => x !== id),
      serviceProductIds: serviceProductIds.filter((x) => x !== id),
    });
  }

  /** Eyni tipli bütün nəticələri bir kliklə seç (məs. Spotify-ın 3 planı). */
  function addAllServices() {
    const ids = results.services.map((s) => s.id);
    setKnown((prev) => {
      const next = { ...prev };
      for (const s of results.services) next[s.id] = s;
      return next;
    });
    onChange({ gameIds, serviceProductIds: [...new Set([...serviceProductIds, ...ids])] });
  }

  const hasResults = results.games.length > 0 || results.services.length > 0;

  return (
    <div className="space-y-2">
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedIds.map((id) => {
            const p = known[id];
            return (
              <span
                key={id}
                className="inline-flex max-w-full items-center gap-1 rounded-lg bg-violet-100 px-2 py-1 text-xs font-medium text-violet-800"
              >
                {gameIds.includes(id) ? (
                  <Gamepad2 className="h-3 w-3 shrink-0" />
                ) : (
                  <Package className="h-3 w-3 shrink-0" />
                )}
                <span className="truncate">{p ? p.title : id}</span>
                <button
                  type="button"
                  onClick={() => removeId(id)}
                  className="shrink-0 rounded p-0.5 hover:bg-violet-200"
                  title="Çıxar"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="promo-input pl-8"
          placeholder="Məhsul axtar (məs. Spotify, God of War)…"
        />
        {searching && (
          <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-400" />
        )}
      </div>

      {q.trim().length >= 2 && !searching && !hasResults && (
        <p className="px-1 text-xs text-zinc-500">Nəticə tapılmadı.</p>
      )}

      {hasResults && (
        <div className="max-h-56 overflow-y-auto rounded-lg border border-zinc-200">
          {results.services.length > 0 && (
            <div className="flex items-center justify-between bg-zinc-50 px-2.5 py-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                Servis / platforma
              </span>
              <button
                type="button"
                onClick={addAllServices}
                className="text-[10px] font-semibold text-violet-600 hover:underline"
              >
                Hamısını seç ({results.services.length})
              </button>
            </div>
          )}
          {results.services.map((s) => (
            <Row
              key={s.id}
              p={s}
              checked={serviceProductIds.includes(s.id)}
              onToggle={() => toggle(s, false)}
            />
          ))}
          {results.games.length > 0 && (
            <div className="bg-zinc-50 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
              Oyunlar
            </div>
          )}
          {results.games.map((g) => (
            <Row key={g.id} p={g} checked={gameIds.includes(g.id)} onToggle={() => toggle(g, true)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ p, checked, onToggle }: { p: ScopeProduct; checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center gap-2 border-t border-zinc-100 px-2.5 py-2 text-left hover:bg-violet-50 ${
        checked ? "bg-violet-50/60" : ""
      }`}
    >
      <input type="checkbox" checked={checked} readOnly className="h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-zinc-800">{p.title}</div>
        <div className="truncate text-[10px] text-zinc-500">{p.subtitle}</div>
      </div>
    </button>
  );
}
