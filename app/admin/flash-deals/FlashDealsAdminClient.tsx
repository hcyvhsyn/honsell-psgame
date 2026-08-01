"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Edit2, Eye, EyeOff, GripVertical, Loader2, Plus, Trash2, X } from "lucide-react";
import { useDialog } from "@/lib/dialogs";

type FlashDeal = {
  id: string;
  gameId: string;
  gameTitle: string;
  gameImageUrl: string | null;
  gamePlatform: string | null;
  /** Oyunun kataloqdakı avtomatik qiyməti — override boş qalanda bu işləyir. */
  autoFinalAzn: number;
  autoOriginalAzn: number | null;
  priceAznCents: number | null;
  originalAznCents: number | null;
  endsAt: string | null;
  isActive: boolean;
  sortOrder: number;
};

type GameOption = {
  id: string;
  kind: "GAME" | "SERVICE";
  title: string;
  imageUrl: string | null;
  finalAzn?: number;
  originalAzn?: number | null;
  discountPct?: number | null;
};

type EditForm = {
  gameId: string;
  gameLabel: string;
  gameImageUrl: string | null;
  gameAutoFinalAzn: number | null;
  gameAutoOriginalAzn: number | null;
  priceAzn: string;
  originalAzn: string;
  endsAt: string;
  isActive: boolean;
  sortOrder: string;
};

const EMPTY_FORM: EditForm = {
  gameId: "",
  gameLabel: "",
  gameImageUrl: null,
  gameAutoFinalAzn: null,
  gameAutoOriginalAzn: null,
  priceAzn: "",
  originalAzn: "",
  endsAt: "",
  isActive: true,
  sortOrder: "0",
};

/** ISO → `datetime-local` input dəyəri (yerli vaxt zonasında). */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatEndsAt(iso: string | null): string {
  if (!iso) return "Vaxt limiti yoxdur";
  return new Date(iso).toLocaleString("az-AZ", { dateStyle: "short", timeStyle: "short" });
}

