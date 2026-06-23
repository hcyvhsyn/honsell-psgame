"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { uploadAdminImage } from "@/lib/uploadImageClient";
import { Loader2, Plus, Edit2, Upload, X, Trash2, Check, Pencil } from "lucide-react";
import { useDialog } from "@/lib/dialogs";
import { getServiceVariantConfig } from "@/lib/streamingVariants";

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

const DEVICES = [
  { value: "computer", label: "Kompüter" },
  { value: "tv", label: "Televizor" },
  { value: "phone", label: "Telefon" },
  { value: "tablet", label: "Planşet" },
];

type Platform = {
  id: string;
  code: string;
  slug: string;
  label: string;
  category: string;
  tagline: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
};

function slugifyPlatform(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function platformCodeFromLabel(label: string): string {
  return label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

type PlatformForm = {
  code: string;
  label: string;
  slug: string;
  category: string;
  tagline: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
};

function emptyPlatformForm(): PlatformForm {
  return {
    code: "",
    label: "",
    slug: "",
    category: "STREAMING",
    tagline: "",
    description: "",
    sortOrder: "0",
    isActive: true,
  };
}

function readMeta(p: ServiceProduct) {
  const m = p.metadata ?? {};
  const opc = Number(m.originalPriceAznCents);
  const rawDevices = Array.isArray(m.devices) ? (m.devices as unknown[]) : [];
  return {
    service: String(m.service ?? ""),
    variantSlug: typeof m.variantSlug === "string" ? m.variantSlug : "",
    durationMonths: Number(m.durationMonths ?? 0),
    seats: Number(m.seats ?? 1),
    originalPriceAznCents: Number.isFinite(opc) && opc > 0 ? opc : null,
    devices: rawDevices.filter((x): x is string => typeof x === "string"),
    vpnRequired: Boolean(m.vpnRequired),
    platformImageUrl:
      typeof m.platformImageUrl === "string" && m.platformImageUrl.trim()
        ? String(m.platformImageUrl)
        : "",
  };
}

export default function StreamingAdminClient() {
  const dialog = useDialog();
  const [products, setProducts] = useState<ServiceProduct[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);

  // Platforma yaratma/redaktə modalı.
  const [platformModal, setPlatformModal] = useState<
    null | { mode: "create" | "edit"; form: PlatformForm }
  >(null);
  const [platformSaving, setPlatformSaving] = useState(false);
  const [platformError, setPlatformError] = useState<string | null>(null);
  const [platformCodeTouched, setPlatformCodeTouched] = useState(false);
  const [platformSlugTouched, setPlatformSlugTouched] = useState(false);
  const [platformBusyCode, setPlatformBusyCode] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | "NEW" | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string | number | boolean>>({});

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadingProductImage, setUploadingProductImage] = useState<string | null>(null);
  const [uploadingPlatformImage, setUploadingPlatformImage] = useState<string | null>(null);
  const [savingServiceAccess, setSavingServiceAccess] = useState<string | null>(null);
  const productImageInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const platformImageInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Inline sətir əməliyyatları (modal olmadan qiymət/status).
  const [priceEditId, setPriceEditId] = useState<string | null>(null);
  const [priceEditValue, setPriceEditValue] = useState("");
  const [priceEditOriginalValue, setPriceEditOriginalValue] = useState("");
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; msg: string } | null>(null);

  // Platforma üzrə sürətli paket əlavəsi (modalsız).
  const [quickAdd, setQuickAdd] = useState<
    Record<string, { durationMonths: number; seats: number; priceAzn: string; variantSlug?: string }>
  >({});
  const [quickAddBusy, setQuickAddBusy] = useState<string | null>(null);
  const [quickAddError, setQuickAddError] = useState<{ service: string; msg: string } | null>(null);

  // Bu admin yalnız STREAMING kateqoriyalı platformaları idarə edir.
  // MUSIC platformaları (məs. YouTube Premium) /admin/music altında idarə olunur.
  const streamingPlatforms = useMemo(
    () => platforms.filter((p) => p.category !== "MUSIC"),
    [platforms],
  );
  // DB platformaları → köhnə {value,label} formatı (mövcud JSX ilə uyğun).
  const services = useMemo(
    () => streamingPlatforms.map((p) => ({ value: p.code, label: p.label })),
    [streamingPlatforms],
  );
  const labelByCode = useMemo(
    () => new Map(platforms.map((p) => [p.code, p.label])),
    [platforms],
  );
  const serviceLabel = (code: string) => labelByCode.get(code) ?? code;

  const serviceImageMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      const service = readMeta(p).service;
      if (service && p.imageUrl && !map.has(service)) map.set(service, p.imageUrl);
    }
    return map;
  }, [products]);

  // Platforma şəkli (metadata.platformImageUrl) — xidmət üzrə bütün paketlərə tətbiq olunur.
  const platformImageMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      const m = readMeta(p);
      if (m.service && m.platformImageUrl && !map.has(m.service)) map.set(m.service, m.platformImageUrl);
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

  // silent=true: yalnız məhsulları yenidən yükləyir, tam ekran spinner'ini
  // göstərmir (qiymət/status dəyişəndə bütün səhifənin "reload" effekti olmasın).
  async function load(silent = false) {
    if (!silent) setLoading(true);
    const res = await fetch("/api/admin/streaming", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setProducts(Array.isArray(data?.products) ? data.products : []);
      setPlatforms(Array.isArray(data?.platforms) ? data.platforms : []);
    }
    if (!silent) setLoading(false);
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
      variantSlug: m.variantSlug || "",
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
      service: services[0]?.value ?? "",
      variantSlug: "",
      durationMonths: 1,
      seats: 1,
      priceAzn: "",
      originalPriceAzn: "",
    });
  }

  async function uploadImageFile(file: File): Promise<string | null> {
    if (!file.type.startsWith("image/")) {
      await dialog.alert({ title: "Yanlış fayl tipi", message: "Yalnız şəkil faylı yükləyə bilərsiniz", tone: "warning" });
      return null;
    }
    if (file.size > 5 * 1024 * 1024) {
      await dialog.alert({ title: "Fayl ölçüsü çox böyükdür", message: "Fayl çox böyükdür (max 5 MB)", tone: "warning" });
      return null;
    }

    const up = await uploadAdminImage("/api/admin/services/image-upload", file);
    if (!up.ok) {
      await dialog.alert({ title: "Upload hazırlanmadı", message: up.error ?? "Upload hazırlanmadı", tone: "danger" });
      return null;
    }

    return String(up.url ?? "");
  }

  async function saveProductImage(id: string, imageUrl: string) {
    const res = await fetch("/api/admin/streaming", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SET_PRODUCT_IMAGE", id, imageUrl }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await dialog.alert({ title: "Şəkil yadda saxlanmadı", message: String(data.error ?? res.status), tone: "danger" });
      return false;
    }
    await load(true);
    return true;
  }

  async function handleProductImageUpload(id: string, file: File) {
    setUploadingProductImage(id);
    try {
      const publicUrl = await uploadImageFile(file);
      if (!publicUrl) return;
      await saveProductImage(id, publicUrl);
    } finally {
      setUploadingProductImage(null);
    }
  }

  async function clearProductImage(p: ServiceProduct) {
    if (
      !(await dialog.confirm({
        title: "Paket şəklini sil?",
        message: <p>«{p.title}» paketi üçün ayrıca şəkil silinsin?</p>,
        confirmLabel: "Sil",
        tone: "danger",
      }))
    )
      return;
    setUploadingProductImage(p.id);
    try {
      await saveProductImage(p.id, "");
    } finally {
      setUploadingProductImage(null);
    }
  }

  async function savePlatformImage(service: string, imageUrl: string) {
    const res = await fetch("/api/admin/streaming", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SET_SERVICE_PLATFORM_IMAGE", service, imageUrl }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await dialog.alert({ title: "Şəkil yadda saxlanmadı", message: String(data.error ?? res.status), tone: "danger" });
      return false;
    }
    await load(true);
    return true;
  }

  async function handlePlatformImageUpload(service: string, file: File) {
    setUploadingPlatformImage(service);
    try {
      const publicUrl = await uploadImageFile(file);
      if (!publicUrl) return;
      await savePlatformImage(service, publicUrl);
    } finally {
      setUploadingPlatformImage(null);
    }
  }

  async function clearPlatformImage(service: string) {
    if (
      !(await dialog.confirm({
        title: "Platforma şəklini sil?",
        message: <p>«{serviceLabel(service)}» üçün platforma şəkli silinsin?</p>,
        confirmLabel: "Sil",
        tone: "danger",
      }))
    )
      return;
    setUploadingPlatformImage(service);
    try {
      await savePlatformImage(service, "");
    } finally {
      setUploadingPlatformImage(null);
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
        await dialog.alert({ title: "Platforma məlumatı yadda saxlanmadı", message: String(data.error ?? res.status), tone: "danger" });
        return false;
      }
      await load(true);
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
      const variantCfg = getServiceVariantConfig(service);
      const variantSlug = String(editForm.variantSlug ?? "").trim();
      if (variantCfg && !variantSlug) {
        setSaveError("Variant (tier) seçilməlidir!");
        return;
      }
      const variantName = variantCfg?.variants.find((v) => v.slug === variantSlug)?.name ?? "";
      const durationMonths = Number(editForm.durationMonths);
      const seats = Number(editForm.seats);
      const autoTitle =
        String(editForm.title).trim() ||
        `${serviceLabel(service)}${variantName ? ` ${variantName}` : ""} ${durationMonths} ay${seats > 1 ? ` · ${seats} nəfərlik` : ""}`;

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
          variantSlug,
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
      load(true);
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(p: ServiceProduct) {
    if (
      !(await dialog.confirm({
        title: "Məhsulu sil?",
        message: <p>«{p.title}» məhsulu silinsin?</p>,
        confirmLabel: "Sil",
        tone: "danger",
      }))
    )
      return;
    const res = await fetch("/api/admin/streaming", {
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

  // ─── Platforma idarəetməsi ──────────────────────────────────────────────
  function startCreatePlatform() {
    setPlatformError(null);
    setPlatformCodeTouched(false);
    setPlatformSlugTouched(false);
    const nextSort = platforms.reduce((max, p) => Math.max(max, p.sortOrder), -1) + 1;
    setPlatformModal({
      mode: "create",
      form: { ...emptyPlatformForm(), sortOrder: String(nextSort) },
    });
  }

  function startEditPlatform(p: Platform) {
    setPlatformError(null);
    setPlatformCodeTouched(true);
    setPlatformSlugTouched(true);
    setPlatformModal({
      mode: "edit",
      form: {
        code: p.code,
        label: p.label,
        slug: p.slug,
        category: p.category,
        tagline: p.tagline,
        description: p.description,
        sortOrder: String(p.sortOrder),
        isActive: p.isActive,
      },
    });
  }

  async function savePlatform() {
    if (!platformModal) return;
    const { mode, form } = platformModal;
    const code = mode === "create" ? platformCodeFromLabel(form.code || form.label) : form.code;
    const slug = slugifyPlatform(form.slug || form.label);
    if (!form.label.trim()) {
      setPlatformError("Ad tələb olunur.");
      return;
    }
    if (!code) {
      setPlatformError("Kod tələb olunur (məs: PRIME_VIDEO).");
      return;
    }
    if (!slug) {
      setPlatformError("Slug tələb olunur (məs: prime).");
      return;
    }
    setPlatformSaving(true);
    setPlatformError(null);
    try {
      const res = await fetch("/api/admin/streaming", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPSERT_PLATFORM",
          code,
          slug,
          label: form.label.trim(),
          category: form.category,
          tagline: form.tagline.trim(),
          description: form.description.trim(),
          sortOrder: Number(form.sortOrder || 0),
          isActive: form.isActive,
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
      const res = await fetch("/api/admin/streaming", {
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

  // Mövcud məhsulun tam UPSERT yükünü qurur (yalnız dəyişən sahələri override edir).
  // API şəkil/cihaz/VPN/referal-ı avtomatik qoruyur, ona görə yalnız əsas sahələri göndəririk.
  function upsertPayload(
    p: ServiceProduct,
    overrides: { priceAzn?: number; originalPriceAzn?: number | null; isActive?: boolean },
  ) {
    const m = readMeta(p);
    return {
      action: "UPSERT_PRODUCT",
      id: p.id,
      title: p.title,
      description: p.description ?? "",
      isActive: overrides.isActive ?? p.isActive,
      sortOrder: p.sortOrder,
      service: m.service,
      durationMonths: m.durationMonths,
      seats: m.seats,
      priceAzn: overrides.priceAzn ?? p.priceAznCents / 100,
      originalPriceAzn:
        overrides.originalPriceAzn !== undefined
          ? overrides.originalPriceAzn ?? ""
          : m.originalPriceAznCents != null
            ? m.originalPriceAznCents / 100
            : "",
    };
  }

  function startPriceEdit(p: ServiceProduct) {
    const m = readMeta(p);
    setRowError(null);
    setPriceEditId(p.id);
    setPriceEditValue((p.priceAznCents / 100).toFixed(2));
    setPriceEditOriginalValue(
      m.originalPriceAznCents != null ? (m.originalPriceAznCents / 100).toFixed(2) : "",
    );
  }

  function cancelPriceEdit() {
    setPriceEditId(null);
    setPriceEditValue("");
    setPriceEditOriginalValue("");
    setRowError(null);
  }

  async function savePriceInline(p: ServiceProduct) {
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
      const res = await fetch("/api/admin/streaming", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(upsertPayload(p, { priceAzn: value, originalPriceAzn })),
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

  async function toggleActiveInline(p: ServiceProduct) {
    setRowBusyId(p.id);
    setRowError(null);
    try {
      const res = await fetch("/api/admin/streaming", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(upsertPayload(p, { isActive: !p.isActive })),
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

  function getQuickAdd(service: string) {
    return quickAdd[service] ?? { durationMonths: 1, seats: 1, priceAzn: "" };
  }

  function patchQuickAdd(
    service: string,
    patch: Partial<{ durationMonths: number; seats: number; priceAzn: string; variantSlug: string }>,
  ) {
    setQuickAddError(null);
    setQuickAdd((prev) => ({
      ...prev,
      [service]: { ...getQuickAdd(service), ...patch },
    }));
  }

  async function submitQuickAdd(service: string) {
    const qa = getQuickAdd(service);
    const value = Number(String(qa.priceAzn).replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      setQuickAddError({ service, msg: "Qiymət düzgün deyil" });
      return;
    }
    const variantCfg = getServiceVariantConfig(service);
    const variantSlug = String(qa.variantSlug ?? "").trim();
    if (variantCfg && !variantSlug) {
      setQuickAddError({ service, msg: "Variant (tier) seçilməlidir" });
      return;
    }
    const duplicate = products.some((p) => {
      const m = readMeta(p);
      return (
        m.service === service &&
        m.durationMonths === qa.durationMonths &&
        m.seats === qa.seats &&
        m.variantSlug === variantSlug
      );
    });
    if (duplicate) {
      setQuickAddError({ service, msg: "Bu variant/müddət/nəfər kombinasiyası artıq var" });
      return;
    }
    setQuickAddBusy(service);
    setQuickAddError(null);
    try {
      const res = await fetch("/api/admin/streaming", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPSERT_PRODUCT",
          title: "",
          description: "",
          isActive: true,
          sortOrder: 0,
          service,
          variantSlug,
          durationMonths: qa.durationMonths,
          seats: qa.seats,
          priceAzn: value,
          originalPriceAzn: "",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setQuickAddError({ service, msg: String(data.error ?? res.status) });
        return;
      }
      patchQuickAdd(service, { priceAzn: "" });
      await load(true);
    } finally {
      setQuickAddBusy(null);
    }
  }

  if (loading) return <div className="py-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-500" /></div>;

  const groupedByService = services.map((svc) => ({
    svc,
    items: products
      .filter((p) => readMeta(p).service === svc.value)
      .sort((a, b) => {
        const ma = readMeta(a);
        const mb = readMeta(b);
        return ma.durationMonths - mb.durationMonths || ma.seats - mb.seats;
      }),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <p className="max-w-2xl text-xs text-zinc-500">
          Müştəri sifariş yaradanda statusu <span className="text-amber-700">Gözləmədə</span> olur.
          Hesab məlumatları &laquo;Sifarişlər&raquo; bölməsindən sifarişin təsdiqi zamanı əl ilə daxil edilir.
          Yeni paket sürətli sətirdən və ya «Paket əlavə et» düyməsindən əlavə olunur.
        </p>
        <button
          onClick={handleNew}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
        >
          <Plus className="h-4 w-4" /> Paket əlavə et
        </button>
      </div>

      <section className="rounded-xl border border-admin-line bg-admin-card p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-zinc-900">Platforma məlumatları</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Platforma adı, slug, kateqoriya və təsviri burada idarə olunur. Platforma şəkli (hero),
              izlənilə bilən cihazlar və VPN tələbi platforma üzrə saxlanır və bütün paketlərə tətbiq olunur.
              Hər paketin öz şəkli isə aşağıda «Paketlər» bölməsində həmin sətirdən «Şəkil» düyməsi ilə yüklənir.
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
          {streamingPlatforms.map((p) => {
            const svc = { value: p.code, label: p.label };
            const access = serviceAccessMap.get(svc.value) ?? { devices: [], vpnRequired: false };
            const productCount = productCountByService.get(svc.value) ?? 0;
            const accessBusy = savingServiceAccess === svc.value;
            const disabled = productCount === 0;
            const platformImage = platformImageMap.get(svc.value) ?? "";
            const platformImageBusy = uploadingPlatformImage === svc.value;
            const platformBusy = platformBusyCode === p.code;
            return (
              <div
                key={svc.value}
                className={`rounded-xl border border-admin-line bg-admin-card p-3 ${
                  p.isActive ? "" : "opacity-70"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-semibold text-zinc-900">
                    {svc.label}
                    {!p.isActive && (
                      <span className="ml-2 rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600">
                        Gizli
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-500">{productCount} paket</p>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                  <span className="font-mono">/{p.category === "MUSIC" ? "music" : "streaming"}/{p.slug}</span>
                  <span className="rounded bg-admin-chip px-1.5 py-0.5 font-semibold text-zinc-700">{p.category}</span>
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
                    disabled={platformBusy}
                    onClick={() => deletePlatform(p)}
                    title={productCount > 0 ? "Paketi olan platforma silinə bilməz" : "Platformanı sil"}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-500/10 disabled:opacity-50"
                  >
                    {platformBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Sil
                  </button>
                </div>

                <div className="mt-3 flex gap-3">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-admin-line bg-admin-card">
                    {platformImage ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={platformImage} alt={svc.label} className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-center text-[11px] text-zinc-500">
                        Platforma şəkli yoxdur
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <input
                      ref={(node) => {
                        platformImageInputRefs.current[svc.value] = node;
                      }}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handlePlatformImageUpload(svc.value, f);
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      disabled={platformImageBusy || disabled}
                      onClick={() => platformImageInputRefs.current[svc.value]?.click()}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-admin-line2 bg-admin-card px-3 py-2 text-xs font-semibold text-zinc-600 transition hover:border-violet-500 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {platformImageBusy ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Yüklənir...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" /> {platformImage ? "Platforma şəklini dəyiş" : "Platforma şəkli yüklə"}
                        </>
                      )}
                    </button>
                    {platformImage && (
                      <button
                        type="button"
                        disabled={platformImageBusy}
                        onClick={() => clearPlatformImage(svc.value)}
                        className="mt-1 text-[11px] text-zinc-500 transition hover:text-rose-600 disabled:opacity-50"
                      >
                        Şəkli sil
                      </button>
                    )}
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Bu şəkil həmin platformanın əsas (hero) şəklidir, bütün paketlərə tətbiq olunur. Hər paketin öz şəkli «Paketlər» bölməsindədir.
                    </p>
                  </div>
                </div>

                <div className="mt-3 border-t border-admin-line pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      İzlənilə bilən cihazlar
                    </p>
                    {accessBusy && <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-600" />}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {DEVICES.map((d) => {
                      const checked = access.devices.includes(d.value);
                      return (
                        <label
                          key={d.value}
                          className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition ${
                            checked
                              ? "border-violet-500/45 bg-violet-500/10 text-violet-700"
                              : "border-admin-line bg-admin-card text-zinc-600 hover:border-admin-line2"
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
                    className={`mt-2 flex cursor-pointer items-center gap-2 rounded-lg border border-admin-line bg-admin-card px-3 py-2 text-xs text-zinc-700 ${
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

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-zinc-900">Paketlər</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Qiyməti dəyişmək üçün qiymətin üstünə kliklə. Yeni müddət əlavə etmək üçün
              platformanın altındakı sürətli sətirdən istifadə et.
            </p>
          </div>
        </div>

        {groupedByService.length === 0 && (
          <div className="rounded-xl border border-dashed border-admin-line bg-admin-card px-5 py-12 text-center text-sm text-zinc-500">
            Hələ paket əlavə edilməyib. Platforma seçib altındakı sürətli sətirdən ilk paketi əlavə et.
          </div>
        )}

        {groupedByService.map(({ svc, items }) => {
          const qa = getQuickAdd(svc.value);
          const headerImage = serviceImageMap.get(svc.value) ?? "";
          const addBusy = quickAddBusy === svc.value;
          return (
            <section key={svc.value} className="overflow-hidden rounded-xl border border-admin-line bg-admin-card">
              <div className="flex items-center gap-3 border-b border-admin-line bg-admin-card px-5 py-3">
                <div className="h-9 w-12 shrink-0 overflow-hidden rounded border border-admin-line bg-admin-card">
                  {headerImage ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={headerImage} alt={svc.label} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-zinc-900">{svc.label}</h3>
                  <p className="text-xs text-zinc-500">{items.length} paket</p>
                </div>
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
                            title={p.imageUrl ? "Bu paketin şəklini dəyiş" : "Bu paket üçün ayrıca şəkil yüklə"}
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

                      <div className="flex min-w-[140px] items-center gap-2">
                        <span className="rounded-md bg-admin-chip px-2 py-1 text-xs font-semibold text-zinc-900">
                          {m.durationMonths} ay
                        </span>
                        <span className="text-xs text-zinc-500">{m.seats} nəfərlik</span>
                      </div>

                      <div className="flex min-w-[200px] items-center gap-2">
                        {editing ? (
                          <>
                            <label className="flex flex-col gap-0.5">
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                                Satış qiyməti
                              </span>
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
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                                Köhnə qiymət
                              </span>
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
                              title="Yadda saxla"
                            >
                              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            </button>
                            <button
                              type="button"
                              onClick={cancelPriceEdit}
                              className="grid h-7 w-7 place-items-center self-end rounded bg-admin-chip text-zinc-600 hover:text-zinc-900"
                              title="İmtina"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startPriceEdit(p)}
                            className="group inline-flex items-center gap-2 rounded-md px-2 py-1 transition hover:bg-admin-chip2"
                            title="Qiyməti dəyiş"
                          >
                            <span className="tabular-nums font-semibold text-zinc-900">
                              {(p.priceAznCents / 100).toFixed(2)} AZN
                            </span>
                            {hasDiscount && (
                              <span className="text-xs text-zinc-500 line-through">
                                {((m.originalPriceAznCents as number) / 100).toFixed(2)}
                              </span>
                            )}
                            <Pencil className="h-3.5 w-3.5 text-zinc-600 transition group-hover:text-violet-600" />
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleActiveInline(p)}
                        disabled={busy}
                        title="Status dəyiş"
                        className={`rounded px-2 py-0.5 text-xs font-medium transition disabled:opacity-50 ${
                          p.isActive
                            ? "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25"
                            : "bg-rose-500/20 text-rose-600 hover:bg-rose-500/30"
                        }`}
                      >
                        {p.isActive ? "Aktiv" : "Passiv"}
                      </button>

                      <div className="ml-auto flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(p)}
                          title="Detallı redaktə (təsvir, endirim, sıralama)"
                          className="p-2 text-zinc-500 hover:text-violet-600"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteProduct(p)}
                          title="Sil"
                          className="p-2 text-zinc-500 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {err && <p className="w-full text-xs text-rose-600">{err}</p>}
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-admin-line bg-admin-card px-5 py-3">
                <div className="flex flex-wrap items-end gap-2">
                  {(() => {
                    const cfg = getServiceVariantConfig(svc.value);
                    if (!cfg) return null;
                    return (
                      <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                        Variant
                        <select
                          value={qa.variantSlug ?? ""}
                          onChange={(e) => patchQuickAdd(svc.value, { variantSlug: e.target.value })}
                          className="mt-1 block rounded border border-admin-line bg-admin-card px-2 py-1.5 text-sm text-zinc-900"
                        >
                          <option value="">— Seç —</option>
                          {cfg.variants.map((v) => (
                            <option key={v.slug} value={v.slug}>{v.name}</option>
                          ))}
                        </select>
                      </label>
                    );
                  })()}
                  <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                    Müddət
                    <select
                      value={qa.durationMonths}
                      onChange={(e) => patchQuickAdd(svc.value, { durationMonths: Number(e.target.value) })}
                      className="mt-1 block rounded border border-admin-line bg-admin-card px-2 py-1.5 text-sm text-zinc-900"
                    >
                      {DURATIONS.map((d) => (
                        <option key={d} value={d}>{d} ay</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                    Nəfər
                    <select
                      value={qa.seats}
                      onChange={(e) => patchQuickAdd(svc.value, { seats: Number(e.target.value) })}
                      className="mt-1 block rounded border border-admin-line bg-admin-card px-2 py-1.5 text-sm text-zinc-900"
                    >
                      {SEATS.map((s) => (
                        <option key={s} value={s}>{s} nəfərlik</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                    Qiymət (AZN)
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={qa.priceAzn}
                      onChange={(e) => patchQuickAdd(svc.value, { priceAzn: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter") submitQuickAdd(svc.value); }}
                      className="mt-1 block w-28 rounded border border-admin-line bg-admin-card px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-violet-400"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => submitQuickAdd(svc.value)}
                    disabled={addBusy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
                  >
                    {addBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Əlavə et
                  </button>
                </div>
                {quickAddError?.service === svc.value && (
                  <p className="mt-2 text-xs text-rose-600">{quickAddError.msg}</p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Editor Modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-admin-line bg-admin-card p-6 shadow-2xl">
            <h3 className="mb-6 text-lg font-bold">Streaming paketi</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  Xidmət
                  <select
                    className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900"
                    value={String(editForm.service ?? services[0]?.value ?? "")}
                    onChange={(e) => setEditForm({ ...editForm, service: e.target.value })}
                  >
                    {services.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  Müddət (ay)
                  <select
                    className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900"
                    value={Number(editForm.durationMonths)}
                    onChange={(e) => setEditForm({ ...editForm, durationMonths: Number(e.target.value) })}
                  >
                    {DURATIONS.map((d) => (
                      <option key={d} value={d}>{d} ay</option>
                    ))}
                  </select>
                </label>
              </div>

              {(() => {
                const cfg = getServiceVariantConfig(String(editForm.service ?? ""));
                if (!cfg) return null;
                return (
                  <label className="block text-sm">
                    Variant (tier)
                    <select
                      className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900"
                      value={String(editForm.variantSlug ?? "")}
                      onChange={(e) => setEditForm({ ...editForm, variantSlug: e.target.value })}
                    >
                      <option value="">— Seç —</option>
                      {cfg.variants.map((v) => (
                        <option key={v.slug} value={v.slug}>{v.name}</option>
                      ))}
                    </select>
                    <span className="mt-1 block text-xs text-zinc-500">
                      Bu xidmətin alt-paketi. Fərqlər koddan idarə olunur (lib/streamingVariants).
                    </span>
                  </label>
                );
              })()}

              <label className="block text-sm">
                Nəfər sayı
                <select
                  className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900"
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
                  className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900"
                  value={String(editForm.title || "")}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  placeholder="Məs: HBO Max 3 ay · 2 nəfərlik"
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
                  Köhnə qiymət (boş = endirim yoxdur)
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

              <label className="block text-sm">
                Sıralama (0 ən öndə)
                <input
                  type="number"
                  className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900"
                  value={String(editForm.sortOrder || "0")}
                  onChange={(e) => setEditForm({ ...editForm, sortOrder: e.target.value })}
                />
              </label>

              <label className="flex items-center gap-2 rounded-lg border border-admin-line bg-admin-card p-3 text-sm">
                <input type="checkbox" checked={Boolean(editForm.isActive)} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })} /> Aktivdir
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

      {/* Platforma Modalı */}
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
                  placeholder="Məs: Disney+"
                  onChange={(e) => {
                    const label = e.target.value;
                    setPlatformModal((prev) =>
                      prev
                        ? {
                            ...prev,
                            form: {
                              ...prev.form,
                              label,
                              code:
                                prev.mode === "create" && !platformCodeTouched
                                  ? platformCodeFromLabel(label)
                                  : prev.form.code,
                              slug: !platformSlugTouched ? slugifyPlatform(label) : prev.form.slug,
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
                    placeholder="PRIME_VIDEO"
                    onChange={(e) => {
                      setPlatformCodeTouched(true);
                      const code = e.target.value.toUpperCase();
                      setPlatformModal((prev) => (prev ? { ...prev, form: { ...prev.form, code } } : prev));
                    }}
                  />
                  {platformModal.mode === "edit" && (
                    <span className="mt-1 block text-[11px] text-zinc-500">Kod dəyişdirilə bilməz.</span>
                  )}
                </label>
                <label className="block text-sm">
                  Slug (URL)
                  <input
                    className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 font-mono text-zinc-900"
                    value={platformModal.form.slug}
                    placeholder="prime"
                    onChange={(e) => {
                      setPlatformSlugTouched(true);
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
                  placeholder="Bir cümlə — kart sub-mətni"
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
              <div className="mt-4 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">
                {platformError}
              </div>
            )}
            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={() => { setPlatformModal(null); setPlatformError(null); }}
                className="rounded bg-admin-chip px-4 py-2 text-sm text-zinc-700"
              >
                İmtina
              </button>
              <button
                onClick={savePlatform}
                disabled={platformSaving}
                className="inline-flex items-center gap-2 rounded bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {platformSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Yadda saxla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
