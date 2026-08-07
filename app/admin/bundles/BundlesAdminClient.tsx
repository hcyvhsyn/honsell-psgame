"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  Plus,
  Edit2,
  Trash2,
  X,
  GripVertical,
  Star,
  ChevronDown,
  ChevronUp,
  Search,
  AlertTriangle,
} from "lucide-react";
import { useDialog } from "@/lib/dialogs";
import {
  BUNDLE_PRICING_MODES,
  BUNDLE_PRICING_MODE_LABELS,
  formatAznCents,
  type BundlePricingMode,
} from "@/lib/gameBundleShared";

type BundleItem = {
  gameId: string;
  title: string;
  imageUrl: string | null;
  isActive: boolean;
  priceAznCents: number | null;
  listAznCents: number;
  bundleAznCents: number;
};

type Bundle = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  imageUrl: string | null;
  badgeText: string | null;
  pricingMode: string;
  discountPct: number;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
  pricing: {
    listTotalAznCents: number;
    totalAznCents: number;
    savingsAznCents: number;
    discountPct: number;
  };
  costTotalAznCents: number;
  inactiveGameTitles: string[];
  sellable: boolean;
  items: BundleItem[];
};

type EditForm = {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  badgeText: string;
  pricingMode: BundlePricingMode;
  discountPct: string;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: string;
  startsAt: string;
  endsAt: string;
};

const EMPTY_FORM: EditForm = {
  slug: "",
  title: "",
  subtitle: "",
  description: "",
  imageUrl: "",
  badgeText: "",
  pricingMode: "PERCENT",
  discountPct: "20",
  isActive: true,
  isFeatured: false,
  sortOrder: "0",
  startsAt: "",
  endsAt: "",
};

type GameOption = { id: string; title: string; imageUrl: string | null };

