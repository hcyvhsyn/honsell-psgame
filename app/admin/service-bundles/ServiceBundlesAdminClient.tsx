"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
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
  AlertTriangle,
  KeyRound,
} from "lucide-react";
import { useDialog } from "@/lib/dialogs";
import { formatAznCents } from "@/lib/serviceBundleShared";

type BundleItem = {
  serviceProductId: string;
  title: string;
  imageUrl: string | null;
  serviceType: string;
  isActive: boolean;
  priceAznCents: number | null;
  listAznCents: number;
  bundleAznCents: number;
  requirementKind: string;
};

type Bundle = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  imageUrl: string | null;
  badgeText: string | null;
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
  blockedServiceTitles: string[];
  sellable: boolean;
  items: BundleItem[];
};

type ServiceOption = {
  id: string;
  type: string;
  title: string;
  imageUrl: string | null;
  priceAznCents: number;
  requirementKind: string;
};

type EditForm = {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  badgeText: string;
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
  isActive: true,
  isFeatured: false,
  sortOrder: "0",
  startsAt: "",
  endsAt: "",
};

const TYPE_LABELS: Record<string, string> = {
  STREAMING: "Streaming",
  PLATFORM: "Platformalar (Musiqi / AI / İş)",
  PS_PLUS: "PS Plus",
  EA_PLAY: "EA Play",
  TRY_BALANCE: "Hədiyyə kartları",
  POINT_BLANK_TG: "Point Blank TG",
  PUBG_UC: "PUBG UC",
};

/** Müştəridən nə tələb olunduğunun qısa izahı — admin dəst quranda görsün. */
const REQUIREMENT_LABELS: Record<string, string> = {
  EMAIL: "e-poçt tələb edir",
  EMAIL_PASSWORD: "e-poçt + şifrə tələb edir",
  ACCOUNTS: "hesab siyahısı tələb edir",
};

