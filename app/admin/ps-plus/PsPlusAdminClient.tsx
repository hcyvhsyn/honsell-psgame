"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Trash2, Check, X as XIcon, RefreshCw, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { useDialog } from "@/lib/dialogs";

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
  ESSENTIAL: "border-blue-500/40 bg-blue-500/10 text-blue-700",
  EXTRA: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
  DELUXE: "border-amber-500/40 bg-amber-500/10 text-amber-700",
};

const TIER_LABELS: Record<Tier, string> = {
  ESSENTIAL: "Essential",
  EXTRA: "Extra",
  DELUXE: "Deluxe",
};

export default function PsPlusAdminClient() {
  const dialog = useDialog();
  const [products, setProducts] = useState<ServiceProduct[]>([]);
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingTier, setUploadingTier] = useState<Tier | null>(null);
  const [pricing, setPricing] = useState<{ tryToAznRate: number; profitMarginPsPlusPct: number } | null>(null);

  const [tierAssets, setTierAssets] = useState<Record<Tier, { imageUrl: string; description: string }>>({
    ESSENTIAL: { imageUrl: "", description: "" },
    EXTRA: { imageUrl: "", description: "" },
    DELUXE: { imageUrl: "", description: "" },
  });

  const [tryInputs, setTryInputs] = useState<Record<string, string>>({});
  const [aznInputs, setAznInputs] = useState<Record<string, string>>({});

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

  async function handleImageUpload(tier: Tier, file: File) {
    if (!file.type.startsWith("image/")) {
      await dialog.alert({ title: "Yanlış fayl tipi", message: "Yalnız şəkil faylı yükləyə bilərsiniz", tone: "warning" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      await dialog.alert({ title: "Fayl ölçüsü çox böyükdür", message: "Fayl çox böyükdür (max 5 MB)", tone: "warning" });
      return;
    }
    setUploadingTier(tier);
    try {
      const init = await fetch("/api/admin/ps-plus/image-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, tier }),
      });
      const initData = await init.json();
      if (!init.ok) {
        await dialog.alert({ title: "Upload hazırlanmadı", message: initData.error ?? "Upload hazırlanmadı", tone: "danger" });
        return;
      }
      const supabase = getSupabaseBrowser();
      const { error: upErr } = await supabase.storage
        .from(initData.bucket)
        .uploadToSignedUrl(initData.path, initData.token, file);
      if (upErr) {
        await dialog.alert({ title: "Upload alınmadı", message: upErr.message, tone: "danger" });
        return;
      }
      return initData.publicUrl as string;
    } finally {
      setUploadingTier(null);
    }
  }

  const keyFor = (tier: Tier, dur: Duration) => `${tier}-${dur}`;

  useEffect(() => {
    // Seed UI from existing products
    const nextTry: Record<string, string> = {};
    const nextAzn: Record<string, string> = {};
    for (const tier of TIERS) {
      for (const dur of DURATIONS) {
        const p = getProduct(tier, dur);
        const tryCents = Number((p?.metadata as { tryPriceCents?: number } | null)?.tryPriceCents ?? 0);
        if (Number.isFinite(tryCents) && tryCents > 0) nextTry[keyFor(tier, dur)] = (tryCents / 100).toFixed(2);
        const aznCents = Number(p?.priceAznCents ?? 0);
        if (Number.isFinite(aznCents) && aznCents > 0) nextAzn[keyFor(tier, dur)] = (aznCents / 100).toFixed(2);
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
    setTryInputs((prev) => ({ ...nextTry, ...prev }));
    setAznInputs((prev) => ({ ...nextAzn, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  function computeProfit(tryPrice: string, aznPrice: string): { value: string; positive: boolean | null } {
    const t = Number(tryPrice);
    const a = Number(aznPrice);
    if (!pricing || !Number.isFinite(t) || t <= 0 || !Number.isFinite(a) || a <= 0) {
      return { value: "—", positive: null };
    }
    const cost = t * pricing.tryToAznRate;
    const profit = a - cost;
    return {
      value: (Math.round(profit * 100) / 100).toFixed(2),
      positive: profit >= 0,
    };
  }

  async function saveCell(tier: Tier, dur: Duration) {
    const k = keyFor(tier, dur);
    const tryPrice = Number(tryInputs[k]);
    const aznPrice = Number(aznInputs[k]);
    if (!Number.isFinite(tryPrice) || tryPrice <= 0) {
      await dialog.alert({ title: "Yanlış qiymət", message: "TRY (maya) qiyməti düzgün deyil!", tone: "warning" });
      return;
    }
    if (!Number.isFinite(aznPrice) || aznPrice <= 0) {
      await dialog.alert({ title: "Yanlış qiymət", message: "AZN satış qiyməti düzgün deyil!", tone: "warning" });
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
        aznPrice,
        isActive: existing?.isActive ?? true,
        sortOrder: existing?.sortOrder ?? 0,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      await dialog.alert({ title: "Yadda saxlanmadı", message: d.error ?? "Yadda saxlanmadı", tone: "danger" });
      setSaving(false);
      return;
    }
    setSaving(false);
    loadProducts();
  }

  async function deleteProduct(id: string, title: string) {
    if (
      !(await dialog.confirm({
        title: "Planı sil?",
        message: <p>«{title}» planı silinsin?</p>,
        confirmLabel: "Sil",
        tone: "danger",
      }))
    )
      return;
    await fetch("/api/admin/ps-plus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DELETE_PRODUCT", id }),
    });
    loadProducts();
  }

  async function processOrder(id: string, action: "SUCCESS" | "FAILED") {
    if (
      !(await dialog.confirm({
        title: action === "SUCCESS" ? "Sifarişi tamamla?" : "Sifarişi rədd et?",
        confirmLabel: action === "SUCCESS" ? "Tamamla" : "Rədd et",
        tone: action === "SUCCESS" ? "default" : "danger",
      }))
    )
      return;
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
      await dialog.alert({ title: "Şəkil seçin", message: "Şəkil seçin (tier üçün).", tone: "warning" });
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
      await dialog.alert({ title: "Yadda saxlanmadı", message: d.error ?? "Yadda saxlanmadı", tone: "danger" });
      setSaving(false);
      return;
    }
    setSaving(false);
    loadProducts();
  }

  return (
    <div className="space-y-10">
      {/* Tier assets */}
      <section className="space-y-4 rounded-xl border border-admin-line bg-admin-card p-5">
        <header>
          <h2 className="text-lg font-semibold text-zinc-800">Tier şəkil və təsvir</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Şəkil və description tier üzrə bir dəfə seçilir (1/3/12 ay üçün hamısında eyni olur).
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-3">
          {TIERS.map((tier) => (
            <div key={tier} className="rounded-xl border border-admin-line bg-admin-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className={`rounded-full px-2 py-0.5 text-[11px] ring-1 ${TIER_COLORS[tier]}`}>
                  {TIER_LABELS[tier]}
                </span>
              </div>

              <div className="space-y-3">
                <div className="block text-sm text-zinc-700">
                  <span>Şəkil</span>
                  <input
                    id={`psplus-tier-upload-${tier}`}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const url = await handleImageUpload(tier, f);
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
                    <div className="mt-2 flex items-center gap-3 rounded border border-admin-line bg-admin-card p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={tierAssets[tier].imageUrl} alt="" className="h-16 w-16 rounded object-cover" />
                      <div className="flex-1 truncate text-xs text-zinc-600">{tierAssets[tier].imageUrl}</div>
                      <button
                        type="button"
                        onClick={() => setTierAssets((prev) => ({ ...prev, [tier]: { ...prev[tier], imageUrl: "" } }))}
                        className="rounded p-1 text-zinc-500 hover:text-rose-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={uploadingTier !== null}
                      onClick={() => {
                        const el = document.getElementById(
                          `psplus-tier-upload-${tier}`
                        ) as HTMLInputElement | null;
                        el?.click();
                      }}
                      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded border border-dashed border-admin-line2 bg-admin-card px-3 py-2 text-xs text-zinc-600 hover:border-violet-500 hover:text-violet-600 disabled:opacity-50"
                    >
                      {uploadingTier === tier ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Yüklənir...
                        </>
                      ) : (
                        <><Upload className="h-3.5 w-3.5" /> Şəkil yüklə</>
                      )}
                    </button>
                  )}
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Tövsiyə olunan ölçü: <b className="text-zinc-700">1200×900px</b> (4:3 aspekt) — PS Plus kartları public-də 4:3 nisbətdə render olunur.
                  </p>
                </div>

                <label className="block text-sm text-zinc-700">
                  Description
                  <textarea
                    rows={3}
                    className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-violet-500 focus:outline-none"
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
                  className="inline-flex w-full items-center justify-center gap-2 rounded bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
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
            <h2 className="text-lg font-semibold text-zinc-800">Plan qiymətləri</h2>
            <p className="mt-1 text-sm text-zinc-600">
              TRY = maya qiyməti, AZN = satış qiyməti (əl ilə daxil et). Xeyir avtomatik hesablanır.
            </p>
          </div>
          <button
            onClick={loadProducts}
            className="inline-flex items-center gap-1.5 rounded-lg bg-admin-chip px-3 py-1.5 text-sm text-zinc-700 hover:bg-admin-chip2"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Yenilə
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-500" />
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-admin-line bg-admin-card">
            <table className="w-full text-sm">
              <thead className="bg-admin-card text-xs uppercase text-zinc-500">
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
              <tbody className="divide-y divide-admin-line">
                {DURATIONS.map((dur) => (
                  <tr key={dur} className="hover:bg-admin-chip">
                    <td className="px-5 py-4 font-semibold text-zinc-700">{dur} ay</td>
                    {TIERS.map((tier) => {
                      const p = getProduct(tier, dur);
                      const k = keyFor(tier, dur);
                      const tryVal = tryInputs[k] ?? "";
                      const aznVal = aznInputs[k] ?? "";
                      const profit = computeProfit(tryVal, aznVal);
                      return (
                        <td key={tier} className="px-5 py-4 text-center">
                          <div className="mx-auto w-full max-w-[220px] space-y-2">
                            <div className="text-left text-xs text-zinc-500">TRY (maya)</div>
                            <input
                              value={tryVal}
                              onChange={(e) =>
                                setTryInputs((prev) => ({ ...prev, [k]: e.target.value }))
                              }
                              type="number"
                              step="0.01"
                              className="w-full rounded-md border border-admin-line bg-admin-card px-3 py-2 text-sm text-zinc-900 focus:border-violet-500 focus:outline-none"
                              placeholder="məs: 199.99"
                            />
                            <div className="text-left text-xs text-zinc-500">AZN (satış)</div>
                            <input
                              value={aznVal}
                              onChange={(e) =>
                                setAznInputs((prev) => ({ ...prev, [k]: e.target.value }))
                              }
                              type="number"
                              step="0.01"
                              className="w-full rounded-md border border-admin-line bg-admin-card px-3 py-2 text-sm text-zinc-900 focus:border-violet-500 focus:outline-none"
                              placeholder="məs: 14.99"
                            />
                            <div className="text-xs text-zinc-500">
                              Xeyir:{" "}
                              <span
                                className={`font-semibold ${
                                  profit.positive === null
                                    ? "text-zinc-800"
                                    : profit.positive
                                      ? "text-emerald-700"
                                      : "text-rose-700"
                                }`}
                              >
                                {profit.value} AZN
                              </span>
                            </div>

                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => saveCell(tier, dur)}
                                className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-50"
                              >
                                <Check className="h-3.5 w-3.5" /> Yadda saxla
                              </button>
                              {p ? (
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => deleteProduct(p.id, p.title)}
                                  className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-2.5 py-1.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-500/30 hover:bg-rose-500/25 disabled:opacity-50"
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
          <h2 className="text-lg font-semibold text-zinc-800">
            Gözləyən sifarişlər
            {orders.length > 0 && (
              <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-sm font-semibold text-amber-700 ring-1 ring-amber-500/30">
                {orders.length}
              </span>
            )}
          </h2>
          <button
            onClick={loadOrders}
            className="inline-flex items-center gap-1.5 rounded-lg bg-admin-chip px-3 py-1.5 text-sm text-zinc-700 hover:bg-admin-chip2"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Yenilə
          </button>
        </div>

        {ordersLoading ? (
          <div className="py-10 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-violet-500" />
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-admin-line bg-admin-card py-12 text-center text-zinc-500">
            Gözləyən PS Plus sifarişi yoxdur.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-admin-line bg-admin-card">
            <table className="w-full text-left text-sm">
              <thead className="bg-admin-card text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-5 py-4 font-medium">Müştəri</th>
                  <th className="px-5 py-4 font-medium">Plan</th>
                  <th className="px-5 py-4 font-medium">PSN Hesab</th>
                  <th className="px-5 py-4 font-medium">Məbləğ</th>
                  <th className="px-5 py-4 font-medium">Tarix</th>
                  <th className="px-5 py-4 font-medium">Əməliyyat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-line">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-admin-chip">
                    <td className="px-5 py-4">
                      <div className="font-medium text-zinc-800">{o.user.name || "—"}</div>
                      <div className="text-xs text-zinc-500">{o.user.email}</div>
                    </td>
                    <td className="px-5 py-4 text-zinc-700">{o.serviceProduct?.title ?? "—"}</td>
                    <td className="px-5 py-4">
                      {o.psnAccount ? (
                        <div>
                          <div className="font-medium text-zinc-800">{o.psnAccount.label}</div>
                          <div className="text-xs text-zinc-500">{o.psnAccount.psnEmail}</div>
                        </div>
                      ) : (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 font-semibold text-zinc-800">
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
                          className="rounded bg-emerald-500/20 p-1.5 text-emerald-600 hover:bg-emerald-500/30"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => processOrder(o.id, "FAILED")}
                          title="Rədd et"
                          className="rounded bg-rose-500/20 p-1.5 text-rose-600 hover:bg-rose-500/30"
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
