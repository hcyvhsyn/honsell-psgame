"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2,
  Search,
  Plus,
  Trash2,
  Send,
  Pause,
  Play,
  X,
  BellRing,
  AlertTriangle,
} from "lucide-react";
import {
  PRICE_WATCH_STATUS_CLASS,
  PRICE_WATCH_STATUS_LABEL,
  formatPhoneForDisplay,
  priceWatchStatus,
  type PriceWatchRow,
} from "@/lib/priceWatchShared";

type GameOption = {
  id: string;
  productId: string;
  title: string;
  imageUrl: string | null;
  platform: string | null;
  priceAzn: number;
  discountPct: number | null;
};

type StatusFilter = "ALL" | "WAITING" | "ON_SALE" | "NOTIFIED" | "PAUSED";

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "ALL", label: "Hamısı" },
  { key: "WAITING", label: "Gözləyir" },
  { key: "ON_SALE", label: "Endirimdədir" },
  { key: "NOTIFIED", label: "Xəbər verilib" },
  { key: "PAUSED", label: "Dayandırılıb" },
];

export default function PriceWatchAdminClient() {
  const [items, setItems] = useState<PriceWatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [wasenderConfigured, setWasenderConfigured] = useState(true);

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [gameQuery, setGameQuery] = useState("");
  const [gameOptions, setGameOptions] = useState<GameOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedGame, setSelectedGame] = useState<GameOption | null>(null);

  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/price-watch");
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      setWasenderConfigured(data.wasenderConfigured !== false);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Oyun axtarışı — debounced. Oyun seçildikdən sonra sorğu getmir.
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const term = gameQuery.trim();
    if (selectedGame || term.length < 2) {
      setGameOptions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/price-watch?q=${encodeURIComponent(term)}`);
        const data = await res.json();
        setGameOptions(Array.isArray(data.games) ? data.games : []);
      } catch {
        setGameOptions([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [gameQuery, selectedGame]);

  function resetForm() {
    setPhone("");
    setName("");
    setNote("");
    setGameQuery("");
    setSelectedGame(null);
    setGameOptions([]);
  }

  async function submit() {
    setError(null);
    setNotice(null);
    if (!selectedGame) {
      setError("Oyun seçin.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/price-watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, name, note, gameId: selectedGame.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Qeyd yaradılmadı.");
        return;
      }
      setNotice("Qeyd əlavə olundu. Oyun endirimə düşən kimi WhatsApp mesajı gedəcək.");
      resetForm();
      await load();
    } catch {
      setError("Şəbəkə xətası.");
    } finally {
      setSaving(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/price-watch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Dəyişiklik alınmadı.");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string, title: string) {
    if (!confirm(`"${title}" güdmə qeydi silinsin?`)) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/price-watch?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Silinmədi.");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function sendNow(id: string) {
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/price-watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Mesaj göndərilmədi.");
        return;
      }
      setNotice("Mesaj göndərildi.");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const visible = items.filter((r) =>
    filter === "ALL" ? true : priceWatchStatus(r) === filter
  );

  const onSaleCount = items.filter(
    (r) => r.isActive && r.notifyCount === 0 && r.isOnSale
  ).length;

  return (
    <div className="space-y-6">
      {!wasenderConfigured && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>WaSender konfiqurasiya olunmayıb</strong> (`WASENDER_API_KEY` yoxdur) —
            qeydlər saxlanılır, amma WhatsApp mesajı GETMİR.
          </span>
        </div>
      )}

      {/* ── Yeni qeyd ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-admin-line bg-admin-card p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <Plus className="h-4 w-4" /> Yeni güdmə qeydi
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">
              Telefon nömrəsi *
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+994 50 123 45 67"
              className="w-full rounded-lg border border-admin-line bg-admin-card px-3 py-2 text-sm text-zinc-900 outline-none focus:border-violet-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">
              Müştərinin adı
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mesajda adla müraciət üçün (istəyə bağlı)"
              className="w-full rounded-lg border border-admin-line bg-admin-card px-3 py-2 text-sm text-zinc-900 outline-none focus:border-violet-500"
            />
          </div>
        </div>

        {/* Oyun seçicisi */}
        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-zinc-600">Oyun *</label>
          {selectedGame ? (
            <div className="flex items-center gap-3 rounded-lg border border-admin-line bg-admin-chip px-3 py-2">
              {selectedGame.imageUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={selectedGame.imageUrl}
                  alt=""
                  className="h-10 w-10 rounded object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-zinc-900">
                  {selectedGame.title}
                </div>
                <div className="text-xs text-zinc-500">
                  {selectedGame.priceAzn.toFixed(2)} ₼
                  {selectedGame.discountPct
                    ? ` · hazırda -${selectedGame.discountPct}% endirimdə`
                    : ""}
                  {selectedGame.platform ? ` · ${selectedGame.platform}` : ""}
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedGame(null);
                  setGameQuery("");
                }}
                className="rounded p-1 text-zinc-400 hover:bg-admin-chip2 hover:text-zinc-700"
                title="Dəyiş"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                value={gameQuery}
                onChange={(e) => setGameQuery(e.target.value)}
                placeholder="Oyun adını yaz (ən azı 2 hərf)…"
                className="w-full rounded-lg border border-admin-line bg-admin-card py-2 pl-9 pr-9 text-sm text-zinc-900 outline-none focus:border-violet-500"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-400" />
              )}
              {gameOptions.length > 0 && (
                <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-admin-line bg-admin-card py-1 shadow-lg">
                  {gameOptions.map((g) => (
                    <li key={g.id}>
                      <button
                        onClick={() => {
                          setSelectedGame(g);
                          setGameOptions([]);
                        }}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-admin-chip"
                      >
                        {g.imageUrl && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={g.imageUrl}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded object-cover"
                          />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-zinc-900">
                            {g.title}
                          </span>
                          <span className="block text-xs text-zinc-500">
                            {g.priceAzn.toFixed(2)} ₼
                            {g.discountPct ? ` · -${g.discountPct}%` : ""}
                            {g.platform ? ` · ${g.platform}` : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-zinc-600">
            Admin qeydi
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder='Məs: "Instagram-dan yazdı, 40 ₼-ə razıdır" — müştəriyə göndərilmir'
            className="w-full rounded-lg border border-admin-line bg-admin-card px-3 py-2 text-sm text-zinc-900 outline-none focus:border-violet-500"
          />
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        )}
        {notice && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {notice}
          </p>
        )}

        <button
          onClick={submit}
          disabled={saving || !phone.trim() || !selectedGame}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Qeyd et
        </button>
      </div>

      {/* ── Siyahı ────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-admin-line bg-admin-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-admin-line px-5 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">
              Güdmə qeydləri{" "}
              <span className="font-normal text-zinc-500">({items.length})</span>
            </h2>
            {onSaleCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-sky-200">
                <BellRing className="h-3 w-3" />
                {onSaleCount} oyun hazırda endirimdədir
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  filter === f.key
                    ? "bg-violet-600 text-white"
                    : "bg-admin-chip text-zinc-600 hover:bg-admin-chip2"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Yüklənir…
          </div>
        ) : visible.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-zinc-500">
            {items.length === 0
              ? "Hələ güdmə qeydi yoxdur. Yuxarıdaki formadan əlavə et."
              : "Bu süzgəcə uyğun qeyd yoxdur."}
          </p>
        ) : (
          <ul className="divide-y divide-admin-line">
            {visible.map((r) => {
              const status = priceWatchStatus(r);
              const base = r.basePriceAznCents != null ? r.basePriceAznCents / 100 : null;
              const dropped =
                base != null && r.currentPriceAzn != null && r.currentPriceAzn < base;
              const busy = busyId === r.id;

              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  {r.game.imageUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={r.game.imageUrl}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded object-cover"
                    />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium text-zinc-900">
                        {r.game.title}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${PRICE_WATCH_STATUS_CLASS[status]}`}
                      >
                        {PRICE_WATCH_STATUS_LABEL[status]}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-500">
                      {formatPhoneForDisplay(r.phone)}
                      {r.name ? ` · ${r.name}` : ""}
                      {r.notifyCount > 0 ? ` · ${r.notifyCount} dəfə xəbər verilib` : ""}
                    </div>
                    {r.note && (
                      <div className="mt-0.5 truncate text-xs italic text-zinc-400">
                        {r.note}
                      </div>
                    )}
                  </div>

                  {/* Qiymət: qeyd anındaki → hazırkı */}
                  <div className="shrink-0 text-right text-sm">
                    {base != null && dropped && (
                      <span className="mr-1 text-xs text-zinc-400 line-through">
                        {base.toFixed(2)} ₼
                      </span>
                    )}
                    <span
                      className={
                        dropped ? "font-semibold text-emerald-600" : "text-zinc-700"
                      }
                    >
                      {r.currentPriceAzn != null ? `${r.currentPriceAzn.toFixed(2)} ₼` : "—"}
                    </span>
                    {r.currentDiscountPct ? (
                      <div className="text-[11px] font-medium text-rose-600">
                        -{r.currentDiscountPct}%
                      </div>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {/* "İndi göndər" yalnız endirim aktiv olanda görünür — endirimsiz
                        oyun üçün mesaj göndərmək müştəriyə yanlış xəbər olar. */}
                    {r.isOnSale && r.isActive && !r.isGameInactive && (
                      <button
                        onClick={() => sendNow(r.id)}
                        disabled={busy}
                        title="WhatsApp mesajını indi göndər"
                        className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-40"
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        İndi göndər
                      </button>
                    )}
                    <button
                      onClick={() => patch(r.id, { isActive: !r.isActive })}
                      disabled={busy}
                      title={r.isActive ? "Dayandır" : "Aktivləşdir"}
                      className="rounded-lg p-1.5 text-zinc-400 hover:bg-admin-chip hover:text-zinc-700 disabled:opacity-40"
                    >
                      {r.isActive ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => remove(r.id, r.game.title)}
                      disabled={busy}
                      title="Sil"
                      className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