export default function FlashDealsAdminClient() {
  const dialog = useDialog();
  const [deals, setDeals] = useState<FlashDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | "NEW" | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [gameQuery, setGameQuery] = useState("");
  const [gameOptions, setGameOptions] = useState<GameOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/flash-deals");
    if (res.ok) setDeals(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Oyun axtarışı — banner picker-i ilə eyni endpoint, `kind=GAME` ilə yalnız
  // kataloq oyunlarını gətirir.
  useEffect(() => {
    const q = gameQuery.trim();
    if (q.length < 2) {
      setGameOptions([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/banners/product-search?kind=GAME&q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setGameOptions((data.results ?? []) as GameOption[]);
        }
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [gameQuery]);

  function openNew() {
    setSaveError(null);
    setEditingId("NEW");
    setEditForm({ ...EMPTY_FORM, sortOrder: String(deals.length) });
    setGameQuery("");
    setGameOptions([]);
  }

  function openEdit(d: FlashDeal) {
    setSaveError(null);
    setEditingId(d.id);
    setEditForm({
      gameId: d.gameId,
      gameLabel: d.gameTitle,
      gameImageUrl: d.gameImageUrl,
      gameAutoFinalAzn: d.autoFinalAzn,
      gameAutoOriginalAzn: d.autoOriginalAzn,
      priceAzn: d.priceAznCents != null ? (d.priceAznCents / 100).toFixed(2) : "",
      originalAzn: d.originalAznCents != null ? (d.originalAznCents / 100).toFixed(2) : "",
      endsAt: isoToLocalInput(d.endsAt),
      isActive: d.isActive,
      sortOrder: String(d.sortOrder),
    });
    setGameQuery("");
    setGameOptions([]);
  }

  async function save() {
    if (!editForm.gameId) {
      setSaveError("Oyun seçilməlidir");
      return;
    }
    setSaving(true);
    setSaveError(null);
    const res = await fetch("/api/admin/flash-deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "UPSERT",
        id: editingId === "NEW" ? undefined : editingId,
        gameId: editForm.gameId,
        priceAzn: editForm.priceAzn,
        originalAzn: editForm.originalAzn,
        // `datetime-local` yerli vaxtdır — ISO-ya çevirib göndəririk.
        endsAt: editForm.endsAt ? new Date(editForm.endsAt).toISOString() : null,
        isActive: editForm.isActive,
        sortOrder: editForm.sortOrder,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setSaveError(data.error ?? "Yadda saxlanmadı");
      return;
    }
    setEditingId(null);
    load();
  }

  async function toggleActive(d: FlashDeal) {
    await fetch("/api/admin/flash-deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "TOGGLE_ACTIVE", id: d.id, isActive: !d.isActive }),
    });
    load();
  }

  async function remove(d: FlashDeal) {
    const ok = await dialog.confirm({
      title: "Təklifi sil",
      message: `"${d.gameTitle}" bölmədən silinsin?`,
      tone: "danger",
    });
    if (!ok) return;
    await fetch("/api/admin/flash-deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DELETE", id: d.id }),
    });
    load();
  }

  async function persistOrder(ordered: FlashDeal[]) {
    await fetch("/api/admin/flash-deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "REORDER", ids: ordered.map((d) => d.id) }),
    });
  }

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setDragOverId(null);
      return;
    }
    setDeals((prev) => {
      const fromIdx = prev.findIndex((d) => d.id === dragId);
      const toIdx = prev.findIndex((d) => d.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      const reindexed = next.map((d, i) => ({ ...d, sortOrder: i }));
      persistOrder(reindexed);
      return reindexed;
    });
    setDragId(null);
    setDragOverId(null);
  }

  const effectivePrice = (d: FlashDeal) => (d.priceAznCents != null ? d.priceAznCents / 100 : d.autoFinalAzn);
  const effectiveOriginal = (d: FlashDeal) =>
    d.originalAznCents != null ? d.originalAznCents / 100 : d.autoOriginalAzn;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500"
        >
          <Plus className="h-4 w-4" /> Oyun əlavə et
        </button>
      </div>

      {editingId && (
        <div className="rounded-xl border border-admin-line bg-admin-card p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-900">
              {editingId === "NEW" ? "Yeni təklif" : "Təklifi redaktə et"}
            </h2>
            <button type="button" onClick={() => setEditingId(null)} className="text-zinc-500 hover:text-zinc-900">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Oyun seçimi */}
            <div>
              <p className="mb-1 text-sm text-zinc-700">Oyun</p>
              {editForm.gameId ? (
                <div className="flex items-center gap-3 rounded border border-admin-line bg-admin-chip p-2">
                  {editForm.gameImageUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={editForm.gameImageUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900">{editForm.gameLabel}</p>
                    {editForm.gameAutoFinalAzn != null && (
                      <p className="mt-0.5 text-xs text-zinc-600">
                        Kataloq qiyməti:{" "}
                        <span className="font-semibold text-emerald-600">
                          {editForm.gameAutoFinalAzn.toFixed(2)}₼
                        </span>
                        {editForm.gameAutoOriginalAzn != null && (
                          <span className="ml-2 line-through">{editForm.gameAutoOriginalAzn.toFixed(2)}₼</span>
                        )}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditForm((p) => ({ ...p, gameId: "", gameLabel: "", gameImageUrl: null, gameAutoFinalAzn: null, gameAutoOriginalAzn: null }))}
                    className="text-zinc-500 hover:text-rose-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <input
                    value={gameQuery}
                    onChange={(e) => setGameQuery(e.target.value)}
                    placeholder="Oyun adı yaz (min 2 hərf): NBA 2K26, Mafia..."
                    className="w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-violet-500 focus:outline-none"
                  />
                  {(searching || gameOptions.length > 0) && (
                    <div className="mt-2 max-h-56 overflow-y-auto rounded border border-admin-line bg-admin-card">
                      {searching && <div className="px-3 py-2 text-xs text-zinc-500">Axtarılır...</div>}
                      {gameOptions.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => {
                            setEditForm((p) => ({
                              ...p,
                              gameId: g.id,
                              gameLabel: g.title,
                              gameImageUrl: g.imageUrl,
                              gameAutoFinalAzn: g.finalAzn ?? null,
                              gameAutoOriginalAzn: g.originalAzn ?? null,
                            }));
                            setGameQuery("");
                            setGameOptions([]);
                          }}
                          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-zinc-800 hover:bg-admin-chip2"
                        >
                          {g.imageUrl && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={g.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                          )}
                          <div className="min-w-0 flex-1">
                            <span className="block truncate">{g.title}</span>
                            {g.finalAzn != null && (
                              <span className="block text-[11px] text-zinc-500">
                                {g.finalAzn.toFixed(2)}₼
                                {g.discountPct != null && <span className="ml-1 text-cyan-600">-%{g.discountPct}</span>}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-zinc-700">
                  Kampaniya qiyməti (₼)
                  <span className="ml-1 text-xs text-zinc-500">boş = kataloq qiyməti</span>
                </label>
                <input
                  value={editForm.priceAzn}
                  onChange={(e) => setEditForm((p) => ({ ...p, priceAzn: e.target.value }))}
                  inputMode="decimal"
                  placeholder={editForm.gameAutoFinalAzn != null ? editForm.gameAutoFinalAzn.toFixed(2) : "12.99"}
                  className="w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-violet-500 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-zinc-500">
                  Bu qiymət həm vitrində, həm də səbətdə/ödənişdə tətbiq olunur.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm text-zinc-700">
                  Köhnə qiymət (₼)
                  <span className="ml-1 text-xs text-zinc-500">üstündən xətt — boş = avtomatik</span>
                </label>
                <input
                  value={editForm.originalAzn}
                  onChange={(e) => setEditForm((p) => ({ ...p, originalAzn: e.target.value }))}
                  inputMode="decimal"
                  placeholder={editForm.gameAutoOriginalAzn != null ? editForm.gameAutoOriginalAzn.toFixed(2) : "49.90"}
                  className="w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-violet-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-zinc-700">
                  Bitmə tarixi
                  <span className="ml-1 text-xs text-zinc-500">boş = geri sayım yoxdur</span>
                </label>
                <input
                  type="datetime-local"
                  value={editForm.endsAt}
                  onChange={(e) => setEditForm((p) => ({ ...p, endsAt: e.target.value }))}
                  className="w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-violet-500 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-zinc-500">
                  Vaxt bitəndə kart bölmədən avtomatik çıxır və qiymət override-ı ləğv olunur.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm text-zinc-700">Sıra</label>
                <input
                  value={editForm.sortOrder}
                  onChange={(e) => setEditForm((p) => ({ ...p, sortOrder: e.target.value }))}
                  inputMode="numeric"
                  className="w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-violet-500 focus:outline-none"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={editForm.isActive}
                onChange={(e) => setEditForm((p) => ({ ...p, isActive: e.target.checked }))}
                className="h-4 w-4 accent-violet-600"
              />
              Aktiv
            </label>

            {saveError && <p className="text-sm text-rose-600">{saveError}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Yadda saxla
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="rounded-lg border border-admin-line px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-admin-chip"
              >
                Ləğv et
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : deals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-admin-line p-10 text-center text-sm text-zinc-500">
          Hələ təklif yoxdur. Bölmə ana səhifədə göstərilmir.
        </div>
      ) : (
        <ul className="space-y-2">
          {deals.map((d) => {
            const expired = d.endsAt != null && new Date(d.endsAt).getTime() <= Date.now();
            return (
              <li
                key={d.id}
                draggable
                onDragStart={() => setDragId(d.id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (d.id !== dragOverId) setDragOverId(d.id);
                }}
                onDrop={() => onDrop(d.id)}
                className={`flex items-center gap-3 rounded-xl border bg-admin-card p-3 transition ${
                  dragOverId === d.id ? "border-violet-500" : "border-admin-line"
                } ${d.isActive && !expired ? "" : "opacity-60"}`}
              >
                <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-zinc-400" />
                {d.gameImageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={d.gameImageUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="h-14 w-14 shrink-0 rounded-lg bg-admin-chip" />
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-900">{d.gameTitle}</p>
                  <p className="mt-0.5 text-xs text-zinc-600">
                    {effectiveOriginal(d) != null && (
                      <span className="line-through">{effectiveOriginal(d)!.toFixed(2)}₼</span>
                    )}{" "}
                    <span className="font-semibold text-emerald-600">{effectivePrice(d).toFixed(2)}₼</span>
                    {d.priceAznCents != null && (
                      <span className="ml-2 rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">
                        əl ilə qiymət
                      </span>
                    )}
                  </p>
                  <p className={`mt-0.5 text-[11px] ${expired ? "text-rose-600" : "text-zinc-500"}`}>
                    {expired ? "Vaxtı bitib" : formatEndsAt(d.endsAt)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => toggleActive(d)}
                  title={d.isActive ? "Gizlət" : "Göstər"}
                  className="rounded-lg p-2 text-zinc-500 hover:bg-admin-chip hover:text-zinc-900"
                >
                  {d.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(d)}
                  className="rounded-lg p-2 text-zinc-500 hover:bg-admin-chip hover:text-zinc-900"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(d)}
                  className="rounded-lg p-2 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
