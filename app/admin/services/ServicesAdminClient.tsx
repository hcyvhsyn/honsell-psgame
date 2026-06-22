"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { uploadAdminImage } from "@/lib/uploadImageClient";
import { Loader2, Plus, Edit2, Upload, X, Trash2, Eye, TrendingDown } from "lucide-react";
import { useDialog } from "@/lib/dialogs";

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
  const dialog = useDialog();

  useEffect(() => {
    load();
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((s) => {
        setPricing({
          tryToAznRate: Number(s.tryToAznRate) || 0.053,
        });
      })
      .catch(() => {});
  }, []);

  function profitFromValues(
    tryAmount: number,
    aznPrice: number
  ): { value: string; positive: boolean | null } {
    if (
      !pricing ||
      !Number.isFinite(tryAmount) ||
      tryAmount <= 0 ||
      !Number.isFinite(aznPrice) ||
      aznPrice <= 0
    ) {
      return { value: "—", positive: null };
    }
    const cost = tryAmount * pricing.tryToAznRate;
    const profit = aznPrice - cost;
    return {
      value: (Math.round(profit * 100) / 100).toFixed(2),
      positive: profit >= 0,
    };
  }

  function computeProfit() {
    return profitFromValues(Number(editForm.tryAmount), Number(editForm.aznPrice));
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
      aznPrice: p.priceAznCents > 0 ? (p.priceAznCents / 100).toFixed(2) : "",
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
      aznPrice: "",
    });
  }

  async function handleImageUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      await dialog.alert({
        title: "Yalnız şəkil faylı qəbul edilir",
        message: "Şəkil formatında (PNG, JPG, WEBP) fayl seçin.",
        tone: "warning",
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      await dialog.alert({
        title: "Fayl ölçüsü çox böyükdür",
        message: "Maksimum 5 MB-lıq şəkil yükləyə bilərsiniz.",
        tone: "warning",
      });
      return;
    }
    setUploadingImage(true);
    try {
      const up = await uploadAdminImage("/api/admin/services/image-upload", file);
      if (!up.ok) {
        await dialog.alert({
          title: "Upload hazırlanmadı",
          message: up.error ?? "Bilinməyən xəta.",
          tone: "danger",
        });
        return;
      }
      setEditForm((prev) => ({ ...prev, imageUrl: up.url }));
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
      const aznPrice = Number(editForm.aznPrice);
      if (!Number.isFinite(aznPrice) || aznPrice <= 0) {
        setSaveError("AZN satış qiyməti düzgün deyil!");
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
          aznPrice,
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
    const ok = await dialog.confirm({
      title: "Kodu sil?",
      message: "Bu kod siyahıdan silinəcək.",
      confirmLabel: "Sil",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch("/api/admin/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DELETE_CODE", codeId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await dialog.alert({
        title: "Silinmədi",
        message: String(data.error ?? res.status),
        tone: "danger",
      });
      return;
    }
    if (viewCodesId) await openCodesView(viewCodesId);
    load();
  }

  async function deleteProduct(p: ServiceProduct) {
    const ok = await dialog.confirm({
      title: "Məhsulu sil?",
      message: (
        <p>
          <span className="font-medium text-zinc-800">«{p.title}»</span> məhsulu və bütün kodları silinəcək.
        </p>
      ),
      confirmLabel: "Sil",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch("/api/admin/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DELETE_PRODUCT", id: p.id }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await dialog.alert({
        title: "Silinmədi",
        message: String(data.error ?? res.status),
        tone: "danger",
      });
      return;
    }
    load();
  }

  const baselineAznPerTry = useMemo(() => {
    let max = 0;
    for (const p of products) {
      const t = Number((p.metadata as Record<string, unknown> | null)?.tryAmount);
      if (!Number.isFinite(t) || t <= 0) continue;
      const rate = p.priceAznCents / 100 / t;
      if (rate > max) max = rate;
    }
    return max;
  }, [products]);

  if (loading) return <div className="py-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-500" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <button onClick={handleNew} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">
          <Plus className="h-4 w-4" /> Yeni TRY Gift Card
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-admin-line bg-admin-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-admin-card text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-5 py-4 font-medium">Şəkil</th>
              <th className="px-5 py-4 font-medium">TRY</th>
              <th className="px-5 py-4 font-medium">Ad</th>
              <th className="px-5 py-4 font-medium">Qiymət</th>
              <th className="px-5 py-4 font-medium">Xeyir</th>
              <th className="px-5 py-4 font-medium">Sərfəli</th>
              <th className="px-5 py-4 font-medium">Stok / Kodlar</th>
              <th className="px-5 py-4 font-medium text-right">Əməliyyat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-line">
            {products.map((p) => {
              const tryAmount = Number(
                (p.metadata as Record<string, unknown> | null)?.tryAmount ?? 0
              );
              const aznPrice = p.priceAznCents / 100;
              const profit = profitFromValues(tryAmount, aznPrice);
              let savingsPct = 0;
              let savingsAzn = 0;
              if (baselineAznPerTry > 0 && tryAmount > 0) {
                const expected = baselineAznPerTry * tryAmount;
                savingsAzn = expected - aznPrice;
                savingsPct = (savingsAzn / expected) * 100;
              }
              return (
              <tr key={p.id} className="transition hover:bg-admin-chip">
                <td className="px-5 py-4">
                  {p.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={p.imageUrl} alt={p.title} className="h-12 w-12 rounded object-cover" />
                  ) : (
                    <div className="h-12 w-12 rounded border border-dashed border-admin-line2 bg-admin-card" />
                  )}
                </td>
                <td className="px-5 py-4 font-bold tabular-nums text-zinc-800">
                  {String((p.metadata as Record<string, unknown> | null)?.tryAmount ?? "—")} TRY
                </td>
                <td className="px-5 py-4 font-medium text-zinc-800">
                  {p.title}
                  {!p.isActive && <span className="ml-2 rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] text-rose-600">Passiv</span>}
                </td>
                <td className="px-5 py-4 tabular-nums">{aznPrice.toFixed(2)} AZN</td>
                <td className="px-5 py-4 tabular-nums">
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ring-1 ${
                      profit.positive === null
                        ? "bg-admin-chip text-zinc-600 ring-admin-line2"
                        : profit.positive
                          ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/30"
                          : "bg-rose-500/10 text-rose-700 ring-rose-500/30"
                    }`}
                  >
                    {profit.value} AZN
                  </span>
                </td>
                <td className="px-5 py-4 tabular-nums">
                  {savingsPct >= 1 ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="inline-flex w-fit items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-500/30">
                        <TrendingDown className="h-3 w-3" />
                        {Math.round(savingsPct)}%
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        {savingsAzn.toFixed(2)} AZN qənaət
                      </span>
                    </div>
                  ) : tryAmount > 0 ? (
                    <span className="text-xs text-zinc-600">baseline</span>
                  ) : (
                    <span className="text-xs text-zinc-600">—</span>
                  )}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openCodesView(p.id)}
                      title="Kodlara bax"
                      className={`inline-flex items-center gap-1 rounded-md bg-admin-chip px-2 py-1 text-xs hover:bg-admin-chip2 ${p._count.codes > 0 ? "text-emerald-600" : "text-rose-600"}`}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span className="font-bold">{p._count.codes} ədəd</span>
                    </button>
                    <button onClick={() => setCodesId(p.id)} className="rounded-md bg-admin-chip px-2 py-1 text-xs text-zinc-700 hover:bg-admin-chip2">
                      + Kod əlavə et
                    </button>
                  </div>
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="inline-flex items-center gap-1">
                    <button onClick={() => handleEdit(p)} title="Redaktə et" className="p-2 text-zinc-500 hover:text-violet-600">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => deleteProduct(p)} title="Sil" className="p-2 text-zinc-500 hover:text-rose-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Editor Modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-admin-line bg-admin-card p-6 shadow-2xl">
            <h3 className="mb-6 text-lg font-bold">TRY Gift Card</h3>
            <div className="space-y-4">
              <label className="block text-sm">
                Başlıq
                <input className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900" value={String(editForm.title || "")} onChange={(e) => setEditForm({...editForm, title: e.target.value})} />
              </label>
              <label className="block text-sm">
                Description
                <textarea
                  rows={3}
                  className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900"
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
                  <div className="mt-1 flex items-center gap-3 rounded border border-admin-line bg-admin-card p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={String(editForm.imageUrl)} alt="" className="h-16 w-16 rounded object-cover" />
                    <div className="flex-1 truncate text-xs text-zinc-600">{String(editForm.imageUrl)}</div>
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, imageUrl: "" })}
                      className="rounded p-1 text-zinc-500 hover:text-rose-600"
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
                    className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded border border-dashed border-admin-line2 bg-admin-card px-3 py-3 text-sm text-zinc-600 hover:border-violet-500 hover:text-violet-600 disabled:opacity-50"
                  >
                    {uploadingImage ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Yüklənir...</>
                    ) : (
                      <><Upload className="h-4 w-4" /> Şəkil seç (PNG/JPEG/WEBP, max 5 MB)</>
                    )}
                  </button>
                )}
                <p className="mt-1 text-[11px] text-zinc-500">
                  Tövsiyə olunan ölçü: <b className="text-zinc-700">1200×900px</b> (4:3 aspekt) — hədiyyə kart kartları public-də 4:3 nisbətdə göstərilir.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm">
                  TRY (maya)
                  <input
                    type="number"
                    step="0.01"
                    className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900"
                    value={String(editForm.tryAmount || "")}
                    onChange={(e) =>
                      setEditForm({ ...editForm, tryAmount: e.target.value })
                    }
                    placeholder="250"
                  />
                </label>
                <label className="block text-sm">
                  AZN (satış)
                  <input
                    type="number"
                    step="0.01"
                    className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900"
                    value={String(editForm.aznPrice || "")}
                    onChange={(e) =>
                      setEditForm({ ...editForm, aznPrice: e.target.value })
                    }
                    placeholder="məs: 14.99"
                  />
                </label>
              </div>
              {(() => {
                const profit = computeProfit();
                return (
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
                );
              })()}
              <label className="block text-sm">
                Sıralama (0 ən öndə)
                <input type="number" className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900" value={String(editForm.sortOrder || "0")} onChange={(e) => setEditForm({...editForm, sortOrder: e.target.value})} />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={Boolean(editForm.isActive)} onChange={(e) => setEditForm({...editForm, isActive: e.target.checked})} /> Aktivdir
              </label>
            </div>
            {saveError && (
              <div className="mt-4 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">
                {saveError}
              </div>
            )}
            <div className="mt-8 flex justify-end gap-3">
              <button onClick={() => { setEditingId(null); setSaveError(null); }} className="rounded bg-admin-chip px-4 py-2 text-sm text-zinc-700">İmtina</button>
              <button onClick={saveProduct} disabled={saving} className="rounded bg-violet-600 px-4 py-2 text-sm font-bold text-white">Yadda saxla</button>
            </div>
          </div>
        </div>
      )}

      {/* Code Uploader Modal */}
      {codesId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-admin-line bg-admin-card p-6 shadow-2xl">
            <h3 className="mb-2 text-lg font-bold">Kodları yüklə (TRY Balans)</h3>
            <p className="mb-6 text-sm text-zinc-600">Hər sətirə bir kod (e-pin) yazın. Boş sətirlər silinəcək.</p>
            <textarea
              rows={10}
              className="w-full rounded border border-admin-line bg-admin-card px-3 py-2 font-mono text-sm text-emerald-700 focus:border-emerald-500 focus:outline-none"
              placeholder="XXXX-YYYY-ZZZZ&#10;AAAA-BBBB-CCCC"
              value={codesText}
              onChange={(e) => setCodesText(e.target.value)}
            />
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setCodesId(null)} className="rounded bg-admin-chip px-4 py-2 text-sm text-zinc-700">İmtina</button>
              <button onClick={saveCodes} disabled={saving || !codesText.trim()} className="rounded bg-emerald-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Əlavə et</button>
            </div>
          </div>
        </div>
      )}

      {/* View Codes Modal */}
      {viewCodesId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-admin-line bg-admin-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Kodlar</h3>
              <button onClick={() => setViewCodesId(null)} className="rounded p-1 text-zinc-500 hover:text-zinc-900">
                <X className="h-5 w-5" />
              </button>
            </div>
            {viewCodesLoading ? (
              <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-violet-500" /></div>
            ) : viewCodes.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">Kod əlavə edilməyib</p>
            ) : (
              <div className="max-h-96 overflow-y-auto rounded border border-admin-line">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-admin-card text-xs uppercase text-zinc-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Kod</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 text-right font-medium">Sil</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-admin-line">
                    {viewCodes.map((c) => (
                      <tr key={c.id}>
                        <td className="px-3 py-2 font-mono text-xs text-emerald-700">{c.code}</td>
                        <td className="px-3 py-2 text-xs">
                          {c.isUsed ? (
                            <span className="rounded bg-admin-chip px-1.5 py-0.5 text-zinc-600">İstifadə olunub</span>
                          ) : (
                            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-emerald-600">Stokda</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => deleteCode(c.id)}
                            disabled={c.isUsed}
                            title={c.isUsed ? "İstifadə olunmuş kod silinə bilməz" : "Sil"}
                            className="p-1 text-zinc-500 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-zinc-500"
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
              <button onClick={() => setViewCodesId(null)} className="rounded bg-admin-chip px-4 py-2 text-sm text-zinc-700">Bağla</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
