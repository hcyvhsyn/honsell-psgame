"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadingServiceImage, setUploadingServiceImage] = useState<string | null>(null);
  const [savingServiceAccess, setSavingServiceAccess] = useState<string | null>(null);
  const serviceImageInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const serviceImageMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      const service = readMeta(p).service;
      if (service && p.imageUrl && !map.has(service)) map.set(service, p.imageUrl);
    }
    return map;
  }, [products]);

  const serviceAccessMap = useMemo(() => {
    const map = new Map<string, { devices: string[]; vpnRequired: boolean }>();
    for (const p of products) {
      const m = readMeta(p);
      if (!m.service) continue;
      const existing = map.get(m.service);
      map.set(m.service, {
        devices: existing?.devices.length ? existing.devices : m.devices,
        vpnRequired: Boolean(existing?.vpnRequired || m.vpnRequired),
      });
    }
    return map;
  }, [products]);

  const productCountByService = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      const service = readMeta(p).service;
      if (service) map.set(service, (map.get(service) ?? 0) + 1);
    }
    return map;
  }, [products]);

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
      isActive: p.isActive,
      sortOrder: p.sortOrder,
      service: m.service || "HBO_MAX",
      durationMonths: m.durationMonths || 1,
      seats: m.seats || 1,
      priceAzn: (p.priceAznCents / 100).toFixed(2),
      originalPriceAzn: m.originalPriceAznCents != null ? (m.originalPriceAznCents / 100).toFixed(2) : "",
    });
  }

  function handleNew() {
    setSaveError(null);
    setEditingId("NEW");
    setEditForm({
      title: "",
      description: "",
      isActive: true,
      sortOrder: 0,
      service: "HBO_MAX",
      durationMonths: 1,
      seats: 1,
      priceAzn: "",
      originalPriceAzn: "",
    });
  }

  async function uploadImageFile(file: File): Promise<string | null> {
    if (!file.type.startsWith("image/")) {
      alert("Yalnız şəkil faylı yükləyə bilərsiniz");
      return null;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Fayl çox böyükdür (max 5 MB)");
      return null;
    }

    const init = await fetch("/api/admin/services/image-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType: file.type }),
    });
    const initData = await init.json();
    if (!init.ok) {
      alert(initData.error ?? "Upload hazırlanmadı");
      return null;
    }

    const supabase = getSupabaseBrowser();
    const { error: upErr } = await supabase.storage
      .from(initData.bucket)
      .uploadToSignedUrl(initData.path, initData.token, file);
    if (upErr) {
      alert(`Upload alınmadı: ${upErr.message}`);
      return null;
    }

    return String(initData.publicUrl ?? "");
  }

  async function saveServiceImage(service: string, imageUrl: string) {
    const res = await fetch("/api/admin/streaming", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "SET_SERVICE_IMAGE",
        service,
        imageUrl,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(`Şəkil yadda saxlanmadı: ${data.error ?? res.status}`);
      return false;
    }
    await load();
    return true;
  }

  async function handleServiceImageUpload(service: string, file: File) {
    setUploadingServiceImage(service);
    try {
      const publicUrl = await uploadImageFile(file);
      if (!publicUrl) return;
      await saveServiceImage(service, publicUrl);
    } finally {
      setUploadingServiceImage(null);
    }
  }

  async function clearServiceImage(service: string) {
    if (!confirm(`${serviceLabel(service)} üçün platforma şəklini silmək istəyirsən?`)) return;
    setUploadingServiceImage(service);
    try {
      await saveServiceImage(service, "");
    } finally {
      setUploadingServiceImage(null);
    }
  }

  async function saveServiceAccess(
    service: string,
    access: { devices: string[]; vpnRequired: boolean },
  ) {
    setSavingServiceAccess(service);
    try {
      const res = await fetch("/api/admin/streaming", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SET_SERVICE_ACCESS",
          service,
          devices: access.devices,
          vpnRequired: access.vpnRequired,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(`Platforma məlumatı yadda saxlanmadı: ${data.error ?? res.status}`);
        return false;
      }
      await load();
      return true;
    } finally {
      setSavingServiceAccess(null);
    }
  }

  async function toggleServiceDevice(service: string, device: string) {
    const current = serviceAccessMap.get(service) ?? { devices: [], vpnRequired: false };
    const devices = current.devices.includes(device)
      ? current.devices.filter((d) => d !== device)
      : [...current.devices, device];
    await saveServiceAccess(service, { devices, vpnRequired: current.vpnRequired });
  }

  async function toggleServiceVpn(service: string, vpnRequired: boolean) {
    const current = serviceAccessMap.get(service) ?? { devices: [], vpnRequired: false };
    await saveServiceAccess(service, { devices: current.devices, vpnRequired });
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
          isActive: editForm.isActive,
          sortOrder: Number(editForm.sortOrder || 0),
          service,
          durationMonths,
          seats,
          priceAzn,
          originalPriceAzn,
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

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white">Platforma məlumatları</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Şəkil, izlənilə bilən cihazlar və VPN tələbi platforma üzrə saxlanır, bütün ay və nəfər paketlərində eyni işləyir.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {SERVICES.map((svc) => {
            const imageUrl = serviceImageMap.get(svc.value) ?? "";
            const access = serviceAccessMap.get(svc.value) ?? { devices: [], vpnRequired: false };
            const productCount = productCountByService.get(svc.value) ?? 0;
            const imageBusy = uploadingServiceImage === svc.value;
            const accessBusy = savingServiceAccess === svc.value;
            const disabled = productCount === 0;
            return (
              <div
                key={svc.value}
                className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3"
              >
                <div className="flex gap-3">
                  <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
                    {imageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={imageUrl} alt={svc.label} className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-zinc-600">
                        Şəkil yoxdur
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-zinc-100">{svc.label}</p>
                        <p className="mt-0.5 text-xs text-zinc-500">{productCount} paket</p>
                      </div>
                      {imageUrl && (
                        <button
                          type="button"
                          onClick={() => clearServiceImage(svc.value)}
                          disabled={imageBusy || disabled}
                          className="rounded p-1 text-zinc-500 transition hover:text-rose-400 disabled:opacity-50"
                          aria-label={`${svc.label} şəklini sil`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <input
                      ref={(node) => {
                        serviceImageInputRefs.current[svc.value] = node;
                      }}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleServiceImageUpload(svc.value, f);
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      disabled={imageBusy || disabled}
                      onClick={() => serviceImageInputRefs.current[svc.value]?.click()}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-400 transition hover:border-indigo-500 hover:text-indigo-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {imageBusy ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Yüklənir...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" /> {imageUrl ? "Şəkli dəyiş" : "Şəkil yüklə"}
                        </>
                      )}
                    </button>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Tövsiyə olunan ölçü: <b className="text-zinc-300">1200×900px</b> (4:3 aspekt) — streaming xidməti kartları public-də 4:3 nisbətdə render olunur.
                    </p>
                  </div>
                </div>

                <div className="mt-4 border-t border-zinc-800/80 pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      İzlənilə bilən cihazlar
                    </p>
                    {accessBusy && <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {DEVICES.map((d) => {
                      const checked = access.devices.includes(d.value);
                      return (
                        <label
                          key={d.value}
                          className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition ${
                            checked
                              ? "border-indigo-500/45 bg-indigo-500/10 text-indigo-200"
                              : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700"
                          } ${disabled || accessBusy ? "cursor-not-allowed opacity-60" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled || accessBusy}
                            onChange={() => toggleServiceDevice(svc.value, d.value)}
                            className="h-3.5 w-3.5"
                          />
                          {d.label}
                        </label>
                      );
                    })}
                  </div>
                  <label
                    className={`mt-2 flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-300 ${
                      disabled || accessBusy ? "cursor-not-allowed opacity-60" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={access.vpnRequired}
                      disabled={disabled || accessBusy}
                      onChange={(e) => toggleServiceVpn(svc.value, e.target.checked)}
                      className="h-3.5 w-3.5"
                    />
                    VPN-ə ehtiyac var
                  </label>
                  {disabled && (
                    <p className="mt-2 text-[11px] text-zinc-600">
                      Əvvəlcə bu platforma üçün paket yarat.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

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
