"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { uploadAdminImage } from "@/lib/uploadImageClient";
import {
  Boxes,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";

const TYPE = "POINT_BLANK_TG";

type ProductMetadata = {
  amount?: number;
  currency?: string;
};

type Product = {
  id: string;
  type: string;
  title: string;
  imageUrl: string | null;
  priceAznCents: number;
  isActive: boolean;
  sortOrder: number;
  metadata: ProductMetadata | null;
  _count?: { codes: number };
};

type CodeRow = { id: string; code: string; isUsed: boolean; createdAt: string };

type DraftState = {
  id?: string;
  amount: string;
  aznPrice: string;
  imageUrl: string;
  isActive: boolean;
  sortOrder: string;
};

const emptyDraft: DraftState = {
  amount: "",
  aznPrice: "",
  imageUrl: "",
  isActive: true,
  sortOrder: "0",
};

// Deterministik az-AZ formatı (vergüllü onluq) — server/client hidrasiya uyğun.
function formatAzn(cents: number) {
  const fixed = (cents / 100).toFixed(2);
  const [intPart, fracPart] = fixed.split(".");
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${withThousands},${fracPart}`;
}

export default function PointBlankAdminClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [draft, setDraft] = useState<DraftState>(emptyDraft);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEditing = Boolean(draft.id);

  // Kod stoku modal state
  const [codesProduct, setCodesProduct] = useState<Product | null>(null);
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [codesText, setCodesText] = useState("");
  const [codesSaving, setCodesSaving] = useState(false);
  const [codesErr, setCodesErr] = useState<string | null>(null);

  const apiBase = "/api/admin/in-game-credit";

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}?type=${TYPE}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Məhsulları yükləmək alınmadı");
      const data: Product[] = await res.json();
      setProducts(data);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Xəta baş verdi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  function openCreate() {
    setDraft(emptyDraft);
    setShowForm(true);
    setErr(null);
  }

  function openEdit(p: Product) {
    setDraft({
      id: p.id,
      amount: String(p.metadata?.amount ?? ""),
      aznPrice: (p.priceAznCents / 100).toString(),
      imageUrl: p.imageUrl ?? "",
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
      const up = await uploadAdminImage(`${apiBase}/image-upload`, file, { type: TYPE });
      if (!up.ok) throw new Error(up.error ?? "Upload hazırlanmadı");
      setDraft((d) => ({ ...d, imageUrl: up.url as string }));
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
          type: TYPE,
          id: draft.id,
          amount: draft.amount,
          aznPrice: draft.aznPrice,
          imageUrl: draft.imageUrl,
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

  async function remove(id: string) {
    if (!confirm("Bu variantı silmək istədiyinizə əminsiniz?")) return;
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DELETE_PRODUCT", type: TYPE, id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Silinmədi");
      await fetchProducts();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Xəta baş verdi");
    }
  }

  // ─── Kod stoku ──────────────────────────────────────────────────────────
  const fetchCodes = useCallback(async (productId: string) => {
    setCodesLoading(true);
    try {
      const res = await fetch(`/api/admin/services?codesFor=${encodeURIComponent(productId)}`);
      if (!res.ok) throw new Error("Kodları yükləmək alınmadı");
      const data: CodeRow[] = await res.json();
      setCodes(data);
    } catch (e) {
      setCodesErr(e instanceof Error ? e.message : "Xəta baş verdi");
    } finally {
      setCodesLoading(false);
    }
  }, []);

  function openCodes(p: Product) {
    setCodesProduct(p);
    setCodes([]);
    setCodesText("");
    setCodesErr(null);
    fetchCodes(p.id);
  }

  function closeCodes() {
    setCodesProduct(null);
    setCodes([]);
    setCodesText("");
    setCodesErr(null);
    // Stok sayğacının yenilənməsi üçün siyahını təzələyirik.
    fetchProducts();
  }

  async function addCodes() {
    if (!codesProduct || !codesText.trim()) return;
    setCodesSaving(true);
    setCodesErr(null);
    try {
      const res = await fetch("/api/admin/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_CODES",
          serviceProductId: codesProduct.id,
          codesText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Kodlar əlavə olunmadı");
      setCodesText("");
      await fetchCodes(codesProduct.id);
    } catch (e) {
      setCodesErr(e instanceof Error ? e.message : "Xəta baş verdi");
    } finally {
      setCodesSaving(false);
    }
  }

  async function deleteCode(codeId: string) {
    setCodesErr(null);
    try {
      const res = await fetch("/api/admin/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DELETE_CODE", codeId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Silinmədi");
      if (codesProduct) await fetchCodes(codesProduct.id);
    } catch (e) {
      setCodesErr(e instanceof Error ? e.message : "Xəta baş verdi");
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

  const unusedCodes = codes.filter((c) => !c.isUsed).length;

  return (
    <div className="space-y-8">
      {err && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
          {err}
        </div>
      )}

      {/* Variants section */}
      <section className="rounded-2xl border border-admin-line bg-admin-card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">TG paketi variantları</h2>
            <p className="text-xs text-zinc-600">
              Hər variant üçün miqdar, satış qiyməti və şəkil təyin edin. E-pin kodları “Kod
              stoku” düyməsindən əlavə olunur — müştəri alanda kod avtomatik təhvil verilir.
              Stok bitəndə sifariş “Sifarişlər” bölməsinə düşür və əl ilə təhvil verilir.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-500"
          >
            <Plus className="h-4 w-4" />
            Yeni variant
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-zinc-600">
            <Loader2 className="h-4 w-4 animate-spin" /> Yüklənir…
          </div>
        ) : sortedProducts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-admin-line bg-admin-chip px-4 py-10 text-center text-sm text-zinc-600">
            Hələ heç bir variant yoxdur. Yuxarıdan əlavə edin.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr className="border-b border-admin-line">
                  <th className="px-3 py-2 font-semibold">Şəkil</th>
                  <th className="px-3 py-2 font-semibold">Sıra</th>
                  <th className="px-3 py-2 font-semibold">Başlıq</th>
                  <th className="px-3 py-2 font-semibold">Miqdar</th>
                  <th className="px-3 py-2 font-semibold">AZN qiymət</th>
                  <th className="px-3 py-2 font-semibold">Stok</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold text-right">Əməliyyatlar</th>
                </tr>
              </thead>
              <tbody>
                {sortedProducts.map((p) => {
                  const stock = p._count?.codes ?? 0;
                  return (
                    <tr key={p.id} className="border-b border-admin-line last:border-0">
                      <td className="px-3 py-3">
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.imageUrl}
                            alt={p.title}
                            className="h-12 w-12 rounded-lg border border-admin-line object-cover"
                          />
                        ) : (
                          <div className="grid h-12 w-12 place-items-center rounded-lg border border-dashed border-admin-line text-zinc-600">
                            <ImageIcon className="h-4 w-4" />
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 tabular-nums text-zinc-600">{p.sortOrder}</td>
                      <td className="px-3 py-3 text-zinc-900">{p.title}</td>
                      <td className="px-3 py-3 tabular-nums text-zinc-800">
                        {p.metadata?.amount ?? "—"} {p.metadata?.currency ?? "TG"}
                      </td>
                      <td className="px-3 py-3 tabular-nums text-zinc-900">
                        {formatAzn(p.priceAznCents)} ₼
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                            stock > 0
                              ? "bg-emerald-500/15 text-emerald-700"
                              : "bg-rose-500/15 text-rose-700"
                          }`}
                        >
                          {stock} kod
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                            p.isActive
                              ? "bg-emerald-500/15 text-emerald-700"
                              : "bg-zinc-500/15 text-zinc-600"
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
                            onClick={() => openCodes(p)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-violet-500/10 px-2.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-500/20"
                          >
                            <Boxes className="h-3.5 w-3.5" />
                            Kod stoku
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(p)}
                            aria-label="Redaktə et"
                            className="grid h-8 w-8 place-items-center rounded-lg bg-admin-chip text-zinc-700 transition hover:bg-admin-chip2 hover:text-zinc-900"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(p.id)}
                            aria-label="Sil"
                            className="grid h-8 w-8 place-items-center rounded-lg bg-rose-500/10 text-rose-700 transition hover:bg-rose-500/20"
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
            <h3 className="text-base font-bold text-zinc-900">
              {isEditing ? "Variantı redaktə et" : "Yeni variant"}
            </h3>
            <button
              type="button"
              onClick={cancel}
              aria-label="Bağla"
              className="grid h-8 w-8 place-items-center rounded-lg text-zinc-600 transition hover:bg-admin-chip2 hover:text-zinc-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Miqdar (TG)">
              <input
                type="number"
                min={1}
                step={1}
                value={draft.amount}
                onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
                placeholder="1000"
                className="h-11 w-full rounded-xl border border-admin-line bg-admin-chip px-3 text-sm text-zinc-900 outline-none transition focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20"
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
                className="h-11 w-full rounded-xl border border-admin-line bg-admin-chip px-3 text-sm text-zinc-900 outline-none transition focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20"
              />
            </Field>

            <Field label="Sıralama (kiçik dəyər → öndə)">
              <input
                type="number"
                value={draft.sortOrder}
                onChange={(e) => setDraft((d) => ({ ...d, sortOrder: e.target.value }))}
                className="h-11 w-full rounded-xl border border-admin-line bg-admin-chip px-3 text-sm text-zinc-900 outline-none transition focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20"
              />
            </Field>

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
                    className="h-32 w-32 rounded-xl border border-admin-line object-cover"
                  />
                ) : (
                  <div className="grid h-32 w-32 place-items-center rounded-xl border border-dashed border-admin-line text-xs text-zinc-500">
                    Şəkil yoxdur
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-admin-line bg-admin-chip px-4 text-sm font-semibold text-zinc-800 transition hover:border-violet-400/40 hover:bg-admin-chip2 disabled:opacity-60"
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
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-500/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Şəkli sil
                    </button>
                  )}
                  <p className="text-xs text-zinc-500">
                    Tövsiyə: <span className="font-semibold text-zinc-700">800×800 px (1:1, kvadrat)</span>
                    <br />
                    PNG, JPEG və ya WEBP, max 5 MB
                  </p>
                </div>
              </div>
            </Field>
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm text-zinc-800">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked }))}
              className="h-4 w-4 rounded border-admin-line bg-admin-chip text-violet-500 focus:ring-violet-500"
            />
            Müştəri tərəfində görünür (aktiv)
          </label>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={cancel}
              className="h-10 rounded-xl border border-admin-line px-4 text-sm font-semibold text-zinc-700 transition hover:bg-admin-chip2"
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

      {/* Kod stoku modal */}
      {codesProduct && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          <button
            type="button"
            aria-label="Bağla"
            onClick={closeCodes}
            className="absolute inset-0 h-full w-full bg-black/70 backdrop-blur-sm"
          />
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-admin-line bg-admin-card p-6 shadow-2xl">
            <button
              type="button"
              onClick={closeCodes}
              aria-label="Bağla"
              className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-lg text-zinc-600 transition hover:bg-admin-chip2 hover:text-zinc-900"
            >
              <X className="h-4 w-4" />
            </button>

            <h2 className="text-lg font-black text-zinc-900">Kod stoku — {codesProduct.title}</h2>
            <p className="mt-1 text-xs text-zinc-600">
              Hər sətirə bir e-pin kod yapışdırın. Müştəri bu variantı alanda ən köhnə istifadə
              olunmamış kod avtomatik təhvil verilir. Stok bitəndə sifariş “Sifarişlər → Hədiyyə
              kart / Point Blank” bölməsinə düşür.
            </p>

            {codesErr && (
              <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">
                {codesErr}
              </div>
            )}

            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-600">
                Yeni kodlar (hər sətirə bir)
              </span>
              <textarea
                rows={4}
                value={codesText}
                onChange={(e) => setCodesText(e.target.value)}
                placeholder={"PB-XXXX-XXXX-XXXX\nPB-YYYY-YYYY-YYYY"}
                className="w-full rounded-xl border border-admin-line bg-admin-chip px-3 py-2 font-mono text-sm text-zinc-900 outline-none transition focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20"
              />
            </label>
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={addCodes}
                disabled={codesSaving || !codesText.trim()}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
              >
                {codesSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Əlavə et
              </button>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900">Mövcud kodlar</h3>
              <span className="text-xs text-zinc-600">
                Stokda: <span className="font-bold text-emerald-700">{unusedCodes}</span> ·
                Cəmi: {codes.length}
              </span>
            </div>

            {codesLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-zinc-600">
                <Loader2 className="h-4 w-4 animate-spin" /> Yüklənir…
              </div>
            ) : codes.length === 0 ? (
              <div className="mt-2 rounded-xl border border-dashed border-admin-line bg-admin-chip px-4 py-6 text-center text-sm text-zinc-600">
                Hələ kod yoxdur.
              </div>
            ) : (
              <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-admin-line">
                <table className="w-full text-sm">
                  <tbody>
                    {codes.map((c) => (
                      <tr key={c.id} className="border-b border-admin-line last:border-0">
                        <td className="px-3 py-2 font-mono text-xs text-zinc-800">{c.code}</td>
                        <td className="px-3 py-2">
                          {c.isUsed ? (
                            <span className="inline-flex rounded-full bg-zinc-500/15 px-2 py-0.5 text-xs font-semibold text-zinc-600">
                              İstifadə olunub
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                              Stokda
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => deleteCode(c.id)}
                            disabled={c.isUsed}
                            title={c.isUsed ? "İstifadə olunmuş kod silinə bilməz" : "Sil"}
                            className="grid h-8 w-8 place-items-center rounded-lg bg-rose-500/10 text-rose-700 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
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
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-600">
        {label}
      </span>
      {children}
    </label>
  );
}
