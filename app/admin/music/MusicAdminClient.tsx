"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { uploadAdminImage } from "@/lib/uploadImageClient";
import { Loader2, Plus, Edit2, Upload, X, Trash2, Check, Pencil } from "lucide-react";
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

type Platform = {
  id: string;
  code: string;
  slug: string;
  label: string;
  category: string;
  tagline: string;
  description: string;
  heroImageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
};

function slugifyPlatform(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function codeFromLabel(label: string): string {
  return label.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function readMeta(p: Product) {
  const m = p.metadata ?? {};
  const opc = Number(m.originalPriceAznCents);
  const dm = Number(m.durationMonths);
  const slots = Number(m.accountSlots);
  return {
    musicBrand: String(m.musicBrand ?? "").toUpperCase(),
    durationMonths: Number.isFinite(dm) && dm > 0 ? dm : 0,
    terms: typeof m.terms === "string" ? m.terms : "",
    originalPriceAznCents: Number.isFinite(opc) && opc > 0 ? opc : null,
    planTier: String(m.planTier ?? "").toUpperCase(),
    accountSlots: Number.isInteger(slots) && slots >= 1 ? slots : null,
  };
}

const SPOTIFY_PLAN_OPTIONS: { value: string; label: string; slots: number }[] = [
  { value: "INDIVIDUAL", label: "Individual", slots: 1 },
  { value: "DUO", label: "Duo", slots: 2 },
  { value: "FAMILY", label: "Family", slots: 5 },
];

type PlatformForm = {
  code: string;
  label: string;
  slug: string;
  tagline: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
};
function emptyPlatformForm(): PlatformForm {
  return { code: "", label: "", slug: "", tagline: "", description: "", sortOrder: "0", isActive: true };
}

export default function MusicAdminClient() {
  const dialog = useDialog();
  const [products, setProducts] = useState<Product[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);

  // Platforma modalı
  const [platformModal, setPlatformModal] = useState<null | { mode: "create" | "edit"; form: PlatformForm }>(null);
  const [platformSaving, setPlatformSaving] = useState(false);
  const [platformError, setPlatformError] = useState<string | null>(null);
  const [codeTouched, setCodeTouched] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [platformBusyCode, setPlatformBusyCode] = useState<string | null>(null);
  const [uploadingHero, setUploadingHero] = useState<string | null>(null);
  const heroInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Paket detallı modalı
  const [editingId, setEditingId] = useState<string | "NEW" | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string | number | boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Inline qiymət
  const [priceEditId, setPriceEditId] = useState<string | null>(null);
  const [priceEditValue, setPriceEditValue] = useState("");
  const [priceEditOriginalValue, setPriceEditOriginalValue] = useState("");
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; msg: string } | null>(null);

  // Paket şəkli
  const [uploadingProductImage, setUploadingProductImage] = useState<string | null>(null);
  const productImageInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Quick-add
  const [quickAdd, setQuickAdd] = useState<Record<string, { durationMonths: string; priceAzn: string }>>({});
  const [quickAddBusy, setQuickAddBusy] = useState<string | null>(null);
  const [quickAddError, setQuickAddError] = useState<{ code: string; msg: string } | null>(null);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    const res = await fetch("/api/admin/music", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setProducts(Array.isArray(data?.products) ? data.products : []);
      setPlatforms(Array.isArray(data?.platforms) ? data.platforms : []);
    }
    if (!silent) setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);


  const productCountByCode = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      const code = readMeta(p).musicBrand;
      if (code) map.set(code, (map.get(code) ?? 0) + 1);
    }
    return map;
  }, [products]);

  // ─── Upload ─────────────────────────────────────────────────────────────
  async function uploadImageFile(file: File): Promise<string | null> {
    if (!file.type.startsWith("image/")) {
      await dialog.alert({ title: "Yanlış fayl tipi", message: "Yalnız şəkil faylı yükləyə bilərsiniz", tone: "warning" });
      return null;
    }
    if (file.size > 5 * 1024 * 1024) {
      await dialog.alert({ title: "Fayl çox böyükdür", message: "Maksimum 5 MB", tone: "warning" });
      return null;
    }
    const up = await uploadAdminImage("/api/admin/services/image-upload", file);
    if (!up.ok) {
      await dialog.alert({ title: "Upload hazırlanmadı", message: up.error ?? "Xəta", tone: "danger" });
      return null;
    }
    return String(up.url ?? "");
  }

  // ─── Platforma idarəsi ────────────────────────────────────────────────────
  function startCreatePlatform() {
    setPlatformError(null);
    setCodeTouched(false);
    setSlugTouched(false);
    const nextSort = platforms.reduce((max, p) => Math.max(max, p.sortOrder), -1) + 1;
    setPlatformModal({ mode: "create", form: { ...emptyPlatformForm(), sortOrder: String(nextSort) } });
  }
  function startEditPlatform(p: Platform) {
    setPlatformError(null);
    setCodeTouched(true);
    setSlugTouched(true);
    setPlatformModal({
      mode: "edit",
      form: {
        code: p.code,
        label: p.label,
        slug: p.slug,
        tagline: p.tagline,
        description: p.description,
        sortOrder: String(p.sortOrder),
        isActive: p.isActive,
      },
    });
  }

  function platformPayload(p: Platform, overrides: { heroImageUrl?: string | null }) {
    return {
      action: "UPSERT_PLATFORM",
      code: p.code,
      slug: p.slug,
      label: p.label,
      tagline: p.tagline,
      description: p.description,
      sortOrder: p.sortOrder,
      isActive: p.isActive,
      heroImageUrl: overrides.heroImageUrl !== undefined ? overrides.heroImageUrl : p.heroImageUrl,
    };
  }

  async function savePlatform() {
    if (!platformModal) return;
    const { mode, form } = platformModal;
    const code = mode === "create" ? codeFromLabel(form.code || form.label) : form.code;
    const slug = slugifyPlatform(form.slug || form.label);
    if (!form.label.trim()) return setPlatformError("Ad tələb olunur.");
    if (!code) return setPlatformError("Kod tələb olunur (məs: SPOTIFY).");
    if (!slug) return setPlatformError("Slug tələb olunur.");
    const existing = platforms.find((p) => p.code === code);
    setPlatformSaving(true);
    setPlatformError(null);
    try {
      const res = await fetch("/api/admin/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPSERT_PLATFORM",
          code,
          slug,
          label: form.label.trim(),
          tagline: form.tagline.trim(),
          description: form.description.trim(),
          sortOrder: Number(form.sortOrder || 0),
          isActive: form.isActive,
          heroImageUrl: existing?.heroImageUrl ?? null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPlatformError(String(data.error ?? res.status));
        return;
      }
      setPlatformModal(null);
      await load(true);
    } finally {
      setPlatformSaving(false);
    }
  }

  async function deletePlatform(p: Platform) {
    const ok = await dialog.confirm({
      title: "Platformanı sil?",
      message: <p>«{p.label}» platforması silinsin? Paketi olan platforma silinə bilməz.</p>,
      confirmLabel: "Sil",
      tone: "danger",
    });
    if (!ok) return;
    setPlatformBusyCode(p.code);
    try {
      const res = await fetch("/api/admin/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DELETE_PLATFORM", code: p.code }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        await dialog.alert({ title: "Silinmədi", message: String(data.error ?? res.status), tone: "danger" });
        return;
      }
      await load(true);
    } finally {
      setPlatformBusyCode(null);
    }
  }

  async function savePlatformHero(p: Platform, heroImageUrl: string | null) {
    const res = await fetch("/api/admin/music", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(platformPayload(p, { heroImageUrl })),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await dialog.alert({ title: "Şəkil yadda saxlanmadı", message: String(data.error ?? res.status), tone: "danger" });
      return false;
    }
    await load(true);
    return true;
  }

  async function handleHeroUpload(p: Platform, file: File) {
    setUploadingHero(p.code);
    try {
      const url = await uploadImageFile(file);
      if (!url) return;
      await savePlatformHero(p, url);
    } finally {
      setUploadingHero(null);
    }
  }

  async function clearHero(p: Platform) {
    if (!(await dialog.confirm({ title: "Şəkli sil?", message: <p>«{p.label}» hero şəkli silinsin?</p>, confirmLabel: "Sil", tone: "danger" }))) return;
    setUploadingHero(p.code);
    try {
      await savePlatformHero(p, null);
    } finally {
      setUploadingHero(null);
    }
  }

  // ─── Paket idarəsi ──────────────────────────────────────────────────────
  function handleEdit(p: Product) {
    const m = readMeta(p);
    setSaveError(null);
    setEditingId(p.id);
    setEditForm({
      service: m.musicBrand || platforms[0]?.code || "",
      title: p.title,
      description: p.description ?? "",
      durationMonths: m.durationMonths || "",
      terms: m.terms,
      priceAzn: (p.priceAznCents / 100).toFixed(2),
      originalPriceAzn: m.originalPriceAznCents != null ? (m.originalPriceAznCents / 100).toFixed(2) : "",
      planTier: m.planTier || "",
      accountSlots: m.accountSlots ?? "",
      isActive: p.isActive,
      sortOrder: p.sortOrder,
    });
  }

  function handleNewProduct(defaultCode?: string) {
    setSaveError(null);
    setEditingId("NEW");
    setEditForm({
      service: defaultCode ?? platforms[0]?.code ?? "",
      title: "",
      description: "",
      durationMonths: 1,
      terms: "",
      priceAzn: "",
      originalPriceAzn: "",
      planTier: "",
      accountSlots: "",
      isActive: true,
      sortOrder: 0,
    });
  }

  async function saveProduct() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/admin/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPSERT_PRODUCT",
          id: editingId === "NEW" ? undefined : editingId,
          service: String(editForm.service ?? ""),
          title: String(editForm.title ?? ""),
          description: String(editForm.description ?? ""),
          durationMonths: editForm.durationMonths === "" ? null : Number(editForm.durationMonths),
          terms: String(editForm.terms ?? ""),
          priceAzn: Number(editForm.priceAzn),
          originalPriceAzn: String(editForm.originalPriceAzn ?? "").trim() === "" ? null : Number(editForm.originalPriceAzn),
          planTier: String(editForm.planTier ?? ""),
          accountSlots: String(editForm.accountSlots ?? "").trim() === "" ? null : Number(editForm.accountSlots),
          isActive: editForm.isActive,
          sortOrder: Number(editForm.sortOrder || 0),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(`Yadda saxlanmadı: ${data.error ?? res.status}`);
        return;
      }
      setEditingId(null);
      await load(true);
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(p: Product) {
    if (!(await dialog.confirm({ title: "Paketi sil?", message: <p>«{p.title}» paketi silinsin?</p>, confirmLabel: "Sil", tone: "danger" }))) return;
    const res = await fetch("/api/admin/music", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DELETE_PRODUCT", id: p.id }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await dialog.alert({ title: "Silinmədi", message: String(data.error ?? res.status), tone: "danger" });
      return;
    }
    load(true);
  }

  function productPayload(p: Product, overrides: { priceAzn?: number; originalPriceAzn?: number | null; isActive?: boolean }) {
    const m = readMeta(p);
    return {
      action: "UPSERT_PRODUCT",
      id: p.id,
      service: m.musicBrand,
      title: p.title,
      description: p.description ?? "",
      durationMonths: m.durationMonths || null,
      terms: m.terms,
      priceAzn: overrides.priceAzn ?? p.priceAznCents / 100,
      originalPriceAzn:
        overrides.originalPriceAzn !== undefined
          ? overrides.originalPriceAzn ?? ""
          : m.originalPriceAznCents != null
            ? m.originalPriceAznCents / 100
            : "",
      planTier: m.planTier || "",
      accountSlots: m.accountSlots ?? "",
      isActive: overrides.isActive ?? p.isActive,
      sortOrder: p.sortOrder,
    };
  }

  function startPriceEdit(p: Product) {
    const m = readMeta(p);
    setRowError(null);
    setPriceEditId(p.id);
    setPriceEditValue((p.priceAznCents / 100).toFixed(2));
    setPriceEditOriginalValue(m.originalPriceAznCents != null ? (m.originalPriceAznCents / 100).toFixed(2) : "");
  }
  function cancelPriceEdit() {
    setPriceEditId(null);
    setPriceEditValue("");
    setPriceEditOriginalValue("");
    setRowError(null);
  }

  async function savePriceInline(p: Product) {
    const value = Number(String(priceEditValue).replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      setRowError({ id: p.id, msg: "Qiymət düzgün deyil" });
      return;
    }
    const originalRaw = String(priceEditOriginalValue).replace(",", ".").trim();
    let originalPriceAzn: number | null = null;
    if (originalRaw !== "") {
      originalPriceAzn = Number(originalRaw);
      if (!Number.isFinite(originalPriceAzn) || originalPriceAzn <= 0) {
        setRowError({ id: p.id, msg: "Köhnə qiymət düzgün deyil" });
        return;
      }
      if (originalPriceAzn <= value) {
        setRowError({ id: p.id, msg: "Köhnə qiymət hazırkı qiymətdən böyük olmalıdır" });
        return;
      }
    }
    setRowBusyId(p.id);
    setRowError(null);
    try {
      const res = await fetch("/api/admin/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productPayload(p, { priceAzn: value, originalPriceAzn })),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setRowError({ id: p.id, msg: String(data.error ?? res.status) });
        return;
      }
      cancelPriceEdit();
      await load(true);
    } finally {
      setRowBusyId(null);
    }
  }

  async function toggleActiveInline(p: Product) {
    setRowBusyId(p.id);
    setRowError(null);
    try {
      const res = await fetch("/api/admin/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productPayload(p, { isActive: !p.isActive })),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setRowError({ id: p.id, msg: String(data.error ?? res.status) });
        return;
      }
      await load(true);
    } finally {
      setRowBusyId(null);
    }
  }

  async function saveProductImage(id: string, imageUrl: string) {
    const res = await fetch("/api/admin/music", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SET_PRODUCT_IMAGE", id, imageUrl }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await dialog.alert({ title: "Şəkil yadda saxlanmadı", message: String(data.error ?? res.status), tone: "danger" });
      return;
    }
    await load(true);
  }
  async function handleProductImageUpload(id: string, file: File) {
    setUploadingProductImage(id);
    try {
      const url = await uploadImageFile(file);
      if (!url) return;
      await saveProductImage(id, url);
    } finally {
      setUploadingProductImage(null);
    }
  }
  async function clearProductImage(p: Product) {
    if (!(await dialog.confirm({ title: "Paket şəklini sil?", message: <p>«{p.title}» şəkli silinsin?</p>, confirmLabel: "Sil", tone: "danger" }))) return;
    setUploadingProductImage(p.id);
    try {
      await saveProductImage(p.id, "");
    } finally {
      setUploadingProductImage(null);
    }
  }

  // ─── Quick-add ────────────────────────────────────────────────────────────
  function getQuickAdd(code: string) {
    return quickAdd[code] ?? { durationMonths: "1", priceAzn: "" };
  }
  function patchQuickAdd(code: string, patch: Partial<{ durationMonths: string; priceAzn: string }>) {
    setQuickAdd((prev) => ({ ...prev, [code]: { ...getQuickAdd(code), ...patch } }));
  }
  async function submitQuickAdd(code: string) {
    const qa = getQuickAdd(code);
    const value = Number(String(qa.priceAzn).replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      setQuickAddError({ code, msg: "Qiymət düzgün deyil" });
      return;
    }
    const months = qa.durationMonths === "" ? null : Number(qa.durationMonths);
    setQuickAddBusy(code);
    setQuickAddError(null);
    try {
      const res = await fetch("/api/admin/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPSERT_PRODUCT",
          service: code,
          durationMonths: months,
          priceAzn: value,
          isActive: true,
          sortOrder: 0,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setQuickAddError({ code, msg: String(data.error ?? res.status) });
        return;
      }
      patchQuickAdd(code, { priceAzn: "" });
      await load(true);
    } finally {
      setQuickAddBusy(null);
    }
  }

  if (loading)
    return (
      <div className="py-20 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-500" />
      </div>
    );

  const grouped = platforms.map((platform) => ({
    platform,
    items: products
      .filter((p) => readMeta(p).musicBrand === platform.code)
      .sort((a, b) => readMeta(a).durationMonths - readMeta(b).durationMonths),
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <p className="max-w-2xl text-xs text-zinc-500">
          Musiqi platformaları və paketləri. Müştəri sifariş yaradanda statusu «Gözləmədə» olur; hesab
          məlumatları «Sifarişlər» bölməsindən təsdiq zamanı daxil edilir. Yeni paket sürətli sətirdən
          və ya «Paket əlavə et» düyməsindən əlavə olunur.
        </p>
        <button
          onClick={() => handleNewProduct()}
          disabled={platforms.length === 0}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Paket əlavə et
        </button>
      </div>

      {/* Platforma məlumatları */}
      <section className="rounded-xl border border-admin-line bg-admin-card p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-zinc-900">Platforma məlumatları</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Platforma adı, slug, təsviri və hero şəkli. Hər paketin öz şəkli «Paketlər» bölməsindədir.
            </p>
          </div>
          <button
            type="button"
            onClick={startCreatePlatform}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
          >
            <Plus className="h-4 w-4" /> Yeni platforma
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {platforms.map((p) => {
            const productCount = productCountByCode.get(p.code) ?? 0;
            const heroBusy = uploadingHero === p.code;
            const busy = platformBusyCode === p.code;
            return (
              <div
                key={p.code}
                className={`rounded-xl border border-admin-line bg-admin-card p-3 ${p.isActive ? "" : "opacity-70"}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-semibold text-zinc-900">
                    {p.label}
                    {!p.isActive && (
                      <span className="ml-2 rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600">Gizli</span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-500">{productCount} paket</p>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                  <span className="font-mono">/music/{p.slug}</span>
                  <span className="rounded bg-admin-chip px-1.5 py-0.5 font-semibold text-zinc-700">{p.code}</span>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => startEditPlatform(p)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-admin-line px-2.5 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-violet-500 hover:text-violet-700"
                  >
                    <Edit2 className="h-3.5 w-3.5" /> Redaktə
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => deletePlatform(p)}
                    title={productCount > 0 ? "Paketi olan platforma silinə bilməz" : "Platformanı sil"}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-500/10 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Sil
                  </button>
                </div>

                <div className="mt-3 flex gap-3">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-admin-line bg-admin-card">
                    {p.heroImageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={p.heroImageUrl} alt={p.label} className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-center text-[11px] text-zinc-500">
                        Hero şəkil yoxdur
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <input
                      ref={(node) => {
                        heroInputRefs.current[p.code] = node;
                      }}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleHeroUpload(p, f);
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      disabled={heroBusy}
                      onClick={() => heroInputRefs.current[p.code]?.click()}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-admin-line2 bg-admin-card px-3 py-2 text-xs font-semibold text-zinc-600 transition hover:border-violet-500 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {heroBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {p.heroImageUrl ? "Hero şəkli dəyiş" : "Hero şəkil yüklə"}
                    </button>
                    {p.heroImageUrl && (
                      <button
                        type="button"
                        disabled={heroBusy}
                        onClick={() => clearHero(p)}
                        className="mt-1 text-[11px] text-zinc-500 transition hover:text-rose-600 disabled:opacity-50"
                      >
                        Şəkli sil
                      </button>
                    )}
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Bu şəkil platformanın əsas (hero) şəklidir, public /music/{p.slug} səhifəsində görünür.
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Paketlər */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-bold text-zinc-900">Paketlər</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Qiyməti dəyişmək üçün qiymətin üstünə kliklə. Yeni paketi platformanın altındakı sürətli sətirdən əlavə et.
          </p>
        </div>

        {grouped.length === 0 && (
          <div className="rounded-xl border border-dashed border-admin-line bg-admin-card px-5 py-12 text-center text-sm text-zinc-500">
            Hələ platforma yoxdur. Yuxarıdan «Yeni platforma» ilə başla.
          </div>
        )}

        {grouped.map(({ platform, items }) => {
          const qa = getQuickAdd(platform.code);
          const addBusy = quickAddBusy === platform.code;
          return (
            <section key={platform.code} className="overflow-hidden rounded-xl border border-admin-line bg-admin-card">
              <div className="flex items-center gap-3 border-b border-admin-line px-5 py-3">
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-admin-line bg-admin-card">
                  {platform.heroImageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={platform.heroImageUrl} alt={platform.label} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <h3 className="font-bold text-zinc-900">{platform.label}</h3>
                <span className="text-xs text-zinc-500">{items.length} paket</span>
              </div>

              <div className="divide-y divide-admin-line">
                {items.map((p) => {
                  const m = readMeta(p);
                  const editing = priceEditId === p.id;
                  const busy = rowBusyId === p.id;
                  const err = rowError?.id === p.id ? rowError.msg : null;
                  const hasDiscount = m.originalPriceAznCents != null;
                  const imgBusy = uploadingProductImage === p.id;
                  return (
                    <div key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="relative h-11 w-16 shrink-0 overflow-hidden rounded-md border border-admin-line bg-admin-card">
                          {p.imageUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={p.imageUrl} alt={p.title} className="absolute inset-0 h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[10px] text-zinc-500">yoxdur</div>
                          )}
                        </div>
                        <input
                          ref={(node) => {
                            productImageInputRefs.current[p.id] = node;
                          }}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleProductImageUpload(p.id, f);
                            e.target.value = "";
                          }}
                        />
                        <div className="flex flex-col items-start gap-0.5">
                          <button
                            type="button"
                            disabled={imgBusy}
                            onClick={() => productImageInputRefs.current[p.id]?.click()}
                            className="inline-flex items-center gap-1 rounded border border-dashed border-admin-line2 px-2 py-1 text-[11px] font-semibold text-zinc-600 transition hover:border-violet-500 hover:text-violet-700 disabled:opacity-50"
                          >
                            {imgBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                            {p.imageUrl ? "Şəkli dəyiş" : "Şəkil"}
                          </button>
                          {p.imageUrl && (
                            <button
                              type="button"
                              disabled={imgBusy}
                              onClick={() => clearProductImage(p)}
                              className="text-[11px] text-zinc-500 transition hover:text-rose-600 disabled:opacity-50"
                            >
                              Sil
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex min-w-[120px] items-center gap-2">
                        <span className="rounded-md bg-admin-chip px-2 py-1 text-xs font-semibold text-zinc-900">
                          {m.durationMonths ? `${m.durationMonths} ay` : "—"}
                        </span>
                        {m.planTier && (
                          <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-700">
                            {m.planTier}
                            {m.accountSlots ? ` · ${m.accountSlots} hesab` : ""}
                          </span>
                        )}
                        <span className="line-clamp-1 text-xs text-zinc-500">{p.title}</span>
                      </div>

                      <div className="flex min-w-[200px] items-center gap-2">
                        {editing ? (
                          <>
                            <label className="flex flex-col gap-0.5">
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Satış qiyməti</span>
                              <input
                                autoFocus
                                type="number"
                                step="0.01"
                                value={priceEditValue}
                                onChange={(e) => setPriceEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") savePriceInline(p);
                                  if (e.key === "Escape") cancelPriceEdit();
                                }}
                                className="w-24 rounded border border-violet-500/60 bg-admin-card px-2 py-1 text-sm text-zinc-900 outline-none focus:border-violet-400"
                              />
                            </label>
                            <label className="flex flex-col gap-0.5">
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Köhnə qiymət</span>
                              <input
                                type="number"
                                step="0.01"
                                value={priceEditOriginalValue}
                                placeholder="endirim yox"
                                onChange={(e) => setPriceEditOriginalValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") savePriceInline(p);
                                  if (e.key === "Escape") cancelPriceEdit();
                                }}
                                className="w-24 rounded border border-admin-line bg-admin-card px-2 py-1 text-sm text-zinc-900 outline-none focus:border-violet-400"
                              />
                            </label>
                            <span className="self-end pb-1.5 text-xs text-zinc-500">AZN</span>
                            <button
                              type="button"
                              onClick={() => savePriceInline(p)}
                              disabled={busy}
                              className="grid h-7 w-7 place-items-center self-end rounded bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 disabled:opacity-50"
                            >
                              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            </button>
                            <button
                              type="button"
                              onClick={cancelPriceEdit}
                              className="grid h-7 w-7 place-items-center self-end rounded bg-admin-chip text-zinc-600 hover:text-zinc-900"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startPriceEdit(p)}
                            className="group inline-flex items-center gap-2 rounded-md px-2 py-1 transition hover:bg-admin-chip2"
                          >
                            <span className="tabular-nums font-semibold text-zinc-900">{(p.priceAznCents / 100).toFixed(2)} AZN</span>
                            {hasDiscount && (
                              <span className="text-xs text-zinc-500 line-through">{((m.originalPriceAznCents as number) / 100).toFixed(2)}</span>
                            )}
                            <Pencil className="h-3.5 w-3.5 text-zinc-600 transition group-hover:text-violet-600" />
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleActiveInline(p)}
                        disabled={busy}
                        className={`rounded px-2 py-0.5 text-xs font-medium transition disabled:opacity-50 ${
                          p.isActive
                            ? "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25"
                            : "bg-rose-500/20 text-rose-600 hover:bg-rose-500/30"
                        }`}
                      >
                        {p.isActive ? "Aktiv" : "Gizli"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleEdit(p)}
                        title="Detallı redaktə"
                        className="inline-flex items-center gap-1 rounded border border-admin-line px-2 py-1 text-xs font-semibold text-zinc-700 transition hover:border-violet-500 hover:text-violet-700"
                      >
                        <Edit2 className="h-3.5 w-3.5" /> Redaktə
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteProduct(p)}
                        className="inline-flex items-center gap-1 rounded border border-rose-500/30 px-2 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Sil
                      </button>

                      {err && <span className="w-full text-xs text-rose-600">{err}</span>}
                    </div>
                  );
                })}

                {/* Quick-add */}
                <div className="flex flex-wrap items-end gap-3 bg-admin-card/40 px-5 py-3">
                  <label className="flex flex-col gap-0.5 text-xs text-zinc-500">
                    Müddət (ay)
                    <input
                      type="number"
                      min={1}
                      value={qa.durationMonths}
                      onChange={(e) => patchQuickAdd(platform.code, { durationMonths: e.target.value })}
                      className="w-20 rounded border border-admin-line bg-admin-card px-2 py-1 text-sm text-zinc-900"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5 text-xs text-zinc-500">
                    Qiymət (AZN)
                    <input
                      type="number"
                      step="0.01"
                      value={qa.priceAzn}
                      onChange={(e) => patchQuickAdd(platform.code, { priceAzn: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitQuickAdd(platform.code);
                      }}
                      className="w-28 rounded border border-admin-line bg-admin-card px-2 py-1 text-sm text-zinc-900"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => submitQuickAdd(platform.code)}
                    disabled={addBusy}
                    className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60"
                  >
                    {addBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Paket əlavə et
                  </button>
                  {quickAddError?.code === platform.code && (
                    <span className="text-xs text-rose-600">{quickAddError.msg}</span>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* Paket detallı modalı */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-admin-line bg-admin-card p-6 shadow-2xl">
            <h3 className="mb-6 text-lg font-bold">Music paketi</h3>
            <div className="space-y-4">
              <label className="block text-sm">
                Platforma
                <select
                  className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900"
                  value={String(editForm.service ?? "")}
                  onChange={(e) => setEditForm({ ...editForm, service: e.target.value })}
                >
                  {platforms.map((p) => (
                    <option key={p.code} value={p.code}>{p.label}</option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  Müddət (ay)
                  <input
                    type="number"
                    min={1}
                    className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900"
                    value={String(editForm.durationMonths ?? "")}
                    onChange={(e) => setEditForm({ ...editForm, durationMonths: e.target.value })}
                  />
                </label>
                <label className="block text-sm">
                  Sıralama (0 ən öndə)
                  <input
                    type="number"
                    className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900"
                    value={String(editForm.sortOrder ?? "0")}
                    onChange={(e) => setEditForm({ ...editForm, sortOrder: e.target.value })}
                  />
                </label>
              </div>

              {/* Çoxhesablı plan (məs. Spotify Individual/Duo/Family). Boş buraxılsa
                  adi tək-hesablı paket kimi davranır. */}
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  Plan (çoxhesablı)
                  <select
                    className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900"
                    value={String(editForm.planTier ?? "")}
                    onChange={(e) => {
                      const planTier = e.target.value;
                      const preset = SPOTIFY_PLAN_OPTIONS.find((o) => o.value === planTier);
                      setEditForm({
                        ...editForm,
                        planTier,
                        // Plan seçiləndə hesab sayını standart dəyərə qur (admin dəyişə bilər).
                        accountSlots: preset ? preset.slots : "",
                      });
                    }}
                  >
                    <option value="">— Yox (tək hesab) —</option>
                    {SPOTIFY_PLAN_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  Hesab sayı (slot)
                  <input
                    type="number"
                    min={1}
                    placeholder="məs: 2"
                    className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900"
                    value={String(editForm.accountSlots ?? "")}
                    onChange={(e) => setEditForm({ ...editForm, accountSlots: e.target.value })}
                  />
                </label>
              </div>

              <label className="block text-sm">
                Başlıq (boşdursa avtomatik olar)
                <input
                  className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900"
                  value={String(editForm.title || "")}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  placeholder="Məs: Spotify Premium 3 ay"
                />
              </label>

              <label className="block text-sm">
                Təsvir
                <textarea
                  rows={2}
                  className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900"
                  value={String(editForm.description || "")}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                />
              </label>

              <label className="block text-sm">
                Şərtlər (terms)
                <input
                  className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900"
                  value={String(editForm.terms || "")}
                  onChange={(e) => setEditForm({ ...editForm, terms: e.target.value })}
                  placeholder="Məs: fərdi hesab, 1 cihaz"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  Qiymət (AZN)
                  <input
                    type="number"
                    step="0.01"
                    className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900"
                    value={String(editForm.priceAzn || "")}
                    onChange={(e) => setEditForm({ ...editForm, priceAzn: e.target.value })}
                  />
                </label>
                <label className="block text-sm">
                  Köhnə qiymət (boş = endirim yox)
                  <input
                    type="number"
                    step="0.01"
                    placeholder="məs: 12.00"
                    className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900"
                    value={String(editForm.originalPriceAzn ?? "")}
                    onChange={(e) => setEditForm({ ...editForm, originalPriceAzn: e.target.value })}
                  />
                </label>
              </div>

              <label className="flex items-center gap-2 rounded-lg border border-admin-line bg-admin-card p-3 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(editForm.isActive)}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                />
                Aktivdir
              </label>
            </div>
            {saveError && (
              <div className="mt-4 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">{saveError}</div>
            )}
            <div className="mt-8 flex justify-end gap-3">
              <button onClick={() => { setEditingId(null); setSaveError(null); }} className="rounded bg-admin-chip px-4 py-2 text-sm text-zinc-700">İmtina</button>
              <button onClick={saveProduct} disabled={saving} className="inline-flex items-center gap-2 rounded bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Yadda saxla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Platforma modalı */}
      {platformModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-admin-line bg-admin-card p-6 shadow-2xl">
            <h3 className="mb-6 text-lg font-bold">
              {platformModal.mode === "create" ? "Yeni platforma" : "Platformanı redaktə et"}
            </h3>
            <div className="space-y-4">
              <label className="block text-sm">
                Ad
                <input
                  autoFocus
                  className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900"
                  value={platformModal.form.label}
                  placeholder="Məs: Spotify"
                  onChange={(e) => {
                    const label = e.target.value;
                    setPlatformModal((prev) =>
                      prev
                        ? {
                            ...prev,
                            form: {
                              ...prev.form,
                              label,
                              code: prev.mode === "create" && !codeTouched ? codeFromLabel(label) : prev.form.code,
                              slug: !slugTouched ? slugifyPlatform(label) : prev.form.slug,
                            },
                          }
                        : prev,
                    );
                  }}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  Kod (key)
                  <input
                    disabled={platformModal.mode === "edit"}
                    className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 font-mono text-zinc-900 disabled:opacity-60"
                    value={platformModal.form.code}
                    placeholder="SPOTIFY"
                    onChange={(e) => {
                      setCodeTouched(true);
                      const code = e.target.value.toUpperCase();
                      setPlatformModal((prev) => (prev ? { ...prev, form: { ...prev.form, code } } : prev));
                    }}
                  />
                </label>
                <label className="block text-sm">
                  Slug (URL)
                  <input
                    className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 font-mono text-zinc-900"
                    value={platformModal.form.slug}
                    placeholder="spotify"
                    onChange={(e) => {
                      setSlugTouched(true);
                      const slug = e.target.value;
                      setPlatformModal((prev) => (prev ? { ...prev, form: { ...prev.form, slug } } : prev));
                    }}
                  />
                </label>
              </div>

              <label className="block text-sm">
                Sıralama (0 ən öndə)
                <input
                  type="number"
                  className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900"
                  value={platformModal.form.sortOrder}
                  onChange={(e) => {
                    const sortOrder = e.target.value;
                    setPlatformModal((prev) => (prev ? { ...prev, form: { ...prev.form, sortOrder } } : prev));
                  }}
                />
              </label>

              <label className="block text-sm">
                Qısa təsvir (tagline)
                <input
                  className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900"
                  value={platformModal.form.tagline}
                  onChange={(e) => {
                    const tagline = e.target.value;
                    setPlatformModal((prev) => (prev ? { ...prev, form: { ...prev.form, tagline } } : prev));
                  }}
                />
              </label>

              <label className="block text-sm">
                Təsvir (hero)
                <textarea
                  rows={3}
                  className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900"
                  value={platformModal.form.description}
                  onChange={(e) => {
                    const description = e.target.value;
                    setPlatformModal((prev) => (prev ? { ...prev, form: { ...prev.form, description } } : prev));
                  }}
                />
              </label>

              <label className="flex items-center gap-2 rounded-lg border border-admin-line bg-admin-card p-3 text-sm">
                <input
                  type="checkbox"
                  checked={platformModal.form.isActive}
                  onChange={(e) => {
                    const isActive = e.target.checked;
                    setPlatformModal((prev) => (prev ? { ...prev, form: { ...prev.form, isActive } } : prev));
                  }}
                />
                Aktivdir (söndürüləndə public-də gizlənir)
              </label>
            </div>
            {platformError && (
              <div className="mt-4 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">{platformError}</div>
            )}
            <div className="mt-8 flex justify-end gap-3">
              <button onClick={() => { setPlatformModal(null); setPlatformError(null); }} className="rounded bg-admin-chip px-4 py-2 text-sm text-zinc-700">İmtina</button>
              <button onClick={savePlatform} disabled={platformSaving} className="inline-flex items-center gap-2 rounded bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
                {platformSaving && <Loader2 className="h-4 w-4 animate-spin" />} Yadda saxla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
