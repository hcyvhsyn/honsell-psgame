"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type InGameType = "PUBG_UC" | "POINT_BLANK_TG";
type DeliveryMethod = "EPIN" | "ID_TOPUP";

type ProductMetadata = {
  amount?: number;
  currency?: string;
  tryPriceCents?: number;
  deliveryMethod?: DeliveryMethod;
};

type Product = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  priceAznCents: number;
  isActive: boolean;
  sortOrder: number;
  metadata: ProductMetadata | null;
};

type Order = {
  id: string;
  createdAt: string;
  amountAznCents: number;
  metadata: string | null;
  user: { id: string; email: string; name: string | null };
  serviceProduct: { id: string; title: string; metadata: ProductMetadata | null } | null;
};

function parseOrderMetadata(raw: string | null): { playerId?: string } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // legacy free-form metadata
  }
  return null;
}

type Props = {
  type: InGameType;
  currencyLabel: string;
  productNoun: string;
  recommendedImageSize: string;
  /** Bynogame paste import dəstəklənirsə true. (Hələ yalnız PUBG UC.) */
  supportsBynogameImport?: boolean;
};

type ParsedItem = {
  amount: number;
  deliveryMethod: "EPIN" | "ID_TOPUP";
  tryPrice: number;
  originalTryPrice: number;
};

type DraftState = {
  id?: string;
  amount: string;
  tryPrice: string;
  aznPrice: string;
  deliveryMethod: DeliveryMethod;
  imageUrl: string;
  description: string;
  isActive: boolean;
  sortOrder: string;
};

const emptyDraft: DraftState = {
  amount: "",
  tryPrice: "",
  aznPrice: "",
  deliveryMethod: "EPIN",
  imageUrl: "",
  description: "",
  isActive: true,
  sortOrder: "0",
};

const DEFAULT_TRY_RATE = 0.053;

