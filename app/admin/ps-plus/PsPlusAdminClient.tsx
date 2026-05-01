"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Loader2, Plus, Edit2, Trash2, Check, X as XIcon, RefreshCw, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type ServiceProduct = {
  id: string;
  title: string;
  imageUrl?: string | null;
  priceAznCents: number;
  isActive: boolean;
  sortOrder: number;
  metadata: { tier?: string; durationMonths?: number; originalPriceAznCents?: number | null } | null;
};

type PendingOrder = {
  id: string;
  amountAznCents: number;
  createdAt: string;
  metadata: string | null;
  user: { id: string; email: string; name: string | null };
  serviceProduct: { id: string; title: string; metadata: unknown } | null;
  psnAccount: { id: string; label: string; psnEmail: string } | null;
};

const TIERS = ["ESSENTIAL", "EXTRA", "DELUXE"] as const;
const DURATIONS = [1, 3, 12] as const;

type Tier = (typeof TIERS)[number];
type Duration = (typeof DURATIONS)[number];

const TIER_COLORS: Record<Tier, string> = {
  ESSENTIAL: "border-blue-500/40 bg-blue-500/10 text-blue-300",
  EXTRA: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  DELUXE: "border-amber-500/40 bg-amber-500/10 text-amber-300",
};

const TIER_LABELS: Record<Tier, string> = {
  ESSENTIAL: "Essential",
  EXTRA: "Extra",
  DELUXE: "Deluxe",
};

