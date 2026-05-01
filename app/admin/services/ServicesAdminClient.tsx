"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, Edit2, Upload, X, Trash2, Eye } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type ServiceProduct = {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  priceAznCents: number;
  metadata: Record<string, unknown> | null;
  isActive: boolean;
  sortOrder: number;
  _count: { codes: number };
};

export default function ServicesAdminClient() {
  const [products, setProducts] = useState<ServiceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [pricing, setPricing] = useState<{
    tryToAznRate: number;
    profitMarginGiftCardsPct: number;
  } | null>(null);

  const [editingId, setEditingId] = useState<string | "NEW" | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string | number | boolean>>({});
  
  const [codesId, setCodesId] = useState<string | null>(null);
  const [codesText, setCodesText] = useState("");
  const [viewCodesId, setViewCodesId] = useState<string | null>(null);
  const [viewCodes, setViewCodes] = useState<{ id: string; code: string; isUsed: boolean; createdAt: string }[]>([]);
  const [viewCodesLoading, setViewCodesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load();
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((s) => {
        setPricing({
          tryToAznRate: Number(s.tryToAznRate) || 0.053,
          profitMarginGiftCardsPct:
            Number(s.profitMarginGiftCardsPct ?? s.profitMarginPct) || 20,
        });
      })
      .catch(() => {});
  }, []);

  function computedAzn(nextTryAmount?: string | number): string {
    const raw = nextTryAmount ?? editForm.tryAmount;
    const tryAmount = Number(raw);
    if (!pricing || !Number.isFinite(tryAmount) || tryAmount <= 0) return "—";
    const azn =
      tryAmount *
      pricing.tryToAznRate *
      (1 + pricing.profitMarginGiftCardsPct / 100);
    return (Math.round(azn * 100) / 100).toFixed(2);
  }

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/services");
    if (res.ok) setProducts(await res.json());
    setLoading(false);
  }

  function handleEdit(p: ServiceProduct) {
    setSaveError(null);
    setEditingId(p.id);
    setEditForm({
      title: p.title,
      description: p.description ?? "",
      imageUrl: p.imageUrl ?? "",
      isActive: p.isActive,
      sortOrder: p.sortOrder,
      tryAmount: String((p.metadata as Record<string, unknown> | null)?.tryAmount ?? ""),
    });
  }

  function handleNew() {
    setSaveError(null);
    setEditingId("NEW");
    setEditForm({
      title: "Yeni TRY Gift Card",
      description: "",
      imageUrl: "",
      isActive: true,
      sortOrder: 0,
      tryAmount: "250",
    });
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
      const init = await fetch("/api/admin/services/image-upload", {
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
      setEditForm((prev) => ({ ...prev, imageUrl: initData.publicUrl }));
    } finally {
      setUploadingImage(false);
    }
  }

  async function saveProduct() {
    setSaving(true);
    setSaveError(null);
    try {
      const tryAmount = Number(editForm.tryAmount);
      if (!Number.isFinite(tryAmount) || tryAmount <= 0) {
        setSaveError("TRY məbləği düzgün deyil!");
        return;
      }

      const res = await fetch("/api/admin/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPSERT_PRODUCT",
          id: editingId === "NEW" ? undefined : editingId,
          type: "TRY_BALANCE",
          title: editForm.title,
          description: String(editForm.description ?? ""),
          imageUrl: String(editForm.imageUrl ?? ""),
          isActive: editForm.isActive,
          sortOrder: Number(editForm.sortOrder || 0),
          metadata: { tryAmount },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(`Yadda saxlanmadı: ${data.error ?? res.status}`);
        return;
      }
      setEditingId(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function saveCodes() {
    setSaving(true);
    try {
      await fetch("/api/admin/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_CODES",
          serviceProductId: codesId,
          codesText,
        }),
      });
      setCodesId(null);
      setCodesText("");
      load();
    } finally {
      setSaving(false);
    }
  }

  async function openCodesView(productId: string) {
    setViewCodesId(productId);
    setViewCodesLoading(true);
    try {
      const res = await fetch(`/api/admin/services?codesFor=${encodeURIComponent(productId)}`);
      if (res.ok) setViewCodes(await res.json());
      else setViewCodes([]);
    } finally {
      setViewCodesLoading(false);
    }
  }

  async function deleteCode(codeId: string) {
    if (!confirm("Bu kodu silmək istədiyinə əminsən?")) return;
    const res = await fetch("/api/admin/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DELETE_CODE", codeId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(`Silinmədi: ${data.error ?? res.status}`);
      return;
    }
    if (viewCodesId) await openCodesView(viewCodesId);
    load();
  }

  async function deleteProduct(p: ServiceProduct) {
    if (!confirm(`"${p.title}" məhsulunu silmək istədiyinə əminsən? Bütün kodları da silinəcək.`)) return;
    const res = await fetch("/api/admin/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DELETE_PRODUCT", id: p.id }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(`Silinmədi: ${data.error ?? res.status}`);
      return;
    }
    load();
  }

  if (loading) return <div className="py-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <button onClick={handleNew} className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400">
          <Plus className="h-4 w-4" /> Yeni TRY Gift Card
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-900/80 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-5 py-4 font-medium">Şəkil</th>
              <th className="px-5 py-4 font-medium">TRY</th>
              <th className="px-5 py-4 font-medium">Ad</th>
              <th className="px-5 py-4 font-medium">Qiymət</th>
              <th className="px-5 py-4 font-medium">Stok / Kodlar</th>
              <th className="px-5 py-4 font-medium text-right">Əməliyyat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {products.map((p) => (
              <tr key={p.id} className="transition hover:bg-zinc-900">
                <td className="px-5 py-4">
                  {p.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={p.imageUrl} alt={p.title} className="h-12 w-12 rounded object-cover" />
                  ) : (
                    <div className="h-12 w-12 rounded border border-dashed border-zinc-700 bg-zinc-900" />
                  )}
                </td>
                <td className="px-5 py-4 font-bold tabular-nums text-zinc-200">
                  {String((p.metadata as Record<string, unknown> | null)?.tryAmount ?? "—")} TRY
                </td>
                <td className="px-5 py-4 font-medium text-zinc-200">
                  {p.title}
                  {!p.isActive && <span className="ml-2 rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] text-rose-400">Passiv</span>}
                </td>
                <td className="px-5 py-4">{(p.priceAznCents / 100).toFixed(2)} AZN</td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openCodesView(p.id)}
                      title="Kodlara bax"
                      className={`inline-flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700 ${p._count.codes > 0 ? "text-emerald-400" : "text-rose-400"}`}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span className="font-bold">{p._count.codes} ədəd</span>
                    </button>
                    <button onClick={() => setCodesId(p.id)} className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700">
                      + Kod əlavə et
                    </button>
                  </div>
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="inline-flex items-center gap-1">
                    <button onClick={() => handleEdit(p)} title="Redaktə et" className="p-2 text-zinc-500 hover:text-indigo-400">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => deleteProduct(p)} title="Sil" className="p-2 text-zinc-500 hover:text-rose-400">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Editor Modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <h3 className="mb-6 text-lg font-bold">TRY Gift Card</h3>
            <div className="space-y-4">
              <label className="block text-sm">
                Başlıq
                <input className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white" value={String(editForm.title || "")} onChange={(e) => setEditForm({...editForm, title: e.target.value})} />
              </label>
              <label className="block text-sm">
                Description
                <textarea
                  rows={3}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                  value={String(editForm.description || "")}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="Qısa izah (məs: Türkiyə PS Store hədiyyə kartı)"
                />
              </label>
              <div className="block text-sm">
                <span>Şəkil</span>
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
                {editForm.imageUrl ? (
                  <div className="mt-1 flex items-center gap-3 rounded border border-zinc-800 bg-zinc-900 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={String(editForm.imageUrl)} alt="" className="h-16 w-16 rounded object-cover" />
                    <div className="flex-1 truncate text-xs text-zinc-400">{String(editForm.imageUrl)}</div>
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, imageUrl: "" })}
                      className="rounded p-1 text-zinc-500 hover:text-rose-400"
                      aria-label="Şəkli sil"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={uploadingImage}
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded border border-dashed border-zinc-700 bg-zinc-900 px-3 py-3 text-sm text-zinc-400 hover:border-indigo-500 hover:text-indigo-400 disabled:opacity-50"
                  >
                    {uploadingImage ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Yüklənir...</>
                    ) : (
                      <><Upload className="h-4 w-4" /> Şəkil seç (PNG/JPEG/WEBP, max 5 MB)</>
                    )}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm">
                  TRY qiyməti
                  <input
                    type="number"
                    className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                    value={String(editForm.tryAmount || "")}
                    onChange={(e) =>
                      setEditForm({ ...editForm, tryAmount: e.target.value })
                    }
                    placeholder="250"
                  />
                </label>
                <label className="block text-sm">
                  Qiymət (AZN)
                  <input
                    type="text"
                    readOnly
                    className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                    value={computedAzn()}
                  />
                </label>
              </div>
              <label className="block text-sm">
                Sıralama (0 ən öndə)
                <input type="number" className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white" value={String(editForm.sortOrder || "0")} onChange={(e) => setEditForm({...editForm, sortOrder: e.target.value})} />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={Boolean(editForm.isActive)} onChange={(e) => setEditForm({...editForm, isActive: e.target.checked})} /> Aktivdir
              </label>
            </div>
            {saveError && (
              <div className="mt-4 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                {saveError}
              </div>
            )}
            <div className="mt-8 flex justify-end gap-3">
              <button onClick={() => { setEditingId(null); setSaveError(null); }} className="rounded bg-zinc-800 px-4 py-2 text-sm text-zinc-300">İmtina</button>
              <button onClick={saveProduct} disabled={saving} className="rounded bg-indigo-500 px-4 py-2 text-sm font-bold text-white">Yadda saxla</button>
            </div>
          </div>
        </div>
      )}

      {/* Code Uploader Modal */}
      {codesId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <h3 className="mb-2 text-lg font-bold">Kodları yüklə (TRY Balans)</h3>
            <p className="mb-6 text-sm text-zinc-400">Hər sətirə bir kod (e-pin) yazın. Boş sətirlər silinəcək.</p>
            <textarea
              rows={10}
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-sm text-emerald-300 focus:border-emerald-500 focus:outline-none"
              placeholder="XXXX-YYYY-ZZZZ&#10;AAAA-BBBB-CCCC"
              value={codesText}
              onChange={(e) => setCodesText(e.target.value)}
            />
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setCodesId(null)} className="rounded bg-zinc-800 px-4 py-2 text-sm text-zinc-300">İmtina</button>
              <button onClick={saveCodes} disabled={saving || !codesText.trim()} className="rounded bg-emerald-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Əlavə et</button>
            </div>
          </div>
        </div>
      )}

      {/* View Codes Modal */}
      {viewCodesId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Kodlar</h3>
              <button onClick={() => setViewCodesId(null)} className="rounded p-1 text-zinc-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            {viewCodesLoading ? (
              <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo-500" /></div>
            ) : viewCodes.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">Kod əlavə edilməyib</p>
            ) : (
              <div className="max-h-96 overflow-y-auto rounded border border-zinc-800">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-zinc-900 text-xs uppercase text-zinc-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Kod</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 text-right font-medium">Sil</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {viewCodes.map((c) => (
                      <tr key={c.id}>
                        <td className="px-3 py-2 font-mono text-xs text-emerald-300">{c.code}</td>
                        <td className="px-3 py-2 text-xs">
                          {c.isUsed ? (
                            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-400">İstifadə olunub</span>
                          ) : (
                            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-emerald-400">Stokda</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => deleteCode(c.id)}
                            disabled={c.isUsed}
                            title={c.isUsed ? "İstifadə olunmuş kod silinə bilməz" : "Sil"}
                            className="p-1 text-zinc-500 hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-zinc-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <button onClick={() => setViewCodesId(null)} className="rounded bg-zinc-800 px-4 py-2 text-sm text-zinc-300">Bağla</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