/** ISO → `<input type="datetime-local">` dəyəri (lokal vaxt). */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function BundlesAdminClient() {
  const dialog = useDialog();
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | "NEW" | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [gameQuery, setGameQuery] = useState("");
  const [gameOptions, setGameOptions] = useState<GameOption[]>([]);
  const [searchingGames, setSearchingGames] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [gameDragId, setGameDragId] = useState<string | null>(null);
  /** CUSTOM rejimdə düzəliş edilən qiymət sahələri (`bundleId:gameId` → mətn). */
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/bundles");
    if (res.ok) setBundles(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setSaveError(null);
    setEditingId("NEW");
    setEditForm({ ...EMPTY_FORM, sortOrder: String(bundles.length) });
  }

  function openEdit(b: Bundle) {
    setSaveError(null);
    setEditingId(b.id);
    setEditForm({
      slug: b.slug,
      title: b.title,
      subtitle: b.subtitle ?? "",
      description: b.description ?? "",
      imageUrl: b.imageUrl ?? "",
      badgeText: b.badgeText ?? "",
      pricingMode: b.pricingMode === "CUSTOM" ? "CUSTOM" : "PERCENT",
      discountPct: String(b.discountPct),
      isActive: b.isActive,
      isFeatured: b.isFeatured,
      sortOrder: String(b.sortOrder),
      startsAt: toLocalInput(b.startsAt),
      endsAt: toLocalInput(b.endsAt),
    });
  }

  async function post(payload: Record<string, unknown>) {
    return fetch("/api/admin/bundles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  async function saveBundle() {
    if (!editForm.title.trim()) {
      setSaveError("Başlıq tələb olunur!");
      return;
    }
    setSaving(true);
    setSaveError(null);
    const res = await post({
      action: "UPSERT",
      id: editingId === "NEW" ? undefined : editingId,
      slug: editForm.slug,
      title: editForm.title,
      subtitle: editForm.subtitle,
      description: editForm.description,
      imageUrl: editForm.imageUrl,
      badgeText: editForm.badgeText,
      pricingMode: editForm.pricingMode,
      discountPct: Number(editForm.discountPct || 0),
      isActive: editForm.isActive,
      isFeatured: editForm.isFeatured,
      sortOrder: Number(editForm.sortOrder || 0),
      startsAt: editForm.startsAt ? new Date(editForm.startsAt).toISOString() : null,
      endsAt: editForm.endsAt ? new Date(editForm.endsAt).toISOString() : null,
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setSaveError(d.error ?? "Yadda saxlanmadı");
      setSaving(false);
      return;
    }
    setSaving(false);
    setEditingId(null);
    load();
  }

  async function deleteBundle(id: string) {
    if (
      !(await dialog.confirm({
        title: "Paketi sil?",
        message: "İçindəki oyun bağlantıları da silinəcək. Oyunların özü silinmir.",
        confirmLabel: "Sil",
        tone: "danger",
      }))
    )
      return;
    await post({ action: "DELETE", id });
    load();
  }

  async function persistOrder(ordered: Bundle[]) {
    await post({ action: "REORDER", ids: ordered.map((b) => b.id) });
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      return;
    }
    setBundles((prev) => {
      const fromIdx = prev.findIndex((b) => b.id === dragId);
      const toIdx = prev.findIndex((b) => b.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      const reindexed = next.map((b, i) => ({ ...b, sortOrder: i }));
      persistOrder(reindexed);
      return reindexed;
    });
    setDragId(null);
  }

  // Açıq paneldəki oyun axtarışı — mövcud kataloq endpoint-i.
  useEffect(() => {
    if (!expandedId) return;
    const q = gameQuery.trim();
    if (q.length < 2) {
      setGameOptions([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearchingGames(true);
      try {
        const res = await fetch(`/api/games?q=${encodeURIComponent(q)}&type=GAME&limit=10`);
        if (res.ok) {
          const data = await res.json();
          setGameOptions(
            (data.results ?? []).map((g: { id: string; title: string; imageUrl: string | null }) => ({
              id: g.id,
              title: g.title,
              imageUrl: g.imageUrl,
            }))
          );
        }
      } finally {
        setSearchingGames(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [gameQuery, expandedId]);

  async function addGame(bundleId: string, gameId: string) {
    await post({ action: "ADD_GAME", bundleId, gameId });
    setGameQuery("");
    setGameOptions([]);
    load();
  }

  async function removeGame(bundleId: string, gameId: string) {
    await post({ action: "REMOVE_GAME", bundleId, gameId });
    load();
  }

  async function persistGameOrder(bundleId: string, gameIds: string[]) {
    await post({ action: "REORDER_GAMES", bundleId, gameIds });
  }

  function onGameDrop(bundleId: string, targetGameId: string) {
    if (!gameDragId || gameDragId === targetGameId) {
      setGameDragId(null);
      return;
    }
    setBundles((prev) =>
      prev.map((b) => {
        if (b.id !== bundleId) return b;
        const fromIdx = b.items.findIndex((g) => g.gameId === gameDragId);
        const toIdx = b.items.findIndex((g) => g.gameId === targetGameId);
        if (fromIdx === -1 || toIdx === -1) return b;
        const next = [...b.items];
        const [moved] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, moved);
        persistGameOrder(bundleId, next.map((g) => g.gameId));
        return { ...b, items: next };
      })
    );
    setGameDragId(null);
  }

  async function saveItemPrice(bundleId: string, gameId: string, raw: string) {
    const trimmed = raw.trim();
    const priceAznCents = trimmed === "" ? null : Math.round(Number(trimmed.replace(",", ".")) * 100);
    if (priceAznCents != null && !Number.isFinite(priceAznCents)) return;
    await post({ action: "SET_ITEM_PRICE", bundleId, gameId, priceAznCents });
    setPriceDrafts((d) => {
      const next = { ...d };
      delete next[`${bundleId}:${gameId}`];
      return next;
    });
    load();
  }

  if (loading)
    return (
      <div className="py-20 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-500" />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
        >
          <Plus className="h-4 w-4" /> Yeni paket
        </button>
      </div>

      {bundles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-admin-line bg-admin-card py-16 text-center text-zinc-500">
          Hələ heç bir paket yoxdur.
        </div>
      ) : (
        <div className="space-y-3">
          {bundles.map((b) => {
            const profitCents = b.pricing.totalAznCents - b.costTotalAznCents;
            const atLoss = profitCents < 0;
            return (
              <div
                key={b.id}
                className={`rounded-xl border bg-admin-card transition ${dragId === b.id ? "opacity-40" : ""} border-admin-line`}
              >
                <div
                  draggable
                  onDragStart={() => setDragId(b.id)}
                  onDragOver={onDragOver}
                  onDrop={() => onDrop(b.id)}
                  onDragEnd={() => setDragId(null)}
                  className="flex items-center gap-4 p-4"
                >
                  <GripVertical className="h-5 w-5 shrink-0 cursor-grab text-zinc-500 active:cursor-grabbing" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate font-medium text-zinc-800">
                      {b.title}
                      {b.isFeatured && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-600" />}
                    </p>
                    <p className="truncate text-xs text-zinc-500">
                      /paket/{b.slug} · {b.items.length} oyun ·{" "}
                      {BUNDLE_PRICING_MODE_LABELS[b.pricingMode === "CUSTOM" ? "CUSTOM" : "PERCENT"]}
                      {b.pricingMode === "PERCENT" ? ` (${b.discountPct}%)` : ""}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${b.isActive ? "bg-emerald-500/20 text-emerald-600" : "bg-admin-chip text-zinc-500"}`}
                      >
                        {b.isActive ? "Aktiv" : "Passiv"}
                      </span>
                      {b.items.length > 0 && (
                        <span className="text-[11px] text-zinc-600">
                          <span className="line-through">{formatAznCents(b.pricing.listTotalAznCents)}</span>{" "}
                          <span className="font-semibold text-zinc-800">
                            {formatAznCents(b.pricing.totalAznCents)}
                          </span>{" "}
                          <span className="text-emerald-600">
                            −{formatAznCents(b.pricing.savingsAznCents)} ({b.pricing.discountPct}%)
                          </span>
                        </span>
                      )}
                      <span className="text-[11px] text-zinc-600">Sıra: {b.sortOrder}</span>
                    </div>
                    {!b.sellable && (
                      <p className="mt-1.5 inline-flex items-center gap-1.5 rounded bg-amber-500/15 px-2 py-1 text-[11px] font-medium text-amber-700">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {b.items.length === 0
                          ? "Oyun yoxdur — vitrində görünmür"
                          : b.inactiveGameTitles.length > 0
                            ? `Deaktiv oyun: ${b.inactiveGameTitles.join(", ")} — paket vitrində görünmür`
                            : "Vaxt pəncərəsindən kənar və ya passiv — vitrində görünmür"}
                      </p>
                    )}
                    {b.items.length > 0 && atLoss && (
                      <p className="mt-1.5 inline-flex items-center gap-1.5 rounded bg-rose-500/15 px-2 py-1 text-[11px] font-medium text-rose-700">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Zərərlə satılır: maya {formatAznCents(b.costTotalAznCents)}, paket{" "}
                        {formatAznCents(b.pricing.totalAznCents)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setExpandedId(expandedId === b.id ? null : b.id)}
                      className="rounded p-2 text-zinc-500 hover:text-violet-600"
                      aria-label="Oyunları idarə et"
                    >
                      {expandedId === b.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <button onClick={() => openEdit(b)} className="rounded p-2 text-zinc-500 hover:text-violet-600">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => deleteBundle(b.id)} className="rounded p-2 text-zinc-500 hover:text-rose-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {expandedId === b.id && (
                  <div className="border-t border-admin-line p-4">
                    <div className="mb-4">
                      <label className="block text-sm text-zinc-700">
                        <Search className="mr-1.5 inline h-4 w-4" />
                        Oyun əlavə et
                        <input
                          value={gameQuery}
                          onChange={(e) => setGameQuery(e.target.value)}
                          placeholder="Oyun adı yaz (min 2 hərf)..."
                          className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-violet-500 focus:outline-none"
                        />
                      </label>
                      {(searchingGames || gameOptions.length > 0) && (
                        <div className="mt-2 max-h-48 overflow-y-auto rounded border border-admin-line bg-admin-card">
                          {searchingGames && <div className="px-3 py-2 text-xs text-zinc-500">Axtarılır...</div>}
                          {gameOptions
                            .filter((g) => !b.items.some((it) => it.gameId === g.id))
                            .map((g) => (
                              <button
                                key={g.id}
                                type="button"
                                onClick={() => addGame(b.id, g.id)}
                                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-zinc-800 hover:bg-admin-chip2"
                              >
                                {g.imageUrl && (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img src={g.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
                                )}
                                <span className="truncate">{g.title}</span>
                                <Plus className="ml-auto h-4 w-4 shrink-0 text-emerald-600" />
                              </button>
                            ))}
                        </div>
                      )}
                    </div>

                    {b.items.length === 0 ? (
                      <p className="py-4 text-center text-sm text-zinc-500">
                        Bu paketdə hələ oyun yoxdur. Yuxarıdan axtarıb əlavə edin.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        <p className="mb-2 text-xs text-zinc-500">
                          {b.items.length} oyun · soldakı tutacaqdan sürükləyərək sıralayın
                          {b.pricingMode === "CUSTOM" &&
                            " · qiymət sahəsi boş qalsa oyunun adi vitrin qiyməti götürülür"}
                        </p>
                        {b.items.map((it) => {
                          const draftKey = `${b.id}:${it.gameId}`;
                          const draft =
                            priceDrafts[draftKey] ??
                            (it.priceAznCents != null ? (it.priceAznCents / 100).toFixed(2) : "");
                          return (
                            <div
                              key={it.gameId}
                              draggable
                              onDragStart={() => setGameDragId(it.gameId)}
                              onDragOver={onDragOver}
                              onDrop={() => onGameDrop(b.id, it.gameId)}
                              onDragEnd={() => setGameDragId(null)}
                              className={`flex items-center gap-3 rounded border border-admin-line bg-admin-card p-2 ${gameDragId === it.gameId ? "opacity-40" : ""}`}
                            >
                              <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-zinc-600 active:cursor-grabbing" />
                              {it.imageUrl && (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={it.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm text-zinc-800">
                                  {it.title}
                                  {!it.isActive && (
                                    <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                      deaktiv
                                    </span>
                                  )}
                                </p>
                                <p className="truncate text-xs text-zinc-600">
                                  <span className="line-through">{formatAznCents(it.listAznCents)}</span> →{" "}
                                  <span className="font-semibold text-zinc-800">
                                    {formatAznCents(it.bundleAznCents)}
                                  </span>
                                </p>
                              </div>
                              {b.pricingMode === "CUSTOM" && (
                                <input
                                  value={draft}
                                  onChange={(e) =>
                                    setPriceDrafts((d) => ({ ...d, [draftKey]: e.target.value }))
                                  }
                                  onBlur={(e) => saveItemPrice(b.id, it.gameId, e.target.value)}
                                  placeholder="AZN"
                                  inputMode="decimal"
                                  className="w-20 shrink-0 rounded border border-admin-line bg-admin-card px-2 py-1 text-right text-sm text-zinc-900 focus:border-violet-500 focus:outline-none"
                                />
                              )}
                              <button
                                onClick={() => removeGame(b.id, it.gameId)}
                                className="rounded p-1.5 text-zinc-500 hover:text-rose-600"
                                aria-label="Çıxar"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          );
                        })}

                        <div className="mt-3 rounded-lg border border-admin-line bg-admin-chip p-3 text-xs text-zinc-700">
                          <div className="flex justify-between">
                            <span>Oyunların cəmi (vitrin)</span>
                            <span>{formatAznCents(b.pricing.listTotalAznCents)}</span>
                          </div>
                          <div className="flex justify-between font-semibold text-zinc-900">
                            <span>Paket qiyməti</span>
                            <span>{formatAznCents(b.pricing.totalAznCents)}</span>
                          </div>
                          <div className="flex justify-between text-emerald-700">
                            <span>Müştərinin qənaəti</span>
                            <span>
                              {formatAznCents(b.pricing.savingsAznCents)} ({b.pricing.discountPct}%)
                            </span>
                          </div>
                          <div className="mt-2 flex justify-between border-t border-admin-line pt-2">
                            <span>Maya dəyəri</span>
                            <span>{formatAznCents(b.costTotalAznCents)}</span>
                          </div>
                          <div
                            className={`flex justify-between font-semibold ${atLoss ? "text-rose-700" : "text-zinc-900"}`}
                          >
                            <span>Mənfəət</span>
                            <span>
                              {profitCents < 0 ? "−" : ""}
                              {formatAznCents(Math.abs(profitCents))}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
          <div className="my-8 w-full max-w-lg rounded-2xl border border-admin-line bg-admin-card p-6 shadow-2xl">
            <h3 className="mb-6 text-lg font-bold">
              {editingId === "NEW" ? "Yeni paket" : "Paketi redaktə et"}
            </h3>

            <div className="space-y-4">
              <label className="block text-sm text-zinc-700">
                Başlıq <span className="text-rose-600">*</span>
                <input
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-violet-500 focus:outline-none"
                  placeholder="Məs: Assassin's Creed səbəti"
                />
              </label>

              <label className="block text-sm text-zinc-700">
                Alt başlıq (ixtiyari)
                <input
                  value={editForm.subtitle}
                  onChange={(e) => setEditForm({ ...editForm, subtitle: e.target.value })}
                  className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-violet-500 focus:outline-none"
                  placeholder="4 oyun bir paketdə"
                />
              </label>

              <label className="block text-sm text-zinc-700">
                Etiket (ixtiyari) — kartın üstündəki rəngli yazı
                <input
                  value={editForm.badgeText}
                  onChange={(e) => setEditForm({ ...editForm, badgeText: e.target.value })}
                  className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-violet-500 focus:outline-none"
                  placeholder="ULTRA PAKET"
                />
              </label>

              <label className="block text-sm text-zinc-700">
                Slug (URL) — boş buraxsanız başlıqdan avtomatik yaranır
                <input
                  value={editForm.slug}
                  onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                  className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-violet-500 focus:outline-none"
                  placeholder="assassins-creed-sebeti"
                />
              </label>

              <div className="flex gap-4">
                <label className="block flex-1 text-sm text-zinc-700">
                  Qiymət rejimi
                  <select
                    value={editForm.pricingMode}
                    onChange={(e) =>
                      setEditForm({ ...editForm, pricingMode: e.target.value as BundlePricingMode })
                    }
                    className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-violet-500 focus:outline-none"
                  >
                    {BUNDLE_PRICING_MODES.map((m) => (
                      <option key={m} value={m}>
                        {BUNDLE_PRICING_MODE_LABELS[m]}
                      </option>
                    ))}
                  </select>
                </label>
                {editForm.pricingMode === "PERCENT" && (
                  <label className="block w-28 text-sm text-zinc-700">
                    Endirim %
                    <input
                      type="number"
                      min={0}
                      max={95}
                      value={editForm.discountPct}
                      onChange={(e) => setEditForm({ ...editForm, discountPct: e.target.value })}
                      className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-violet-500 focus:outline-none"
                    />
                  </label>
                )}
              </div>
              <p className="-mt-2 text-xs text-zinc-500">
                {editForm.pricingMode === "PERCENT"
                  ? "Paket qiyməti oyunların cari vitrin qiymətlərinin cəmindən avtomatik hesablanır — oyun qiyməti dəyişəndə paket də yenilənir."
                  : "Hər oyunun paket daxilindəki qiyməti aşağıdakı siyahıda ayrıca yazılır (10 AZN səbəti kimi sabit hədəflər üçün)."}
              </p>

              <label className="block text-sm text-zinc-700">
                Açıqlama (ixtiyari)
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-violet-500 focus:outline-none"
                  placeholder="Bu paket haqqında qısa məlumat..."
                />
              </label>

              <label className="block text-sm text-zinc-700">
                Cover Image URL (ixtiyari) — boşdursa oyun kaverlərindən kollaj qurulur
                <input
                  value={editForm.imageUrl}
                  onChange={(e) => setEditForm({ ...editForm, imageUrl: e.target.value })}
                  className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-violet-500 focus:outline-none"
                  placeholder="https://..."
                />
              </label>

              <div className="flex gap-4">
                <label className="block flex-1 text-sm text-zinc-700">
                  Başlama (ixtiyari)
                  <input
                    type="datetime-local"
                    value={editForm.startsAt}
                    onChange={(e) => setEditForm({ ...editForm, startsAt: e.target.value })}
                    className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-violet-500 focus:outline-none"
                  />
                </label>
                <label className="block flex-1 text-sm text-zinc-700">
                  Bitmə (ixtiyari)
                  <input
                    type="datetime-local"
                    value={editForm.endsAt}
                    onChange={(e) => setEditForm({ ...editForm, endsAt: e.target.value })}
                    className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-violet-500 focus:outline-none"
                  />
                </label>
              </div>

              <div className="flex gap-4">
                <label className="block flex-1 text-sm text-zinc-700">
                  Sıralama
                  <input
                    type="number"
                    value={editForm.sortOrder}
                    onChange={(e) => setEditForm({ ...editForm, sortOrder: e.target.value })}
                    className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-violet-500 focus:outline-none"
                  />
                </label>
                <label className="flex items-end gap-2 pb-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                  />{" "}
                  Aktiv
                </label>
                <label className="flex items-end gap-2 pb-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={editForm.isFeatured}
                    onChange={(e) => setEditForm({ ...editForm, isFeatured: e.target.checked })}
                  />{" "}
                  Featured
                </label>
              </div>
            </div>

            {saveError && (
              <div className="mt-4 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">
                {saveError}
              </div>
            )}

            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={() => {
                  setEditingId(null);
                  setSaveError(null);
                }}
                className="rounded bg-admin-chip px-4 py-2 text-sm text-zinc-700 hover:bg-admin-chip2"
              >
                İmtina
              </button>
              <button
                onClick={saveBundle}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Yadda saxla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