/** ISO → `<input type="datetime-local">` dəyəri (lokal vaxt). */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ServiceBundlesAdminClient() {
  const dialog = useDialog();
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | "NEW" | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [itemDragId, setItemDragId] = useState<string | null>(null);
  /** Düzəliş edilən qiymət sahələri (`bundleId:serviceProductId` → mətn). */
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/service-bundles");
    if (res.ok) {
      const data = await res.json();
      setBundles(data.bundles ?? []);
      setServices(data.services ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Seçici tip üzrə qruplanır — xidmətlərin sayı azdır, axtarış lazım deyil.
  const servicesByType = useMemo(() => {
    const groups = new Map<string, ServiceOption[]>();
    for (const s of services) {
      const arr = groups.get(s.type) ?? [];
      arr.push(s);
      groups.set(s.type, arr);
    }
    return Array.from(groups.entries());
  }, [services]);

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
      isActive: b.isActive,
      isFeatured: b.isFeatured,
      sortOrder: String(b.sortOrder),
      startsAt: toLocalInput(b.startsAt),
      endsAt: toLocalInput(b.endsAt),
    });
  }

  async function post(payload: Record<string, unknown>) {
    return fetch("/api/admin/service-bundles", {
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
        title: "Dəsti sil?",
        message: "İçindəki xidmət bağlantıları da silinəcək. Xidmətlərin özü silinmir.",
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

  async function addService(bundleId: string, serviceProductId: string) {
    setAddError(null);
    const res = await post({ action: "ADD_SERVICE", bundleId, serviceProductId });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setAddError(d.error ?? "Əlavə olunmadı");
      return;
    }
    load();
  }

  async function removeService(bundleId: string, serviceProductId: string) {
    await post({ action: "REMOVE_SERVICE", bundleId, serviceProductId });
    load();
  }

  async function persistItemOrder(bundleId: string, serviceProductIds: string[]) {
    await post({ action: "REORDER_SERVICES", bundleId, serviceProductIds });
  }

  function onItemDrop(bundleId: string, targetId: string) {
    if (!itemDragId || itemDragId === targetId) {
      setItemDragId(null);
      return;
    }
    setBundles((prev) =>
      prev.map((b) => {
        if (b.id !== bundleId) return b;
        const fromIdx = b.items.findIndex((s) => s.serviceProductId === itemDragId);
        const toIdx = b.items.findIndex((s) => s.serviceProductId === targetId);
        if (fromIdx === -1 || toIdx === -1) return b;
        const next = [...b.items];
        const [moved] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, moved);
        persistItemOrder(
          bundleId,
          next.map((s) => s.serviceProductId),
        );
        return { ...b, items: next };
      }),
    );
    setItemDragId(null);
  }

  async function saveItemPrice(bundleId: string, serviceProductId: string, raw: string) {
    const trimmed = raw.trim();
    const priceAznCents =
      trimmed === "" ? null : Math.round(Number(trimmed.replace(",", ".")) * 100);
    if (priceAznCents != null && !Number.isFinite(priceAznCents)) return;
    await post({ action: "SET_ITEM_PRICE", bundleId, serviceProductId, priceAznCents });
    setPriceDrafts((d) => {
      const next = { ...d };
      delete next[`${bundleId}:${serviceProductId}`];
      return next;
    });
    load();
  }

  if (loading)
    return (
      <div className="py-20 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          <Plus className="h-4 w-4" /> Yeni dəst
        </button>
      </div>

      {bundles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-admin-line bg-admin-card py-16 text-center text-zinc-500">
          Hələ heç bir xidmət dəsti yoxdur.
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
                      {b.isFeatured && (
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-600" />
                      )}
                    </p>
                    <p className="truncate text-xs text-zinc-500">
                      {b.slug} · {b.items.length} xidmət
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${b.isActive ? "bg-emerald-500/20 text-emerald-600" : "bg-admin-chip text-zinc-500"}`}
                      >
                        {b.isActive ? "Aktiv" : "Passiv"}
                      </span>
                      {b.items.length > 0 && (
                        <span className="text-[11px] text-zinc-600">
                          <span className="line-through">
                            {formatAznCents(b.pricing.listTotalAznCents)}
                          </span>{" "}
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
                          ? "Xidmət yoxdur — vitrində görünmür"
                          : b.blockedServiceTitles.length > 0
                            ? `Deaktiv xidmət: ${b.blockedServiceTitles.join(", ")} — dəst vitrində görünmür`
                            : "Vaxt pəncərəsindən kənar və ya passiv — vitrində görünmür"}
                      </p>
                    )}
                    {b.items.length > 0 && atLoss && (
                      <p className="mt-1.5 inline-flex items-center gap-1.5 rounded bg-rose-500/15 px-2 py-1 text-[11px] font-medium text-rose-700">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Zərərlə satılır: maya {formatAznCents(b.costTotalAznCents)}, dəst{" "}
                        {formatAznCents(b.pricing.totalAznCents)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setExpandedId(expandedId === b.id ? null : b.id);
                        setAddError(null);
                      }}
                      className="rounded p-2 text-zinc-500 hover:text-emerald-600"
                      aria-label="Xidmətləri idarə et"
                    >
                      {expandedId === b.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => openEdit(b)}
                      className="rounded p-2 text-zinc-500 hover:text-emerald-600"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteBundle(b.id)}
                      className="rounded p-2 text-zinc-500 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {expandedId === b.id && (
                  <div className="border-t border-admin-line p-4">
                    <label className="block text-sm text-zinc-700">
                      Xidmət əlavə et
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) addService(b.id, e.target.value);
                        }}
                        className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-emerald-500 focus:outline-none"
                      >
                        <option value="">— seç —</option>
                        {servicesByType.map(([type, list]) => (
                          <optgroup key={type} label={TYPE_LABELS[type] ?? type}>
                            {list
                              .filter(
                                (s) => !b.items.some((it) => it.serviceProductId === s.id),
                              )
                              .map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.title} — {formatAznCents(s.priceAznCents)}
                                  {REQUIREMENT_LABELS[s.requirementKind]
                                    ? ` (${REQUIREMENT_LABELS[s.requirementKind]})`
                                    : ""}
                                </option>
                              ))}
                          </optgroup>
                        ))}
                      </select>
                    </label>
                    {addError && (
                      <p className="mt-2 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-700">
                        {addError}
                      </p>
                    )}

                    {b.items.length === 0 ? (
                      <p className="py-4 text-center text-sm text-zinc-500">
                        Bu dəstdə hələ xidmət yoxdur. Yuxarıdan seçib əlavə edin.
                      </p>
                    ) : (
                      <div className="mt-4 space-y-1.5">
                        <p className="mb-2 text-xs text-zinc-500">
                          {b.items.length} xidmət · soldakı tutacaqdan sürükləyərək sıralayın ·
                          qiymət sahəsi boş qalsa xidmətin adi qiyməti götürülür
                        </p>
                        {b.items.map((it) => {
                          const draftKey = `${b.id}:${it.serviceProductId}`;
                          const draft =
                            priceDrafts[draftKey] ??
                            (it.priceAznCents != null
                              ? (it.priceAznCents / 100).toFixed(2)
                              : "");
                          return (
                            <div
                              key={it.serviceProductId}
                              draggable
                              onDragStart={() => setItemDragId(it.serviceProductId)}
                              onDragOver={onDragOver}
                              onDrop={() => onItemDrop(b.id, it.serviceProductId)}
                              onDragEnd={() => setItemDragId(null)}
                              className={`flex items-center gap-3 rounded border border-admin-line bg-admin-card p-2 ${itemDragId === it.serviceProductId ? "opacity-40" : ""}`}
                            >
                              <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-zinc-600 active:cursor-grabbing" />
                              {it.imageUrl && (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={it.imageUrl}
                                  alt=""
                                  className="h-10 w-10 shrink-0 rounded object-cover"
                                />
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
                                <p className="flex flex-wrap items-center gap-x-2 truncate text-xs text-zinc-600">
                                  <span className="line-through">
                                    {formatAznCents(it.listAznCents)}
                                  </span>{" "}
                                  →{" "}
                                  <span className="font-semibold text-zinc-800">
                                    {formatAznCents(it.bundleAznCents)}
                                  </span>
                                  {REQUIREMENT_LABELS[it.requirementKind] && (
                                    <span className="inline-flex items-center gap-1 rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
                                      <KeyRound className="h-3 w-3" />
                                      {REQUIREMENT_LABELS[it.requirementKind]}
                                    </span>
                                  )}
                                </p>
                              </div>
                              <input
                                value={draft}
                                onChange={(e) =>
                                  setPriceDrafts((d) => ({ ...d, [draftKey]: e.target.value }))
                                }
                                onBlur={(e) =>
                                  saveItemPrice(b.id, it.serviceProductId, e.target.value)
                                }
                                placeholder="AZN"
                                inputMode="decimal"
                                className="w-20 shrink-0 rounded border border-admin-line bg-admin-card px-2 py-1 text-right text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none"
                              />
                              <button
                                onClick={() => removeService(b.id, it.serviceProductId)}
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
                            <span>Xidmətlərin cəmi (vitrin)</span>
                            <span>{formatAznCents(b.pricing.listTotalAznCents)}</span>
                          </div>
                          <div className="flex justify-between font-semibold text-zinc-900">
                            <span>Dəst qiyməti</span>
                            <span>{formatAznCents(b.pricing.totalAznCents)}</span>
                          </div>
                          <div className="flex justify-between text-emerald-700">
                            <span>Müştərinin qənaəti</span>
                            <span>
                              {formatAznCents(b.pricing.savingsAznCents)} ({b.pricing.discountPct}
                              %)
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
              {editingId === "NEW" ? "Yeni xidmət dəsti" : "Dəsti redaktə et"}
            </h3>

            <div className="space-y-4">
              <label className="block text-sm text-zinc-700">
                Başlıq <span className="text-rose-600">*</span>
                <input
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-emerald-500 focus:outline-none"
                  placeholder="Məs: Netflix + HBO Max"
                />
              </label>

              <label className="block text-sm text-zinc-700">
                Alt başlıq (ixtiyari)
                <input
                  value={editForm.subtitle}
                  onChange={(e) => setEditForm({ ...editForm, subtitle: e.target.value })}
                  className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-emerald-500 focus:outline-none"
                  placeholder="2 xidmət bir dəstdə"
                />
              </label>

              <label className="block text-sm text-zinc-700">
                Etiket (ixtiyari) — kartın üstündəki rəngli yazı
                <input
                  value={editForm.badgeText}
                  onChange={(e) => setEditForm({ ...editForm, badgeText: e.target.value })}
                  className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-emerald-500 focus:outline-none"
                  placeholder="SƏRFƏLİ DƏST"
                />
              </label>

              <label className="block text-sm text-zinc-700">
                Slug — boş buraxsanız başlıqdan avtomatik yaranır
                <input
                  value={editForm.slug}
                  onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                  className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-emerald-500 focus:outline-none"
                  placeholder="netflix-hbo-max"
                />
              </label>

              <p className="rounded-lg border border-admin-line bg-admin-chip px-3 py-2 text-xs text-zinc-600">
                Qiymət hər xidmətə ayrıca yazılır (dəsti açıb aşağıdakı siyahıdan).
                Yazılan qiymət xidmətin adi qiymətindən yuxarı ola bilməz — server onu
                avtomatik kəsir.
              </p>

              <label className="block text-sm text-zinc-700">
                Açıqlama (ixtiyari)
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-emerald-500 focus:outline-none"
                  placeholder="Bu dəst haqqında qısa məlumat..."
                />
              </label>

              <label className="block text-sm text-zinc-700">
                Cover Image URL (ixtiyari) — boşdursa xidmət şəkillərindən kollaj qurulur
                <input
                  value={editForm.imageUrl}
                  onChange={(e) => setEditForm({ ...editForm, imageUrl: e.target.value })}
                  className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-emerald-500 focus:outline-none"
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
                    className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-emerald-500 focus:outline-none"
                  />
                </label>
                <label className="block flex-1 text-sm text-zinc-700">
                  Bitmə (ixtiyari)
                  <input
                    type="datetime-local"
                    value={editForm.endsAt}
                    onChange={(e) => setEditForm({ ...editForm, endsAt: e.target.value })}
                    className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-emerald-500 focus:outline-none"
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
                    className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-emerald-500 focus:outline-none"
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
                className="inline-flex items-center gap-2 rounded bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
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
