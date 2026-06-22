"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { uploadAdminImage } from "@/lib/uploadImageClient";
import {
  CheckCircle2,
  Edit2,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useDialog } from "@/lib/dialogs";
import { PRODUCT_CATEGORY_KEYS } from "@/lib/categoryAssets";

const NEW_CATEGORY_SENTINEL = "__new__";

function slugifyKey(label: string): string {
  return label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

type CategoryAsset = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  href: string;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
};

type EditForm = {
  key: string;
  label: string;
  description: string;
  href: string;
  imageUrl: string;
  isActive: boolean;
  sortOrder: string;
};

function emptyForm(): EditForm {
  return {
    key: "",
    label: "",
    description: "",
    href: "",
    imageUrl: "",
    isActive: true,
    sortOrder: "0",
  };
}

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Şəkil ölçüsü oxunmadı."));
    };
    image.src = objectUrl;
  });
}

export default function CategoryAssetsAdminClient() {
  const dialog = useDialog();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<CategoryAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [keyTouched, setKeyTouched] = useState(false);
  const [form, setForm] = useState<EditForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/categories", { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(String(data.error ?? "Kateqoriyalar yüklənmədi"));
        return;
      }
      setAssets(await res.json());
      setError(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(asset: CategoryAsset) {
    setEditingKey(asset.key);
    setCreating(false);
    setKeyTouched(false);
    setError(null);
    setForm({
      key: asset.key,
      label: asset.label,
      description: asset.description ?? "",
      href: asset.href,
      imageUrl: asset.imageUrl ?? "",
      isActive: asset.isActive,
      sortOrder: String(asset.sortOrder),
    });
  }

  function startCreate() {
    setEditingKey(NEW_CATEGORY_SENTINEL);
    setCreating(true);
    setKeyTouched(false);
    setError(null);
    const nextSort = assets.reduce((max, asset) => Math.max(max, asset.sortOrder), -1) + 1;
    setForm({ ...emptyForm(), sortOrder: String(nextSort) });
  }

  function closeEdit() {
    setEditingKey(null);
    setCreating(false);
    setKeyTouched(false);
    setForm(emptyForm());
    setError(null);
  }

  async function handleUpload(file: File) {
    if (!editingKey) return;
    if (!file.type.startsWith("image/")) {
      await dialog.alert({
        title: "Yanlış fayl tipi",
        message: "Yalnız PNG, JPEG və WEBP şəkil faylı yükləyə bilərsiniz.",
        tone: "warning",
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      await dialog.alert({
        title: "Fayl çox böyükdür",
        message: "Maksimum ölçü 5 MB olmalıdır.",
        tone: "warning",
      });
      return;
    }

    const dimensions = await readImageDimensions(file).catch(() => null);
    if (!dimensions || dimensions.width !== dimensions.height) {
      await dialog.alert({
        title: "Kvadrat şəkil seçin",
        message: "Kateqoriya şəkli 1:1 formatda olmalıdır. Məsələn: 1024x1024.",
        tone: "warning",
      });
      return;
    }

    setUploading(true);
    try {
      const up = await uploadAdminImage("/api/admin/categories/image-upload", file, { key: form.key || "category" });
      if (!up.ok) {
        await dialog.alert({
          title: "Upload hazırlanmadı",
          message: String(up.error ?? "Upload linki yaradıla bilmədi."),
          tone: "danger",
        });
        return;
      }

      setForm((prev) => ({ ...prev, imageUrl: up.url }));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function save() {
    if (!editingKey) return;
    const key = creating ? slugifyKey(form.key) : form.key;
    if (creating && !key) {
      setError("Açar tələb olunur (məs: PRIME_VIDEO).");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: creating ? "CREATE" : "UPSERT",
          key,
          label: form.label,
          description: form.description,
          href: form.href,
          imageUrl: form.imageUrl,
          isActive: form.isActive,
          sortOrder: Number(form.sortOrder || 0),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(String(data.error ?? "Yadda saxlanmadı"));
        return;
      }

      await load();
      closeEdit();
    } finally {
      setSaving(false);
    }
  }

  async function deleteCategory(asset: CategoryAsset) {
    const ok = await dialog.confirm({
      title: "Kateqoriyanı sil?",
      message: `“${asset.label}” kateqoriyası tamamilə silinəcək. Bu əməliyyat geri qaytarıla bilməz.`,
      confirmLabel: "Sil",
      tone: "danger",
    });
    if (!ok) return;

    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DELETE", key: asset.key }),
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
    if (editingKey === asset.key) closeEdit();
    load();
  }

  async function resetDefaults() {
    const ok = await dialog.confirm({
      title: "Default dəyərlərə qaytar?",
      message:
        "Başlıq, izah, link, sıra və aktiv status default dəyərlərə qayıdacaq. Şəkillər silinməyəcək.",
      confirmLabel: "Qaytar",
      tone: "warning",
    });
    if (!ok) return;

    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "RESET_DEFAULTS" }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await dialog.alert({
        title: "Qaytarılmadı",
        message: String(data.error ?? res.status),
        tone: "danger",
      });
      return;
    }
    load();
  }

  const editingAsset = assets.find((asset) => asset.key === editingKey) ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_25rem]">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-admin-line bg-admin-card px-4 py-3">
          <div className="text-sm text-zinc-600">
            <span className="font-semibold text-zinc-800">{assets.length}</span> kateqoriya
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={startCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-500"
            >
              <Plus className="h-4 w-4" />
              Əlavə et
            </button>
            <button
              type="button"
              onClick={resetDefaults}
              className="inline-flex items-center gap-2 rounded-lg border border-admin-line px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:border-amber-400/40 hover:bg-amber-400/10 hover:text-amber-100"
            >
              <RotateCcw className="h-4 w-4" />
              Defaultları qaytar
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid min-h-[24rem] place-items-center rounded-xl border border-admin-line bg-admin-card">
            <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {assets.map((asset) => (
              <article
                key={asset.key}
                className={`overflow-hidden rounded-xl border bg-admin-card transition ${
                  editingKey === asset.key
                    ? "border-violet-400/60 ring-1 ring-violet-400/30"
                    : "border-admin-line hover:border-admin-line2"
                }`}
              >
                <div className="relative aspect-square bg-admin-card">
                  {asset.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={asset.imageUrl} alt={asset.label} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-zinc-600">
                      <ImageIcon className="h-10 w-10" />
                    </div>
                  )}
                  <span
                    className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ring-1 ${
                      asset.isActive
                        ? "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30"
                        : "bg-admin-card text-zinc-600 ring-admin-line"
                    }`}
                  >
                    {asset.isActive ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    {asset.isActive ? "Aktiv" : "Gizli"}
                  </span>
                  <span className="absolute right-3 top-3 rounded-full bg-black/65 px-2 py-1 text-[11px] font-bold text-white ring-1 ring-admin-line">
                    #{asset.sortOrder}
                  </span>
                </div>
                <div className="space-y-3 p-4">
                  <div>
                    <h2 className="line-clamp-1 font-bold text-zinc-900">{asset.label}</h2>
                    <p className="mt-1 line-clamp-2 min-h-10 text-sm text-zinc-600">
                      {asset.description || "İzah yoxdur"}
                    </p>
                  </div>
                  <div className="truncate rounded-lg bg-admin-card px-2.5 py-2 text-xs font-medium text-zinc-500">
                    {asset.href}
                  </div>
                  <button
                    type="button"
                    onClick={() => startEdit(asset)}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 text-sm font-semibold text-white transition hover:bg-violet-500"
                  >
                    <Edit2 className="h-4 w-4" />
                    Redaktə et
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="overflow-hidden rounded-xl border border-admin-line bg-admin-card">
          <div className="flex items-center justify-between border-b border-admin-line px-4 py-3">
            <div>
              <h2 className="font-bold text-zinc-900">
                {creating ? "Yeni kateqoriya" : "Redaktə paneli"}
              </h2>
              <p className="text-xs text-zinc-500">
                {creating
                  ? "Navbar üçün yeni platforma əlavə edin"
                  : editingAsset
                    ? editingAsset.key
                    : "Kateqoriya seçin"}
              </p>
            </div>
            {editingKey && (
              <button
                type="button"
                onClick={closeEdit}
                aria-label="Bağla"
                className="rounded-lg p-2 text-zinc-500 transition hover:bg-admin-chip2 hover:text-zinc-900"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {!editingKey ? (
            <div className="grid min-h-[28rem] place-items-center px-6 text-center">
              <div>
                <ImageIcon className="mx-auto h-10 w-10 text-zinc-600" />
                <p className="mt-3 text-sm font-medium text-zinc-600">
                  Şəkil əlavə etmək üçün soldan kateqoriya seçin.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5 p-4">
              <div className="overflow-hidden rounded-xl border border-admin-line bg-admin-card">
                <div className="relative aspect-square">
                  {form.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={form.imageUrl} alt={form.label} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-zinc-600">
                      <ImageIcon className="h-12 w-12" />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) handleUpload(file);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-admin-chip px-4 text-sm font-bold text-zinc-950 transition hover:bg-admin-card disabled:cursor-wait disabled:opacity-70"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? "Yüklənir..." : "4x4 şəkil yüklə"}
                </button>
                {form.imageUrl && (
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, imageUrl: "" }))}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-rose-500/30 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                    Şəkli sil
                  </button>
                )}
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Başlıq
                </span>
                <input
                  value={form.label}
                  onChange={(event) => {
                    const label = event.target.value;
                    setForm((prev) => ({
                      ...prev,
                      label,
                      key: creating && !keyTouched ? slugifyKey(label) : prev.key,
                    }));
                  }}
                  className="h-11 w-full rounded-lg border border-admin-line bg-admin-card px-3 text-sm text-zinc-900 outline-none transition focus:border-violet-400/60"
                />
              </label>

              {creating && (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Açar (key)
                  </span>
                  <input
                    value={form.key}
                    onChange={(event) => {
                      setKeyTouched(true);
                      setForm((prev) => ({ ...prev, key: event.target.value.toUpperCase() }));
                    }}
                    placeholder="PRIME_VIDEO"
                    className="h-11 w-full rounded-lg border border-admin-line bg-admin-card px-3 font-mono text-sm text-zinc-900 outline-none transition focus:border-violet-400/60"
                  />
                  <span className="mt-1 block text-xs text-zinc-500">
                    Yalnız böyük hərf, rəqəm və alt xətt. Sonradan dəyişdirilə bilməz.
                  </span>
                </label>
              )}

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  İzah
                </span>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  rows={3}
                  className="w-full resize-none rounded-lg border border-admin-line bg-admin-card px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-violet-400/60"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Link
                  </span>
                  <input
                    value={form.href}
                    onChange={(event) => setForm((prev) => ({ ...prev, href: event.target.value }))}
                    className="h-11 w-full rounded-lg border border-admin-line bg-admin-card px-3 text-sm text-zinc-900 outline-none transition focus:border-violet-400/60"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Sıra
                  </span>
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, sortOrder: event.target.value }))
                    }
                    className="h-11 w-full rounded-lg border border-admin-line bg-admin-card px-3 text-sm text-zinc-900 outline-none transition focus:border-violet-400/60"
                  />
                </label>
              </div>

              <label className="flex items-center justify-between gap-4 rounded-lg border border-admin-line bg-admin-card px-3 py-3">
                <span>
                  <span className="block text-sm font-semibold text-zinc-800">Aktiv göstər</span>
                  <span className="block text-xs text-zinc-500">Söndürüləndə public dropdown-da gizlənir.</span>
                </span>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, isActive: event.target.checked }))
                  }
                  className="h-5 w-5 accent-violet-500"
                />
              </label>

              {error && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={save}
                disabled={saving || uploading}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 text-sm font-bold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {creating ? "Yarat" : "Yadda saxla"}
              </button>

              {!creating && editingAsset && !PRODUCT_CATEGORY_KEYS.has(editingAsset.key) && (
                <button
                  type="button"
                  onClick={() => deleteCategory(editingAsset)}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-rose-500/30 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                  Kateqoriyanı sil
                </button>
              )}

              {form.imageUrl && (
                <div className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Şəkil yüklənib. Dəyişikliyi tətbiq etmək üçün yadda saxlayın.</span>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
