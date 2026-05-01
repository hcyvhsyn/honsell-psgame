"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Loader2, Trash2, Check, X as XIcon, RefreshCw, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type ServiceProduct = {
  id: string;
  title: string;
  imageUrl?: string | null;
  priceAznCents: number;
  description?: string | null;
  isActive: boolean;
  sortOrder: number;
  metadata: { tier?: string; durationMonths?: number; tryPriceCents?: number } | null;
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
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pricing, setPricing] = useState<{ tryToAznRate: number; profitMarginPsPlusPct: number } | null>(null);

  const [tierAssets, setTierAssets] = useState<Record<Tier, { imageUrl: string; description: string }>>({
    ESSENTIAL: { imageUrl: "", description: "" },
    EXTRA: { imageUrl: "", description: "" },
    DELUXE: { imageUrl: "", description: "" },
  });

  const [tryInputs, setTryInputs] = useState<Record<string, string>>({});

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
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((s) => {
        setPricing({
          tryToAznRate: Number(s.tryToAznRate) || 0.053,
          profitMarginPsPlusPct: Number(s.profitMarginPsPlusPct ?? s.profitMarginPct) || 20,
        });
      })
      .catch(() => {});
  }, [loadProducts, loadOrders]);

  function getProduct(tier: Tier, duration: Duration): ServiceProduct | undefined {
    return products.find(
      (p) =>
        (p.metadata as Record<string, unknown>)?.tier === tier &&
        (p.metadata as Record<string, unknown>)?.durationMonths === duration
    );
  }

  async function handleImageUpload(file: File) {
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
      // The caller sets which tier this upload belongs to.
      return initData.publicUrl as string;
    } finally {
      setUploadingImage(false);
    }
  }

  const keyFor = (tier: Tier, dur: Duration) => `${tier}-${dur}`;

  useEffect(() => {
    // Seed UI from existing products
    const next: Record<string, string> = {};
    for (const tier of TIERS) {
      for (const dur of DURATIONS) {
        const p = getProduct(tier, dur);
        const cents = Number((p?.metadata as { tryPriceCents?: number } | null)?.tryPriceCents ?? 0);
        if (Number.isFinite(cents) && cents > 0) next[keyFor(tier, dur)] = (cents / 100).toFixed(2);
      }
      const anyP = products.find((p) => String((p.metadata as { tier?: string } | null)?.tier ?? "") === tier);
      if (anyP) {
        setTierAssets((prev) => ({
          ...prev,
          [tier]: {
            imageUrl: anyP.imageUrl ?? prev[tier].imageUrl,
            description: anyP.description ?? prev[tier].description,
          },
        }));
      }
    }
    setTryInputs((prev) => ({ ...next, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  function computeAzn(tryPrice: string): string {
    const v = Number(tryPrice);
    if (!pricing || !Number.isFinite(v) || v <= 0) return "—";
    const azn = v * pricing.tryToAznRate * (1 + pricing.profitMarginPsPlusPct / 100);
    return (Math.round(azn * 100) / 100).toFixed(2);
  }

  async function saveCell(tier: Tier, dur: Duration) {
    const k = keyFor(tier, dur);
    const tryPrice = Number(tryInputs[k]);
    if (!Number.isFinite(tryPrice) || tryPrice <= 0) {
      alert("TRY qiyməti düzgün deyil!");
      return;
    }
    setSaving(true);
    const existing = getProduct(tier, dur);
    const res = await fetch("/api/admin/ps-plus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "UPSERT_PRODUCT",
        id: existing?.id,
        tier,
        durationMonths: dur,
        tryPrice,
        isActive: existing?.isActive ?? true,
        sortOrder: existing?.sortOrder ?? 0,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Yadda saxlanmadı");
      setSaving(false);
      return;
    }
    setSaving(false);
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

  async function saveTierAssets(tier: Tier) {
    const a = tierAssets[tier];
    if (!a.imageUrl.trim()) {
      alert("Şəkil seçin (tier üçün).");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/admin/ps-plus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "SET_TIER_ASSETS",
        tier,
        imageUrl: a.imageUrl.trim(),
        description: a.description,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Yadda saxlanmadı");
      setSaving(false);
      return;
    }
    setSaving(false);
    loadProducts();
  }

  return (
    <div className="space-y-10">
      {/* Tier assets */}
      <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <header>
          <h2 className="text-lg font-semibold text-zinc-200">Tier şəkil və təsvir</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Şəkil və description tier üzrə bir dəfə seçilir (1/3/12 ay üçün hamısında eyni olur).
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-3">
          {TIERS.map((tier) => (
            <div key={tier} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className={`rounded-full px-2 py-0.5 text-[11px] ring-1 ${TIER_COLORS[tier]}`}>
                  {TIER_LABELS[tier]}
                </span>
              </div>

              <div className="space-y-3">
                <div className="block text-sm text-zinc-300">
                  <span>Şəkil</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const url = await handleImageUpload(f);
                      if (url) {
                        setTierAssets((prev) => ({
                          ...prev,
                          [tier]: { ...prev[tier], imageUrl: url },
                        }));
                      }
                      e.target.value = "";
                    }}
                  />
                  {tierAssets[tier].imageUrl ? (
                    <div className="mt-2 flex items-center gap-3 rounded border border-zinc-800 bg-zinc-900 p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={tierAssets[tier].imageUrl} alt="" className="h-16 w-16 rounded object-cover" />
                      <div className="flex-1 truncate text-xs text-zinc-400">{tierAssets[tier].imageUrl}</div>
                      <button
                        type="button"
                        onClick={() => setTierAssets((prev) => ({ ...prev, [tier]: { ...prev[tier], imageUrl: "" } }))}
                        className="rounded p-1 text-zinc-500 hover:text-rose-400"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={uploadingImage}
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded border border-dashed border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-400 hover:border-indigo-500 hover:text-indigo-400 disabled:opacity-50"
                    >
                      {uploadingImage ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Yüklənir...</>
                      ) : (
                        <><Upload className="h-3.5 w-3.5" /> Şəkil yüklə</>
                      )}
                    </button>
                  )}
                </div>

                <label className="block text-sm text-zinc-300">
                  Description
                  <textarea
                    rows={3}
                    className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                    value={tierAssets[tier].description}
                    onChange={(e) =>
                      setTierAssets((prev) => ({
                        ...prev,
                        [tier]: { ...prev[tier], description: e.target.value },
                      }))
                    }
                    placeholder="Qısa izah..."
                  />
                </label>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => saveTierAssets(tier)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Yadda saxla
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Plans Matrix */}
      <div>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-200">Plan qiymətləri (TRY daxil et)</h2>
            <p className="mt-1 text-sm text-zinc-400">
              AZN avtomatik hesablanır (Pricing Settings → TRY rate + PS Plus kâr %).
            </p>
          </div>
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
                      const k = keyFor(tier, dur);
                      const tryVal = tryInputs[k] ?? "";
                      return (
                        <td key={tier} className="px-5 py-4 text-center">
                          <div className="mx-auto w-full max-w-[220px] space-y-2">
                            <div className="text-xs text-zinc-500">TRY qiyməti</div>
                            <input
                              value={tryVal}
                              onChange={(e) =>
                                setTryInputs((prev) => ({ ...prev, [k]: e.target.value }))
                              }
                              type="number"
                              step="0.01"
                              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
                              placeholder="məs: 199.99"
                            />
                            <div className="text-xs text-zinc-500">
                              AZN: <span className="font-semibold text-zinc-200">{computeAzn(tryVal)}</span>
                            </div>

                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => saveCell(tier, dur)}
                                className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-50"
                              >
                                <Check className="h-3.5 w-3.5" /> Yadda saxla
                              </button>
                              {p ? (
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => deleteProduct(p.id, p.title)}
                                  className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-2.5 py-1.5 text-xs font-semibold text-rose-200 ring-1 ring-rose-500/30 hover:bg-rose-500/25 disabled:opacity-50"
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> Sil
                                </button>
                              ) : null}
                            </div>
                          </div>
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
    </div>
  );
}
