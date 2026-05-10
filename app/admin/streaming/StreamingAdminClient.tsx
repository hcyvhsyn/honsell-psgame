"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, Edit2, Upload, X, Trash2 } from "lucide-react";
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
};

const DURATIONS = [1, 2, 3, 6, 12];
const SEATS = [1, 2];

const SERVICES = [
  { value: "HBO_MAX", label: "HBO Max" },
  { value: "GAIN", label: "Gain" },
  { value: "TABII", label: "Tabii" },
  { value: "NETFLIX", label: "Netflix" },
  { value: "PRIME_VIDEO", label: "Prime Video" },
  { value: "DISNEY_PLUS", label: "Disney+" },
];

const DEVICES = [
  { value: "computer", label: "Kompüter" },
  { value: "tv", label: "Televizor" },
  { value: "phone", label: "Telefon" },
  { value: "tablet", label: "Planşet" },
];

function serviceLabel(s: string) {
  return SERVICES.find((x) => x.value === s)?.label ?? s;
}

function deviceLabel(s: string) {
  return DEVICES.find((d) => d.value === s)?.label ?? s;
}

function readMeta(p: ServiceProduct) {
  const m = p.metadata ?? {};
  const opc = Number(m.originalPriceAznCents);
  const rawDevices = Array.isArray(m.devices) ? (m.devices as unknown[]) : [];
  return {
    service: String(m.service ?? ""),
    durationMonths: Number(m.durationMonths ?? 0),
    seats: Number(m.seats ?? 1),
    originalPriceAznCents: Number.isFinite(opc) && opc > 0 ? opc : null,
    devices: rawDevices.filter((x): x is string => typeof x === "string"),
    vpnRequired: Boolean(m.vpnRequired),
  };
}

export default function StreamingAdminClient() {
  const [products, setProducts] = useState<ServiceProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | "NEW" | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string | number | boolean>>({});
  const [editDevices, setEditDevices] = useState<string[]>([]);

  function toggleDevice(value: string) {
    setEditDevices((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/streaming", { cache: "no-store" });
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
      vpnRequired: m.vpnRequired,
    });
    setEditDevices(m.devices);
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
      vpnRequired: false,
    });
    setEditDevices([]);
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

      const service = String(editForm.service).trim();
      if (!service) {
        setSaveError("Xidmət adı tələb olunur!");
        return;
      }
      const durationMonths = Number(editForm.durationMonths);
      const seats = Number(editForm.seats);
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
          devices: editDevices,
          vpnRequired: Boolean(editForm.vpnRequired),
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

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <p className="max-w-2xl text-xs text-zinc-500">
          Müştəri sifariş yaradanda statusu <span className="text-amber-300">Gözləmədə</span> olur.
          Hesab məlumatları &laquo;Sifarişlər&raquo; bölməsindən sifarişin təsdiqi zamanı əl ilə daxil edilir.
        </p>
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
              <th className="px-5 py-4 font-medium">Qiymət</th>
              <th className="px-5 py-4 font-medium">Status</th>
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
                  <td className="px-5 py-4 tabular-nums">{(p.priceAznCents / 100).toFixed(2)} AZN</td>
                  <td className="px-5 py-4">
                    {p.isActive ? (
                      <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">Aktiv</span>
                    ) : (
                      <span className="rounded bg-rose-500/20 px-2 py-0.5 text-xs text-rose-400">Passiv</span>
                    )}
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
                    value={String(editForm.service ?? "HBO_MAX")}
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

              <fieldset className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  İzlənilə bilən cihazlar
                </legend>
                <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {DEVICES.map((d) => {
                    const checked = editDevices.includes(d.value);
                    return (
                      <label
                        key={d.value}
                        className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
                          checked
                            ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-200"
                            : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleDevice(d.value)}
                          className="h-4 w-4"
                        />
                        {d.label}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <label className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(editForm.vpnRequired)}
                  onChange={(e) => setEditForm({ ...editForm, vpnRequired: e.target.checked })}
                />
                VPN-ə ehtiyac var
              </label>

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

              <label className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-sm">
                <input type="checkbox" checked={Boolean(editForm.isActive)} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })} /> Aktivdir
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
    </div>
  );
}