function formatAzn(cents: number) {
  return (cents / 100).toLocaleString("az-AZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatNumber(n: number, digits = 2) {
  return n.toLocaleString("az-AZ", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export default function InGameCreditAdminClient({
  type,
  currencyLabel,
  productNoun,
  recommendedImageSize,
  supportsBynogameImport = false,
}: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tryRate, setTryRate] = useState<number>(DEFAULT_TRY_RATE);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [draft, setDraft] = useState<DraftState>(emptyDraft);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEditing = Boolean(draft.id);

  // Bynogame import dialog state
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importMargin, setImportMargin] = useState("25");
  const [importPreview, setImportPreview] = useState<ParsedItem[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    created: number;
    updated: number;
  } | null>(null);

  const apiBase = "/api/admin/in-game-credit";

  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const res = await fetch(`${apiBase}?type=${type}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Məhsulları yükləmək alınmadı");
      const data: Product[] = await res.json();
      setProducts(data);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Xəta baş verdi");
    } finally {
      setLoadingProducts(false);
    }
  }, [type]);

  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch(`${apiBase}?type=${type}&mode=orders`, { cache: "no-store" });
      if (!res.ok) throw new Error("Sifarişləri yükləmək alınmadı");
      const data: Order[] = await res.json();
      setOrders(data);
    } catch {
      // silent
    } finally {
      setLoadingOrders(false);
    }
  }, [type]);

  useEffect(() => {
    fetchProducts();
    fetchOrders();
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((s) => {
        if (s && typeof s.tryToAznRate === "number") setTryRate(s.tryToAznRate);
      })
      .catch(() => {});
  }, [fetchProducts, fetchOrders]);

  function openCreate() {
    setDraft(emptyDraft);
    setShowForm(true);
    setErr(null);
  }

  function openEdit(p: Product) {
    setDraft({
      id: p.id,
      amount: String(p.metadata?.amount ?? ""),
      tryPrice: p.metadata?.tryPriceCents ? (p.metadata.tryPriceCents / 100).toString() : "",
      aznPrice: (p.priceAznCents / 100).toString(),
      deliveryMethod: p.metadata?.deliveryMethod ?? "EPIN",
      imageUrl: p.imageUrl ?? "",
      description: p.description ?? "",
      isActive: p.isActive,
      sortOrder: String(p.sortOrder ?? 0),
    });
    setShowForm(true);
    setErr(null);
  }

  function cancel() {
    setShowForm(false);
    setDraft(emptyDraft);
    setErr(null);
  }

  async function handleUpload(file: File) {
    setErr(null);
    if (!file.type.startsWith("image/")) {
      setErr("Yalnız şəkil faylı yükləyə bilərsiniz");
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setErr("Format dəstəklənmir. PNG, JPEG və ya WEBP yükləyin.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErr("Fayl çox böyükdür (max 5 MB)");
      return;
    }
    setUploading(true);
    try {
      const init = await fetch("/api/admin/in-game-credit/image-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, type }),
      });
      const initData = await init.json();
      if (!init.ok) throw new Error(initData?.error ?? "Upload hazırlanmadı");
      const supabase = getSupabaseBrowser();
      const { error: upErr } = await supabase.storage
        .from(initData.bucket)
        .uploadToSignedUrl(initData.path, initData.token, file);
      if (upErr) throw new Error(upErr.message);
      setDraft((d) => ({ ...d, imageUrl: initData.publicUrl as string }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload alınmadı");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPSERT_PRODUCT",
          type,
          id: draft.id,
          amount: draft.amount,
          tryPrice: draft.tryPrice,
          aznPrice: draft.aznPrice,
          deliveryMethod: draft.deliveryMethod,
          imageUrl: draft.imageUrl,
          description: draft.description,
          isActive: draft.isActive,
          sortOrder: draft.sortOrder,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Yadda saxlamaq alınmadı");
      await fetchProducts();
      setShowForm(false);
      setDraft(emptyDraft);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Xəta baş verdi");
    } finally {
      setSaving(false);
    }
  }

  async function previewImport() {
    setErr(null);
    setImportPreview(null);
    setImportResult(null);
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "PREVIEW_IMPORT", type, text: importText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Preview alınmadı");
      setImportPreview(data.items ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Xəta baş verdi");
    }
  }

  async function applyImport() {
    setImporting(true);
    setErr(null);
    setImportResult(null);
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "IMPORT_FROM_TEXT",
          type,
          text: importText,
          marginPct: importMargin,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Import alınmadı");
      setImportResult({ created: data.created ?? 0, updated: data.updated ?? 0 });
      await fetchProducts();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Xəta baş verdi");
    } finally {
      setImporting(false);
    }
  }

  function closeImport() {
    setShowImport(false);
    setImportText("");
    setImportPreview(null);
    setImportResult(null);
  }

  async function remove(id: string) {
    if (!confirm("Bu məhsulu silmək istədiyinizə əminsiniz?")) return;
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DELETE_PRODUCT", type, id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Silinmədi");
      await fetchProducts();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Xəta baş verdi");
    }
  }

  const sortedProducts = useMemo(
    () =>
      [...products].sort((a, b) => {
        const sa = a.sortOrder - b.sortOrder;
        if (sa !== 0) return sa;
        return (a.metadata?.amount ?? 0) - (b.metadata?.amount ?? 0);
      }),
    [products],
  );

  const draftTryNum = Number(draft.tryPrice);
  const draftAznNum = Number(draft.aznPrice);
  const draftCostAzn = Number.isFinite(draftTryNum) ? draftTryNum * tryRate : 0;
  const draftProfit = Number.isFinite(draftAznNum) ? draftAznNum - draftCostAzn : 0;
  const draftMarginPct = draftCostAzn > 0 ? (draftProfit / draftCostAzn) * 100 : 0;

  return (
    <div className="space-y-8">
      {err && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {err}
        </div>
      )}

      {/* Products section */}
      <section className="rounded-2xl border border-white/10 bg-zinc-950/50 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">{productNoun} variantları</h2>
            <p className="text-xs text-zinc-400">
              TRY = maya, AZN = satış. Xeyir avtomatik hesablanır (cari rate: 1 TRY = {formatNumber(tryRate, 4)} AZN).
              Hər variant öz şəkli ilə göstərilir.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {supportsBynogameImport && (
              <button
                type="button"
                onClick={() => {
                  setShowImport(true);
                  setImportPreview(null);
                  setImportResult(null);
                }}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-violet-400/40 bg-violet-500/10 px-4 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/20"
              >
                <Download className="h-4 w-4" />
                Bynogame-dən import
              </button>
            )}
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-500"
            >
              <Plus className="h-4 w-4" />
              Yeni variant
            </button>
          </div>
        </div>

        {loadingProducts ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Yüklənir…
          </div>
        ) : sortedProducts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-black/30 px-4 py-10 text-center text-sm text-zinc-400">
            Hələ heç bir variant yoxdur. Yuxarıdan əlavə edin.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr className="border-b border-white/10">
                  <th className="px-3 py-2 font-semibold">Şəkil</th>
                  <th className="px-3 py-2 font-semibold">Sıra</th>
                  <th className="px-3 py-2 font-semibold">Başlıq</th>
                  <th className="px-3 py-2 font-semibold">Miqdar</th>
                  <th className="px-3 py-2 font-semibold">Çatdırılma</th>
                  <th className="px-3 py-2 font-semibold">TRY maya</th>
                  <th className="px-3 py-2 font-semibold">AZN satış</th>
                  <th className="px-3 py-2 font-semibold">Xeyir (AZN / %)</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold text-right">Əməliyyatlar</th>
                </tr>
              </thead>
              <tbody>
                {sortedProducts.map((p) => {
                  const tryCents = p.metadata?.tryPriceCents ?? 0;
                  const tryAmt = tryCents / 100;
                  const costAzn = tryAmt * tryRate;
                  const aznAmt = p.priceAznCents / 100;
                  const profit = aznAmt - costAzn;
                  const marginPct = costAzn > 0 ? (profit / costAzn) * 100 : 0;
                  return (
                    <tr key={p.id} className="border-b border-white/5 last:border-0">
                      <td className="px-3 py-3">
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.imageUrl}
                            alt={p.title}
                            className="h-10 w-20 rounded-lg border border-white/10 object-cover"
                          />
                        ) : (
                          <div className="grid h-10 w-20 place-items-center rounded-lg border border-dashed border-white/10 text-zinc-600">
                            <ImageIcon className="h-4 w-4" />
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 tabular-nums text-zinc-400">{p.sortOrder}</td>
                      <td className="px-3 py-3 text-zinc-100">{p.title}</td>
                      <td className="px-3 py-3 tabular-nums text-zinc-200">
                        {p.metadata?.amount ?? "—"} {p.metadata?.currency ?? ""}
                      </td>
                      <td className="px-3 py-3">
                        {p.metadata?.deliveryMethod === "ID_TOPUP" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-200">
                            ID yükləmə
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-xs font-semibold text-sky-200">
                            E-PIN
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 tabular-nums text-zinc-300">
                        {tryAmt > 0 ? `${formatNumber(tryAmt)} ₺` : "—"}
                      </td>
                      <td className="px-3 py-3 tabular-nums text-zinc-100">{formatNumber(aznAmt)} ₼</td>
                      <td className="px-3 py-3 tabular-nums">
                        <div className={profit >= 0 ? "text-emerald-300" : "text-rose-300"}>
                          {profit >= 0 ? "+" : ""}
                          {formatNumber(profit)} ₼
                        </div>
                        <div className="text-xs text-zinc-500">
                          {costAzn > 0 ? `${marginPct.toFixed(1)}%` : ""}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                            p.isActive
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-zinc-500/15 text-zinc-400"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              p.isActive ? "bg-emerald-400" : "bg-zinc-500"
                            }`}
                          />
                          {p.isActive ? "Aktiv" : "Deaktiv"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(p)}
                            aria-label="Redaktə et"
                            className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.06] text-zinc-300 transition hover:bg-white/[0.12] hover:text-white"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(p.id)}
                            aria-label="Sil"
                            className="grid h-8 w-8 place-items-center rounded-lg bg-rose-500/10 text-rose-300 transition hover:bg-rose-500/20"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Form */}
      {showForm && (
        <section className="rounded-2xl border border-violet-400/40 bg-violet-950/20 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-white">
              {isEditing ? "Variantı redaktə et" : "Yeni variant"}
            </h3>
            <button
              type="button"
              onClick={cancel}
              aria-label="Bağla"
              className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label={`Miqdar (${currencyLabel})`}>
              <input
                type="number"
                min={1}
                step={1}
                value={draft.amount}
                onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
                placeholder={currencyLabel === "UC" ? "660" : "1000"}
                className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-zinc-100 outline-none transition focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20"
              />
            </Field>

            <Field label="Sıralama (kiçik dəyər → öndə)">
              <input
                type="number"
                value={draft.sortOrder}
                onChange={(e) => setDraft((d) => ({ ...d, sortOrder: e.target.value }))}
                className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-zinc-100 outline-none transition focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20"
              />
            </Field>

            <Field label="TRY maya qiyməti (₺)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={draft.tryPrice}
                onChange={(e) => setDraft((d) => ({ ...d, tryPrice: e.target.value }))}
                placeholder="200.00"
                className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-zinc-100 outline-none transition focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20"
              />
            </Field>

            <Field label="AZN satış qiyməti (₼)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={draft.aznPrice}
                onChange={(e) => setDraft((d) => ({ ...d, aznPrice: e.target.value }))}
                placeholder="14.99"
                className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-zinc-100 outline-none transition focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20"
              />
            </Field>

            <Field label="Çatdırılma üsulu" className="md:col-span-2">
              <div className="grid grid-cols-2 gap-2">
                <DeliveryOption
                  active={draft.deliveryMethod === "EPIN"}
                  onClick={() => setDraft((d) => ({ ...d, deliveryMethod: "EPIN" }))}
                  title="E-PIN kod"
                  body="Müştəri özü kodu istifadə edir — emaillə göndərilir."
                />
                <DeliveryOption
                  active={draft.deliveryMethod === "ID_TOPUP"}
                  onClick={() => setDraft((d) => ({ ...d, deliveryMethod: "ID_TOPUP" }))}
                  title="ID yükləmə"
                  body="Admin müştərinin oyun ID-sinə birbaşa yükləyir."
                />
              </div>
            </Field>

            {/* Per-variant image upload */}
            <Field label="Şəkil (bu variant üçün)" className="md:col-span-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                }}
                className="hidden"
              />
              <div className="flex flex-wrap items-start gap-4">
                {draft.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={draft.imageUrl}
                    alt="Önizləmə"
                    className="h-28 w-40 rounded-xl border border-white/10 object-cover"
                  />
                ) : (
                  <div className="grid h-28 w-40 place-items-center rounded-xl border border-dashed border-white/10 text-xs text-zinc-500">
                    Şəkil yoxdur
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-4 text-sm font-semibold text-zinc-200 transition hover:border-violet-400/40 hover:bg-white/[0.06] disabled:opacity-60"
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {draft.imageUrl ? "Şəkli dəyiş" : "Şəkil yüklə"}
                  </button>
                  {draft.imageUrl && (
                    <button
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, imageUrl: "" }))}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Şəkli sil
                    </button>
                  )}
                  <p className="text-xs text-zinc-500">
                    Tövsiyə: <span className="font-semibold text-zinc-300">{recommendedImageSize}</span>
                    <br />
                    PNG, JPEG və ya WEBP, max 5 MB
                  </p>
                </div>
              </div>
            </Field>

            <Field label="Təsvir (istəyə görə)" className="md:col-span-2">
              <textarea
                rows={2}
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="Bu variantın xüsusiyyəti (bonus və s.)"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20"
              />
            </Field>
          </div>

          {(draftTryNum > 0 || draftAznNum > 0) && (
            <div className="mt-4 grid gap-3 rounded-xl border border-white/10 bg-black/30 p-4 sm:grid-cols-3">
              <Stat label="Maya (AZN)" value={`${formatNumber(draftCostAzn)} ₼`} tone="neutral" />
              <Stat
                label="Xeyir"
                value={`${draftProfit >= 0 ? "+" : ""}${formatNumber(draftProfit)} ₼`}
                tone={draftProfit >= 0 ? "good" : "bad"}
              />
              <Stat
                label="Marja"
                value={draftCostAzn > 0 ? `${draftMarginPct.toFixed(1)}%` : "—"}
                tone={draftMarginPct >= 0 ? "good" : "bad"}
              />
            </div>
          )}

          <label className="mt-4 flex items-center gap-2 text-sm text-zinc-200">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked }))}
              className="h-4 w-4 rounded border-white/30 bg-black/40 text-violet-500 focus:ring-violet-500"
            />
            Müştəri tərəfində görünür (aktiv)
          </label>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={cancel}
              className="h-10 rounded-xl border border-white/10 px-4 text-sm font-semibold text-zinc-300 transition hover:bg-white/5"
            >
              Ləğv et
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-500 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? "Yenilə" : "Yarat"}
            </button>
          </div>
        </section>
      )}

      {/* Bynogame import modal */}
      {showImport && (
        <BynogameImportModal
          tryRate={tryRate}
          text={importText}
          setText={setImportText}
          margin={importMargin}
          setMargin={setImportMargin}
          preview={importPreview}
          onPreview={previewImport}
          onApply={applyImport}
          onClose={closeImport}
          importing={importing}
          result={importResult}
        />
      )}

      {/* Pending orders */}
      <section className="rounded-2xl border border-white/10 bg-zinc-950/50 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">Gözləyən sifarişlər</h2>
            <p className="text-xs text-zinc-400">
              Bu siyahıdakı sifarişlər kod təyini gözləyir. (Phase 2-də assignment dialog-u əlavə olunacaq.)
            </p>
          </div>
          <button
            type="button"
            onClick={fetchOrders}
            className="h-9 rounded-lg border border-white/10 px-3 text-xs font-semibold text-zinc-300 transition hover:bg-white/5"
          >
            Yenilə
          </button>
        </div>

        {loadingOrders ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Yüklənir…
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-black/30 px-4 py-8 text-center text-sm text-zinc-400">
            Hal-hazırda gözləyən sifariş yoxdur.
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {orders.map((o) => {
              const meta = parseOrderMetadata(o.metadata);
              const isIdTopup = o.serviceProduct?.metadata?.deliveryMethod === "ID_TOPUP";
              return (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-zinc-100">{o.serviceProduct?.title ?? "—"}</div>
                    <div className="text-xs text-zinc-400">
                      {o.user.name ?? o.user.email} · {new Date(o.createdAt).toLocaleString("az-AZ")}
                    </div>
                    {isIdTopup && (
                      <div className="mt-1.5 inline-flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-100">
                        <span className="font-semibold">Oyun ID:</span>
                        <span className="font-mono tabular-nums">{meta?.playerId ?? "—"}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-bold tabular-nums text-zinc-100">
                      {formatAzn(Math.abs(o.amountAznCents))} ₼
                    </div>
                    <div className="text-xs text-amber-300">PENDING</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function DeliveryOption({
  active,
  onClick,
  title,
  body,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition ${
        active
          ? "border-violet-400/70 bg-violet-500/15 ring-2 ring-violet-500/20"
          : "border-white/10 bg-black/40 hover:border-white/20"
      }`}
    >
      <div className={`text-sm font-semibold ${active ? "text-violet-100" : "text-zinc-200"}`}>
        {title}
      </div>
      <div className="mt-0.5 text-xs text-zinc-400">{body}</div>
    </button>
  );
}

function BynogameImportModal({
  tryRate,
  text,
  setText,
  margin,
  setMargin,
  preview,
  onPreview,
  onApply,
  onClose,
  importing,
  result,
}: {
  tryRate: number;
  text: string;
  setText: (s: string) => void;
  margin: string;
  setMargin: (s: string) => void;
  preview: ParsedItem[] | null;
  onPreview: () => Promise<void>;
  onApply: () => Promise<void>;
  onClose: () => void;
  importing: boolean;
  result: { created: number; updated: number } | null;
}) {
  const marginNum = Number(margin);
  const validMargin = Number.isFinite(marginNum) && marginNum >= 0 && marginNum <= 500;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Bağla"
        onClick={onClose}
        className="absolute inset-0 h-full w-full bg-black/70 backdrop-blur-sm"
      />
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Bağla"
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-lg text-zinc-400 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="text-lg font-black text-white">Bynogame-dən PUBG UC import</h2>
        <p className="mt-1 text-xs text-zinc-400">
          Bynogame səhifəsində Ctrl+A → Ctrl+C edib, mətni aşağıya yapışdırın. Sistem hər
          variantı (60 UC, 325 UC, … və Top-Up versiyalarını) parse edib qiymətləri yeniləyəcək.
        </p>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Yapışdırılan mətn
          </span>
          <textarea
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Bynogame səhifəsindən kopyalanan tam mətn..."
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20"
          />
        </label>

        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Xeyir % (bütün variantlara tətbiq olunur)
            </span>
            <input
              type="number"
              min={0}
              max={500}
              step={1}
              value={margin}
              onChange={(e) => setMargin(e.target.value)}
              className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-zinc-100 outline-none transition focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20"
            />
            <p className="mt-1 text-xs text-zinc-500">
              AZN = TRY × {tryRate.toFixed(4)} × (1 + xeyir%/100)
            </p>
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={onPreview}
              disabled={!text.trim()}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-4 text-sm font-semibold text-zinc-200 transition hover:border-violet-400/40 disabled:opacity-50"
            >
              Önizlə
            </button>
          </div>
        </div>

        {preview && (
          <div className="mt-5 rounded-xl border border-white/10 bg-black/30 p-3">
            {preview.length === 0 ? (
              <p className="py-4 text-center text-sm text-zinc-400">
                Mətndən heç bir variant tapılmadı. Format düz deyilmi?
              </p>
            ) : (
              <>
                <div className="mb-2 text-xs text-zinc-400">
                  Tapıldı: <span className="font-semibold text-zinc-200">{preview.length} variant</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px] text-xs">
                    <thead className="text-left text-zinc-500">
                      <tr className="border-b border-white/10">
                        <th className="px-2 py-1.5 font-semibold">Miqdar</th>
                        <th className="px-2 py-1.5 font-semibold">Tip</th>
                        <th className="px-2 py-1.5 font-semibold">TRY</th>
                        <th className="px-2 py-1.5 font-semibold">AZN (hesablanır)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((item, i) => {
                        const azn = validMargin
                          ? item.tryPrice * tryRate * (1 + marginNum / 100)
                          : 0;
                        return (
                          <tr key={i} className="border-b border-white/5 last:border-0">
                            <td className="px-2 py-1.5 tabular-nums text-zinc-100">
                              {item.amount} UC
                            </td>
                            <td className="px-2 py-1.5">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  item.deliveryMethod === "ID_TOPUP"
                                    ? "bg-amber-500/15 text-amber-200"
                                    : "bg-sky-500/15 text-sky-200"
                                }`}
                              >
                                {item.deliveryMethod === "ID_TOPUP" ? "ID yükləmə" : "E-PIN"}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 tabular-nums text-zinc-300">
                              {item.tryPrice.toFixed(2)} ₺
                            </td>
                            <td className="px-2 py-1.5 tabular-nums text-zinc-100">
                              {validMargin ? `${azn.toFixed(2)} ₼` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {result && (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
            ✓ Tamamlandı: <span className="font-bold">{result.updated}</span> yeniləndi,{" "}
            <span className="font-bold">{result.created}</span> yaradıldı.
            {result.created > 0 && (
              <p className="mt-1 text-xs text-emerald-200/80">
                Yeni yaradılan variantlar şəkil yüklənənə qədər müştəri tərəfində gizlidir.
              </p>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-white/10 px-4 text-sm font-semibold text-zinc-300 transition hover:bg-white/5"
          >
            Bağla
          </button>
          <button
            type="button"
            onClick={onApply}
            disabled={!text.trim() || !validMargin || importing}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-500 disabled:opacity-60"
          >
            {importing && <Loader2 className="h-4 w-4 animate-spin" />}
            Tətbiq et
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "bad" | "neutral";
}) {
  const color =
    tone === "good"
      ? "text-emerald-300"
      : tone === "bad"
        ? "text-rose-300"
        : "text-zinc-100";
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-0.5 text-lg font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
