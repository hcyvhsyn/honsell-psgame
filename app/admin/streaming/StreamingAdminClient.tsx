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

const SERVICES = [
  { value: "HBO_MAX", label: "HBO Max" },
  { value: "GAIN", label: "Gain" },
  { value: "YOUTUBE_PREMIUM", label: "YouTube Premium" },
];

const DURATIONS = [1, 2, 3, 6, 12];
const SEATS = [1, 2];

function readMeta(p: ServiceProduct) {
  const m = p.metadata ?? {};
  const opc = Number(m.originalPriceAznCents);
  return {
    service: String(m.service ?? ""),
    durationMonths: Number(m.durationMonths ?? 0),
    seats: Number(m.seats ?? 1),
    deliveryMode: String(m.deliveryMode ?? "CODE"),
    originalPriceAznCents: Number.isFinite(opc) && opc > 0 ? opc : null,
    inStock: m.inStock === undefined ? true : Boolean(m.inStock),
  };
}

function serviceLabel(s: string) {
  return SERVICES.find((x) => x.value === s)?.label ?? s;
}

export default function StreamingAdminClient() {
  const [products, setProducts] = useState<ServiceProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | "NEW" | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string | number | boolean>>({});

  type StockRow = { accountEmail: string; accountPassword: string; slotName: string; pinCode: string };
  const emptyRow = (): StockRow => ({ accountEmail: "", accountPassword: "", slotName: "", pinCode: "" });
  const [codesId, setCodesId] = useState<string | null>(null);
  const [stockRows, setStockRows] = useState<StockRow[]>([emptyRow()]);
  const [stockError, setStockError] = useState<string | null>(null);
  const [viewCodesId, setViewCodesId] = useState<string | null>(null);
  const [viewCodes, setViewCodes] = useState<
    {
      id: string;
      isUsed: boolean;
      createdAt: string;
      entry: StockRow | null;
      raw: string;
    }[]
  >([]);
  const [viewCodesLoading, setViewCodesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/streaming");
    if (res.ok) setProducts(await res.json());
    setLoading(false);
  }

  function handleEdit(p: ServiceProduct) {
    setSaveError(null);
    setEditingId(p.id);
    const m = readMeta(p);
    setEditForm({
      title: p.title,
      description: p.description ?? "",
      imageUrl: p.imageUrl ?? "",
      isActive: p.isActive,
      sortOrder: p.sortOrder,
      service: m.service || "HBO_MAX",
      durationMonths: m.durationMonths || 1,
      seats: m.seats || 1,
      priceAzn: (p.priceAznCents / 100).toFixed(2),
      originalPriceAzn: m.originalPriceAznCents != null ? (m.originalPriceAznCents / 100).toFixed(2) : "",
      inStock: m.inStock,
    });
  }

  function handleNew() {
    setSaveError(null);
    setEditingId("NEW");
    setEditForm({
      title: "",
      description: "",
      imageUrl: "",
      isActive: true,
      sortOrder: 0,
      service: "HBO_MAX",
      durationMonths: 1,
      seats: 1,
      priceAzn: "",
      originalPriceAzn: "",
      inStock: true,
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
      const priceAzn = Number(editForm.priceAzn);
      if (!Number.isFinite(priceAzn) || priceAzn <= 0) {
        setSaveError("Qiymət düzgün deyil!");
        return;
      }

      const service = String(editForm.service);
      const durationMonths = Number(editForm.durationMonths);
      const seats = service === "YOUTUBE_PREMIUM" ? 1 : Number(editForm.seats);
      const autoTitle =
        String(editForm.title).trim() ||
        `${serviceLabel(service)} ${durationMonths} ay${seats > 1 ? ` · ${seats} nəfərlik` : ""}`;

      const originalPriceAznRaw = String(editForm.originalPriceAzn ?? "").trim();
      const originalPriceAzn = originalPriceAznRaw === "" ? null : Number(originalPriceAznRaw);

      const res = await fetch("/api/admin/streaming", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPSERT_PRODUCT",
          id: editingId === "NEW" ? undefined : editingId,
          title: autoTitle,
          description: String(editForm.description ?? ""),
          imageUrl: String(editForm.imageUrl ?? ""),
          isActive: editForm.isActive,
          sortOrder: Number(editForm.sortOrder || 0),
          service,
          durationMonths,
          seats,
          priceAzn,
          originalPriceAzn,
          inStock: Boolean(editForm.inStock),
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
    setStockError(null);
    const cleaned = stockRows
      .map((r) => ({
        accountEmail: r.accountEmail.trim(),
        accountPassword: r.accountPassword,
        slotName: r.slotName.trim(),
        pinCode: r.pinCode.trim(),
      }))
      .filter((r) => r.accountEmail || r.accountPassword || r.slotName || r.pinCode);

    if (cleaned.length === 0) {
      setStockError("Ən azı bir sətir doldurun.");
      return;
    }
    const incomplete = cleaned.find((r) => !r.accountEmail || !r.accountPassword || !r.slotName);
    if (incomplete) {
      setStockError("Hər sətirdə email, şifrə və profil adı tələb olunur.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/streaming", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_CODES",
          serviceProductId: codesId,
          entries: cleaned,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStockError(`Yadda saxlanmadı: ${data.error ?? res.status}`);
        return;
      }
      setCodesId(null);
      setStockRows([emptyRow()]);
      load();
    } finally {
      setSaving(false);
    }
  }

  function openCodesUploader(productId: string) {
    setStockError(null);
    setStockRows([emptyRow()]);
    setCodesId(productId);
  }

  function updateStockRow(index: number, patch: Partial<StockRow>) {
    setStockRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  function addStockRow() {
    setStockRows((prev) => [...prev, emptyRow()]);
  }
  function removeStockRow(index: number) {
    setStockRows((prev) => (prev.length === 1 ? [emptyRow()] : prev.filter((_, i) => i !== index)));
  }

  async function openCodesView(productId: string) {
    setViewCodesId(productId);
    setViewCodesLoading(true);
    try {
      const res = await fetch(`/api/admin/streaming?codesFor=${encodeURIComponent(productId)}`);
      if (res.ok) setViewCodes(await res.json());
      else setViewCodes([]);
    } finally {
      setViewCodesLoading(false);
    }
  }

  async function deleteCode(codeId: string) {
    if (!confirm("Bu kodu silmək istədiyinə əminsən?")) return;
    const res = await fetch("/api/admin/streaming", {
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
    if (!confirm(`"${p.title}" məhsulunu silmək istədiyinə əminsən?`)) return;
    const res = await fetch("/api/admin/streaming", {
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

  const service = String(editForm.service ?? "HBO_MAX");
  const isYoutube = service === "YOUTUBE_PREMIUM";

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <button onClick={handleNew} className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400">
          <Plus className="h-4 w-4" /> Yeni paket
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-900/80 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-5 py-4 font-medium">Şəkil</th>
              <th className="px-5 py-4 font-medium">Xidmət</th>
              <th className="px-5 py-4 font-medium">Müddət</th>
              <th className="px-5 py-4 font-medium">Nəfər</th>
              <th className="px-5 py-4 font-medium">Çatdırılma</th>
              <th className="px-5 py-4 font-medium">Qiymət</th>
              <th className="px-5 py-4 font-medium">Stok</th>
              <th className="px-5 py-4 font-medium text-right">Əməliyyat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {products.map((p) => {
              const m = readMeta(p);
              return (
                <tr key={p.id} className="transition hover:bg-zinc-900">
                  <td className="px-5 py-4">
                    {p.imageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={p.imageUrl} alt={p.title} className="h-12 w-12 rounded object-cover" />
                    ) : (
                      <div className="h-12 w-12 rounded border border-dashed border-zinc-700 bg-zinc-900" />
                    )}
                  </td>
                  <td className="px-5 py-4 font-medium text-zinc-200">{serviceLabel(m.service)}</td>
                  <td className="px-5 py-4">{m.durationMonths} ay</td>
                  <td className="px-5 py-4">{m.seats} nəfərlik</td>
                  <td className="px-5 py-4">
                    {m.deliveryMode === "GMAIL" ? (
                      <span className="rounded bg-fuchsia-500/15 px-2 py-0.5 text-xs text-fuchsia-300">Gmail (manual)</span>
                    ) : (
                      <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">Kod (avto)</span>
                    )}
                  </td>
                  <td className="px-5 py-4 tabular-nums">{(p.priceAznCents / 100).toFixed(2)} AZN</td>
                  <td className="px-5 py-4">
                    {m.deliveryMode === "CODE" ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openCodesView(p.id)}
                          title="Kodlara bax"
                          className={`inline-flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700 ${p._count.codes > 0 ? "text-emerald-400" : "text-rose-400"}`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span className="font-bold">{p._count.codes} ədəd</span>
                        </button>
                        <button onClick={() => openCodesUploader(p.id)} className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700">
                          + Kod
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-500">—</span>
                    )}
                    {!p.isActive && <span className="ml-2 rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] text-rose-400">Passiv</span>}
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
              );
            })}
          </tbody>
        </table>
        {products.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-zinc-500">Hələ məhsul əlavə edilməyib.</div>
        )}
      </div>

      {/* Editor Modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <h3 className="mb-6 text-lg font-bold">Streaming paketi</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  Xidmət
                  <select
                    className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                    value={String(editForm.service)}
                    onChange={(e) => setEditForm({ ...editForm, service: e.target.value })}
                  >
                    {SERVICES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  Müddət (ay)
                  <select
                    className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                    value={Number(editForm.durationMonths)}
                    onChange={(e) => setEditForm({ ...editForm, durationMonths: Number(e.target.value) })}
                  >
                    {DURATIONS.map((d) => (
                      <option key={d} value={d}>{d} ay</option>
                    ))}
                  </select>
                </label>
              </div>

              {!isYoutube && (
                <label className="block text-sm">
                  Nəfər sayı
                  <select
                    className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                    value={Number(editForm.seats)}
                    onChange={(e) => setEditForm({ ...editForm, seats: Number(e.target.value) })}
                  >
                    {SEATS.map((s) => (
                      <option key={s} value={s}>{s} nəfərlik</option>
                    ))}
                  </select>
                </label>
              )}
              {isYoutube && (
                <p className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/5 px-3 py-2 text-xs text-fuchsia-200">
                  YouTube Premium yalnız müştərinin Gmail ünvanı ilə təhvil verilir (manual).
                </p>
              )}

              <label className="block text-sm">
                Başlıq (boşdursa avtomatik olar)
                <input
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                  value={String(editForm.title || "")}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  placeholder="Məs: HBO Max 3 ay · 2 nəfərlik"
                />
              </label>

              <label className="block text-sm">
                Təsvir
                <textarea
                  rows={2}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                  value={String(editForm.description || "")}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
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

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  Qiymət (AZN)
                  <input
                    type="number"
                    step="0.01"
                    className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                    value={String(editForm.priceAzn || "")}
                    onChange={(e) => setEditForm({ ...editForm, priceAzn: e.target.value })}
                  />
                </label>
                <label className="block text-sm">
                  Köhnə qiymət (boş = endirim yoxdur)
                  <input
                    type="number"
                    step="0.01"
                    placeholder="məs: 12.00"
                    className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                    value={String(editForm.originalPriceAzn ?? "")}
                    onChange={(e) => setEditForm({ ...editForm, originalPriceAzn: e.target.value })}
                  />
                </label>
              </div>

              <label className="block text-sm">
                Sıralama (0 ən öndə)
                <input
                  type="number"
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                  value={String(editForm.sortOrder || "0")}
                  onChange={(e) => setEditForm({ ...editForm, sortOrder: e.target.value })}
                />
              </label>

              <div className="flex items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={Boolean(editForm.isActive)} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })} /> Aktivdir
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(editForm.inStock)}
                    onChange={(e) => setEditForm({ ...editForm, inStock: e.target.checked })}
                  />{" "}
                  Stokda var
                </label>
              </div>
              <p className="text-[11px] leading-relaxed text-zinc-500">
                CODE çatdırılması (HBO Max / Gain) üçün hesab stoku da nəzərə alınır — kod azaldıqda avtomatik
                &laquo;Stokda yoxdur&raquo; görünəcək. GMAIL (YouTube) üçün bu toggle-dan istifadə olunur.
              </p>
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

      {/* Stock Uploader (structured) */}
      {codesId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <h3 className="mb-2 text-lg font-bold">Stok əlavə et</h3>
            <p className="mb-4 text-sm text-zinc-400">
              Hər sətir bir hesab. Müştəri alış edən kimi sıradakı məlumat ona email vasitəsi ilə göndəriləcək.
            </p>

            <div className="space-y-3">
              {stockRows.map((row, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 sm:grid-cols-[1fr_1fr_1fr_120px_auto]"
                >
                  <input
                    type="email"
                    placeholder="📧 mail@example.com"
                    value={row.accountEmail}
                    onChange={(e) => updateStockRow(idx, { accountEmail: e.target.value })}
                    className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
                  />
                  <input
                    type="text"
                    placeholder="🔑 şifrə"
                    value={row.accountPassword}
                    onChange={(e) => updateStockRow(idx, { accountPassword: e.target.value })}
                    className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-sm text-emerald-300"
                  />
                  <input
                    type="text"
                    placeholder="📺 Profil/kabinet adı"
                    value={row.slotName}
                    onChange={(e) => updateStockRow(idx, { slotName: e.target.value })}
                    className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
                  />
                  <input
                    type="text"
                    placeholder="🔢 PIN (boş ola bilər)"
                    value={row.pinCode}
                    onChange={(e) => updateStockRow(idx, { pinCode: e.target.value })}
                    className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-sm text-amber-300"
                  />
                  <button
                    type="button"
                    onClick={() => removeStockRow(idx)}
                    className="rounded p-2 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400"
                    title="Sətri sil"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addStockRow}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-400 hover:border-indigo-500 hover:text-indigo-400"
            >
              <Plus className="h-3.5 w-3.5" /> Yeni sətir
            </button>

            {stockError && (
              <div className="mt-3 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                {stockError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setCodesId(null)} className="rounded bg-zinc-800 px-4 py-2 text-sm text-zinc-300">İmtina</button>
              <button onClick={saveCodes} disabled={saving} className="rounded bg-emerald-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                {saving ? "Əlavə edilir..." : "Əlavə et"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Codes */}
      {viewCodesId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Stok</h3>
              <button onClick={() => setViewCodesId(null)} className="rounded p-1 text-zinc-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            {viewCodesLoading ? (
              <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo-500" /></div>
            ) : viewCodes.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">Stok əlavə edilməyib</p>
            ) : (
              <div className="max-h-96 overflow-y-auto rounded border border-zinc-800">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-zinc-900 text-xs uppercase text-zinc-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Email</th>
                      <th className="px-3 py-2 font-medium">Şifrə</th>
                      <th className="px-3 py-2 font-medium">Profil</th>
                      <th className="px-3 py-2 font-medium">PIN</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 text-right font-medium">Sil</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {viewCodes.map((c) => (
                      <tr key={c.id}>
                        {c.entry ? (
                          <>
                            <td className="px-3 py-2 font-mono text-[11px] text-emerald-300 break-all">{c.entry.accountEmail}</td>
                            <td className="px-3 py-2 font-mono text-[11px] text-emerald-300 break-all">{c.entry.accountPassword}</td>
                            <td className="px-3 py-2 text-xs text-zinc-200">{c.entry.slotName}</td>
                            <td className="px-3 py-2 font-mono text-xs text-amber-300">{c.entry.pinCode || "—"}</td>
                          </>
                        ) : (
                          <td className="px-3 py-2 font-mono text-[11px] text-zinc-400 break-all" colSpan={4}>
                            {c.raw}
                          </td>
                        )}
                        <td className="px-3 py-2 text-xs">
                          {c.isUsed ? (
                            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-400">Satılıb</span>
                          ) : (
                            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-emerald-400">Stokda</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => deleteCode(c.id)}
                            disabled={c.isUsed}
                            className="p-1 text-zinc-500 hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-30"
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