export default function PsPlusAdminClient() {
  const [products, setProducts] = useState<ServiceProduct[]>([]);
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);

  const [editModal, setEditModal] = useState<{
    id?: string;
    tier: Tier;
    durationMonths: Duration;
    priceAzn: string;
    originalPriceAzn: string;
    imageUrl: string;
    isActive: boolean;
    sortOrder: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const router = useRouter();

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/ps-plus");
    if (res.ok) setProducts(await res.json());
    setLoading(false);
  }, []);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    const res = await fetch("/api/admin/ps-plus?mode=orders");
    if (res.ok) setOrders(await res.json());
    setOrdersLoading(false);
  }, []);

  useEffect(() => {
    loadProducts();
    loadOrders();
  }, [loadProducts, loadOrders]);

  function getProduct(tier: Tier, duration: Duration): ServiceProduct | undefined {
    return products.find(
      (p) =>
        (p.metadata as Record<string, unknown>)?.tier === tier &&
        (p.metadata as Record<string, unknown>)?.durationMonths === duration
    );
  }

  function openEdit(tier: Tier, duration: Duration) {
    setSaveError(null);
    const existing = getProduct(tier, duration);
    const finalPriceCents = existing?.priceAznCents ?? 0;
    const oldPriceCents = Number(
      (existing?.metadata as Record<string, unknown> | null)?.originalPriceAznCents ?? 0
    );
    const hasDiscount = oldPriceCents > finalPriceCents;
    setEditModal({
      id: existing?.id,
      tier,
      durationMonths: duration,
      // Satış qiyməti (normal / köhnə qiymət)
      priceAzn: existing
        ? ((hasDiscount ? oldPriceCents : finalPriceCents) / 100).toFixed(2)
        : "10.00",
      // Endirimli qiymət
      originalPriceAzn:
        existing && hasDiscount
          ? (finalPriceCents / 100).toFixed(2)
          : "",
      imageUrl: existing?.imageUrl ?? "",
      isActive: existing?.isActive ?? true,
      sortOrder: String(existing?.sortOrder ?? 0),
    });
  }

  async function handleImageUpload(file: File) {
    if (!editModal) return;
    if (!file.type.startsWith("image/")) {
      alert("Yalnız şəkil faylı yükləyə bilərsiniz");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Fayl çox böyükdür (max 5 MB)");
      return;
    }
    setUploadingImage(true);
    try {
      const init = await fetch("/api/admin/ps-plus/image-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type }),
      });
      const initData = await init.json();
      if (!init.ok) {
        alert(initData.error ?? "Upload hazırlanmadı");
        return;
      }
      const supabase = getSupabaseBrowser();
      const { error: upErr } = await supabase.storage
        .from(initData.bucket)
        .uploadToSignedUrl(initData.path, initData.token, file);
      if (upErr) {
        alert(`Upload alınmadı: ${upErr.message}`);
        return;
      }
      setEditModal((prev) => (prev ? { ...prev, imageUrl: initData.publicUrl } : prev));
    } finally {
      setUploadingImage(false);
    }
  }

  async function saveProduct() {
    if (!editModal) return;
    const salePrice = Number(editModal.priceAzn);
    if (!Number.isFinite(salePrice) || salePrice <= 0) {
      setSaveError("Satış qiyməti düzgün deyil!");
      return;
    }
    const discountedPrice = Number(editModal.originalPriceAzn);
    if (
      editModal.originalPriceAzn &&
      (!Number.isFinite(discountedPrice) || discountedPrice <= 0)
    ) {
      setSaveError("Endirimli qiymət düzgün deyil!");
      return;
    }
    if (editModal.originalPriceAzn && discountedPrice >= salePrice) {
      setSaveError("Endirimli qiymət satış qiymətindən kiçik olmalıdır!");
      return;
    }
    setSaving(true);
    setSaveError(null);
    const res = await fetch("/api/admin/ps-plus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "UPSERT_PRODUCT",
        id: editModal.id,
        tier: editModal.tier,
        durationMonths: editModal.durationMonths,
        priceAznCents: Math.round(salePrice * 100),
        discountedPriceAznCents: editModal.originalPriceAzn
          ? Math.round(discountedPrice * 100)
          : null,
        imageUrl: editModal.imageUrl.trim() || null,
        isActive: editModal.isActive,
        sortOrder: Number(editModal.sortOrder || 0),
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setSaveError(d.error ?? "Yadda saxlanmadı");
      setSaving(false);
      return;
    }
    setSaving(false);
    setEditModal(null);
    loadProducts();
  }

  async function deleteProduct(id: string, title: string) {
    if (!confirm(`"${title}" planını silmək istədiyinə əminsən?`)) return;
    await fetch("/api/admin/ps-plus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DELETE_PRODUCT", id }),
    });
    loadProducts();
  }

  async function processOrder(id: string, action: "SUCCESS" | "FAILED") {
    if (!confirm(action === "SUCCESS" ? "Sifarişi tamamla?" : "Sifarişi rədd et?")) return;
    await fetch(`/api/admin/service-orders/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    loadOrders();
    router.refresh();
  }

  return (
    <div className="space-y-10">
      {/* Plans Matrix */}
      <div>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-200">Plan qiymətləri</h2>
          <button
            onClick={loadProducts}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Yenilə
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-500" />
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/80 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-5 py-4 text-left font-medium">Müddət</th>
                  {TIERS.map((t) => (
                    <th key={t} className={`px-5 py-4 text-center font-medium`}>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] ring-1 ${TIER_COLORS[t]}`}>
                        {TIER_LABELS[t]}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {DURATIONS.map((dur) => (
                  <tr key={dur} className="hover:bg-zinc-900/40">
                    <td className="px-5 py-4 font-semibold text-zinc-300">{dur} ay</td>
                    {TIERS.map((tier) => {
                      const p = getProduct(tier, dur);
                      return (
                        <td key={tier} className="px-5 py-4 text-center">
                          {p ? (
                            <div className="inline-flex flex-col items-center gap-1">
                              <span className={`text-base font-bold ${p.isActive ? "text-white" : "text-zinc-600"}`}>
                                {(p.priceAznCents / 100).toFixed(2)} AZN
                              </span>
                              {!p.isActive && (
                                <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] text-rose-400">
                                  Passiv
                                </span>
                              )}
                              <div className="mt-1 flex items-center gap-1">
                                <button
                                  onClick={() => openEdit(tier, dur)}
                                  title="Redaktə et"
                                  className="rounded p-1 text-zinc-500 hover:text-indigo-400"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => deleteProduct(p.id, p.title)}
                                  title="Sil"
                                  className="rounded p-1 text-zinc-500 hover:text-rose-400"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => openEdit(tier, dur)}
                              className="inline-flex items-center gap-1 rounded-lg border border-dashed border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-500 transition hover:border-indigo-500/50 hover:text-indigo-400"
                            >
                              <Plus className="h-3 w-3" /> Əlavə et
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending Orders */}
      <div>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-200">
            Gözləyən sifarişlər
            {orders.length > 0 && (
              <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-sm font-semibold text-amber-300 ring-1 ring-amber-500/30">
                {orders.length}
              </span>
            )}
          </h2>
          <button
            onClick={loadOrders}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Yenilə
          </button>
        </div>

        {ordersLoading ? (
          <div className="py-10 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo-500" />
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 py-12 text-center text-zinc-500">
            Gözləyən PS Plus sifarişi yoxdur.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-900/80 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-5 py-4 font-medium">Müştəri</th>
                  <th className="px-5 py-4 font-medium">Plan</th>
                  <th className="px-5 py-4 font-medium">PSN Hesab</th>
                  <th className="px-5 py-4 font-medium">Məbləğ</th>
                  <th className="px-5 py-4 font-medium">Tarix</th>
                  <th className="px-5 py-4 font-medium">Əməliyyat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-zinc-900/40">
                    <td className="px-5 py-4">
                      <div className="font-medium text-zinc-200">{o.user.name || "—"}</div>
                      <div className="text-xs text-zinc-500">{o.user.email}</div>
                    </td>
                    <td className="px-5 py-4 text-zinc-300">{o.serviceProduct?.title ?? "—"}</td>
                    <td className="px-5 py-4">
                      {o.psnAccount ? (
                        <div>
                          <div className="font-medium text-zinc-200">{o.psnAccount.label}</div>
                          <div className="text-xs text-zinc-500">{o.psnAccount.psnEmail}</div>
                        </div>
                      ) : (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 font-semibold text-zinc-200">
                      {(Math.abs(o.amountAznCents) / 100).toFixed(2)} AZN
                    </td>
                    <td className="px-5 py-4 text-xs text-zinc-500">
                      {new Date(o.createdAt).toLocaleDateString("az-AZ", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => processOrder(o.id, "SUCCESS")}
                          title="Tamamla"
                          className="rounded bg-emerald-500/20 p-1.5 text-emerald-400 hover:bg-emerald-500/30"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => processOrder(o.id, "FAILED")}
                          title="Rədd et"
                          className="rounded bg-rose-500/20 p-1.5 text-rose-400 hover:bg-rose-500/30"
                        >
                          <XIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <h3 className="mb-6 text-lg font-bold">
              PS Plus{" "}
              <span className={`rounded px-1.5 py-0.5 text-sm ${TIER_COLORS[editModal.tier]}`}>
                {TIER_LABELS[editModal.tier]}
              </span>{" "}
              — {editModal.durationMonths} ay
            </h3>
            <div className="space-y-4">
              <label className="block text-sm text-zinc-300">
                Satış qiyməti (AZN)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                  value={editModal.priceAzn}
                  onChange={(e) => setEditModal({ ...editModal, priceAzn: e.target.value })}
                  placeholder="24.99"
                />
              </label>
              <label className="block text-sm text-zinc-300">
                Endirimli qiymət (AZN, ixtiyari)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                  value={editModal.originalPriceAzn}
                  onChange={(e) => setEditModal({ ...editModal, originalPriceAzn: e.target.value })}
                  placeholder="9.99"
                />
              </label>
              <div className="block text-sm text-zinc-300">
                <span>Məhsul şəkli (upload və ya URL)</span>
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                  Tövsiyə olunan ölçü: <span className="text-zinc-300 font-semibold">1200×900 px</span> (4:3).
                  Minimum: <span className="text-zinc-300 font-semibold">800×600 px</span>. Bu ölçülər `ps-plus` kartlarında ən yaxşı görünür.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImageUpload(f);
                    e.target.value = "";
                  }}
                />
                {editModal.imageUrl ? (
                  <div className="mt-2 flex items-center gap-3 rounded border border-zinc-800 bg-zinc-900 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={editModal.imageUrl} alt="" className="h-16 w-16 rounded object-cover" />
                    <div className="flex-1 truncate text-xs text-zinc-400">{editModal.imageUrl}</div>
                    <button
                      type="button"
                      onClick={() => setEditModal({ ...editModal, imageUrl: "" })}
                      className="rounded p-1 text-zinc-500 hover:text-rose-400"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={uploadingImage}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded border border-dashed border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-400 hover:border-indigo-500 hover:text-indigo-400 disabled:opacity-50"
                  >
                    {uploadingImage ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Yüklənir...</>
                    ) : (
                      <><Upload className="h-3.5 w-3.5" /> Şəkil yüklə</>
                    )}
                  </button>
                  <input
                    type="text"
                    className="flex-1 rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    value={editModal.imageUrl}
                    onChange={(e) => setEditModal({ ...editModal, imageUrl: e.target.value })}
                    placeholder="və ya birbaşa şəkil URL yazın..."
                  />
                </div>
              </div>
              <label className="block text-sm text-zinc-300">
                Sıralama
                <input
                  type="number"
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                  value={editModal.sortOrder}
                  onChange={(e) => setEditModal({ ...editModal, sortOrder: e.target.value })}
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={editModal.isActive}
                  onChange={(e) => setEditModal({ ...editModal, isActive: e.target.checked })}
                  className="rounded"
                />
                Aktivdir
              </label>
            </div>
            {saveError && (
              <div className="mt-4 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                {saveError}
              </div>
            )}
            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={() => {
                  setEditModal(null);
                  setSaveError(null);
                }}
                className="rounded bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
              >
                İmtina
              </button>
              <button
                onClick={saveProduct}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded bg-indigo-500 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-400 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Yadda saxla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
