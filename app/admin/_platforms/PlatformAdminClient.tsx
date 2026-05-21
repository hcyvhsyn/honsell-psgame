"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, Plus, Edit2, Upload, X, Trash2 } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import {
  PLATFORM_CATEGORY_LABELS,
  AI_BRANDS,
  AI_BRAND_LABELS,
  MUSIC_BRANDS,
  MUSIC_BRAND_LABELS,
  WORK_PLAN_TYPES,
  WORK_PLAN_TYPE_LABELS,
  readPlatformMeta,
  type PlatformCategory,
} from "@/lib/platformSubscriptions";
import { useDialog } from "@/lib/dialogs";

type Product = {
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

export default function PlatformAdminClient({ category }: { category: PlatformCategory }) {
  const dialog = useDialog();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | "NEW" | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string | number | boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/platforms?category=${category}`, { cache: "no-store" });
    if (res.ok) setProducts(await res.json());
    setLoading(false);
  }, [category]);

  useEffect(() => {
    load();
  }, [load]);

  function handleEdit(p: Product) {
    setSaveError(null);
    setEditingId(p.id);
    const m = readPlatformMeta(p.metadata);
    setEditForm({
      title: p.title,
      description: p.description ?? "",
      imageUrl: p.imageUrl ?? "",
      isActive: p.isActive,
      sortOrder: p.sortOrder,
      priceAzn: (p.priceAznCents / 100).toFixed(2),
      originalPriceAzn: m.originalPriceAznCents != null ? (m.originalPriceAznCents / 100).toFixed(2) : "",
      durationMonths: m.durationMonths ?? "",
      terms: m.terms ?? "",
      aiBrand: m.aiBrand ?? (category === "AI" ? "CLAUDE" : ""),
      musicBrand: m.musicBrand ?? (category === "MUSIC" ? "GENERIC" : ""),
      planType: m.planType ?? "",
      isPopular: Boolean(m.isPopular),
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
      sortOrder: products.length,
      priceAzn: "",
      originalPriceAzn: "",
      durationMonths: "",
      terms: "",
      aiBrand: category === "AI" ? "CLAUDE" : "",
      musicBrand: category === "MUSIC" ? "GENERIC" : "",
      planType: "",
      isPopular: false,
    });
  }

  async function handleImageUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      await dialog.alert({ title: "Yanlış fayl tipi", message: "Yalnız şəkil faylı yükləyə bilərsiniz", tone: "warning" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      await dialog.alert({ title: "Fayl ölçüsü çox böyükdür", message: "Fayl çox böyükdür (max 5 MB)", tone: "warning" });
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
      const originalPriceAznRaw = String(editForm.originalPriceAzn ?? "").trim();
      const originalPriceAzn = originalPriceAznRaw === "" ? null : Number(originalPriceAznRaw);
      const durationMonthsRaw = String(editForm.durationMonths ?? "").trim();
      const durationMonths = durationMonthsRaw === "" ? null : Number(durationMonthsRaw);

      const res = await fetch("/api/admin/platforms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPSERT",
          id: editingId === "NEW" ? undefined : editingId,
          category,
          title: String(editForm.title).trim(),
          description: String(editForm.description ?? ""),
          imageUrl: String(editForm.imageUrl ?? ""),
          isActive: editForm.isActive,
          sortOrder: Number(editForm.sortOrder || 0),
          priceAzn,
          originalPriceAzn,
          durationMonths,
          terms: String(editForm.terms ?? ""),
          aiBrand: category === "AI" ? String(editForm.aiBrand ?? "") : undefined,
          musicBrand: category === "MUSIC" ? String(editForm.musicBrand ?? "") : undefined,
          planType: category === "WORK" ? String(editForm.planType ?? "") : undefined,
          isPopular: category === "WORK" ? Boolean(editForm.isPopular) : undefined,
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

  async function deleteProduct(p: Product) {
    if (
      !(await dialog.confirm({
        title: "Məhsulu sil?",
        message: <p>«{p.title}» məhsulu silinsin?</p>,
        confirmLabel: "Sil",
        tone: "danger",
      }))
    )
      return;
    const res = await fetch("/api/admin/platforms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DELETE", id: p.id }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await dialog.alert({ title: "Silinmədi", message: String(data.error ?? res.status), tone: "danger" });
      return;
    }
    load();
  }

  if (loading) return <div className="py-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{PLATFORM_CATEGORY_LABELS[category]}</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Hər platforma elementi bir abunə paketidir. Müştəri sifariş yaradanda statusu{" "}
            <span className="text-amber-300">Gözləmədə</span> olur — admin sifarişə əl ilə hesab
            məlumatlarını verəndə müştəriyə email göndərilir və profil panelində görünür.
          </p>
        </div>
        <button onClick={handleNew} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400">
          <Plus className="h-4 w-4" /> Yeni paket
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-900/80 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-5 py-4 font-medium">Şəkil</th>
              <th className="px-5 py-4 font-medium">Başlıq</th>
              {(category === "AI" || category === "MUSIC") && (
                <th className="px-5 py-4 font-medium">Brend</th>
              )}
              {category === "WORK" && (
                <th className="px-5 py-4 font-medium">Plan</th>
              )}
              <th className="px-5 py-4 font-medium">Qiymət</th>
              <th className="px-5 py-4 font-medium">Müddət</th>
              <th className="px-5 py-4 font-medium">Status</th>
              <th className="px-5 py-4 font-medium text-right">Əməliyyat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {products.map((p) => {
              const meta = readPlatformMeta(p.metadata);
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
                <td className="px-5 py-4 font-medium text-zinc-200">{p.title}</td>
                {category === "AI" && (
                  <td className="px-5 py-4 text-zinc-300">
                    {meta.aiBrand ? AI_BRAND_LABELS[meta.aiBrand] : "—"}
                  </td>
                )}
                {category === "MUSIC" && (
                  <td className="px-5 py-4 text-zinc-300">
                    {meta.musicBrand ? MUSIC_BRAND_LABELS[meta.musicBrand] : "Ümumi"}
                  </td>
                )}
                {category === "WORK" && (
                  <td className="px-5 py-4 text-zinc-300">
                    <div className="flex items-center gap-2">
                      <span>
                        {meta.planType ? WORK_PLAN_TYPE_LABELS[meta.planType] : "—"}
                      </span>
                      {meta.isPopular && (
                        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                          Populyar
                        </span>
                      )}
                    </div>
                  </td>
                )}
                <td className="px-5 py-4 tabular-nums">{(p.priceAznCents / 100).toFixed(2)} AZN</td>
                <td className="px-5 py-4 text-zinc-300">
                  {meta.durationMonths
                    ? `${meta.durationMonths} ay`
                    : "—"}
                </td>
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

      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <h3 className="mb-6 text-lg font-bold">{PLATFORM_CATEGORY_LABELS[category]} paketi</h3>
            <div className="space-y-4">
              <label className="block text-sm">
                Başlıq
                <input
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                  value={String(editForm.title || "")}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  placeholder="Spotify Premium"
                />
              </label>

              {category === "AI" && (
                <label className="block text-sm">
                  Brend
                  <select
                    className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                    value={String(editForm.aiBrand || "CLAUDE")}
                    onChange={(e) => setEditForm({ ...editForm, aiBrand: e.target.value })}
                  >
                    {AI_BRANDS.map((b) => (
                      <option key={b} value={b}>{AI_BRAND_LABELS[b]}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Brend seçimi paketin hansı alt-səhifədə görünəcəyini təyin edir
                    (/ai/claude, /ai/chatgpt). &laquo;Digər&raquo; seçimi yalnız /ai əsas səhifəsində qalır.
                  </p>
                </label>
              )}

              {category === "MUSIC" && (
                <label className="block text-sm">
                  Brend
                  <select
                    className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                    value={String(editForm.musicBrand || "GENERIC")}
                    onChange={(e) => setEditForm({ ...editForm, musicBrand: e.target.value })}
                  >
                    {MUSIC_BRANDS.map((b) => (
                      <option key={b} value={b}>{MUSIC_BRAND_LABELS[b]}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    &laquo;YouTube Premium&raquo; seçilirsə paket /music/youtube səhifəsində görünür.
                    &laquo;Ümumi&raquo; seçimi /music əsas siyahısında qalır (Spotify, Apple Music və s.).
                  </p>
                </label>
              )}

              {category === "WORK" && (
                <>
                  <label className="block text-sm">
                    Plan tipi (LinkedIn Premium üçün)
                    <select
                      className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                      value={String(editForm.planType || "")}
                      onChange={(e) => setEditForm({ ...editForm, planType: e.target.value })}
                    >
                      <option value="">— Seçilməyib (digər iş alətləri) —</option>
                      {WORK_PLAN_TYPES.map((t) => (
                        <option key={t} value={t}>{WORK_PLAN_TYPE_LABELS[t]}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Career / Business seçilirsə paket /work/linkedin-premium səhifəsində uyğun
                      qrupda görünür. Boş qalırsa yalnız /work əsas siyahısında qalır.
                    </p>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(editForm.isPopular)}
                      onChange={(e) => setEditForm({ ...editForm, isPopular: e.target.checked })}
                    />
                    Populyar — &laquo;Populyar&raquo; rozetkası ilə qabardılır
                  </label>
                </>
              )}

              <label className="block text-sm">
                Açıqlama / Mətn
                <textarea
                  rows={3}
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
                <p className="mt-1 text-[11px] text-zinc-500">
                  Tövsiyə olunan ölçü: <b className="text-zinc-300">1200×900px</b> (4:3 aspekt) — platforma kartları public-də 4:3 nisbətdə render olunur.
                </p>
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
                  Köhnə qiymət (opsional)
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
                Müddət (ay)
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="məs: 1"
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                  value={String(editForm.durationMonths ?? "")}
                  onChange={(e) => setEditForm({ ...editForm, durationMonths: e.target.value })}
                />
              </label>

              <label className="block text-sm">
                Şərtlər (opsional)
                <textarea
                  rows={3}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                  value={String(editForm.terms || "")}
                  onChange={(e) => setEditForm({ ...editForm, terms: e.target.value })}
                  placeholder="İstifadə şərtləri, məhdudiyyətlər və s."
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  Sıralama (0 ən öndə)
                  <input
                    type="number"
                    className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                    value={String(editForm.sortOrder || "0")}
                    onChange={(e) => setEditForm({ ...editForm, sortOrder: e.target.value })}
                  />
                </label>
                <label className="flex items-end gap-2 pb-2 text-sm">
                  <input type="checkbox" checked={Boolean(editForm.isActive)} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })} /> Aktivdir
                </label>
              </div>
            </div>
            {saveError && (
              <div className="mt-4 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                {saveError}
              </div>
            )}
            <div className="mt-8 flex justify-end gap-3">
              <button onClick={() => { setEditingId(null); setSaveError(null); }} className="rounded bg-zinc-800 px-4 py-2 text-sm text-zinc-300">İmtina</button>
              <button onClick={saveProduct} disabled={saving} className="rounded bg-indigo-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                {saving ? "Yadda saxlanılır..." : "Yadda saxla"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
