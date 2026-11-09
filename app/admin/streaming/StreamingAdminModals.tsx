"use client";

import { useRef, useState } from "react";
import { Loader2, Lock, Trash2, Upload } from "lucide-react";
import { useDialog } from "@/lib/dialogs";
import { uploadAdminImage } from "@/lib/uploadImageClient";
import {
  ACCESS_MODE_META,
  childPlatformCode,
  featuresFromText,
  featuresToText,
  streamingCode,
  streamingSlug,
  type StreamingAccessMode,
} from "@/lib/streamingAccess";
import { ErrorNote, Field, Modal, btn, inputCls, postStreaming } from "./adminUi";
import {
  formatAzn,
  readProductMeta,
  type AdminPlatform,
  type AdminProduct,
  type ServiceView,
  type TierView,
} from "./streamingAdminModel";

export const DEVICES = [
  { value: "tv", label: "Televizor" },
  { value: "computer", label: "Kompüter" },
  { value: "phone", label: "Telefon" },
  { value: "tablet", label: "Planşet" },
];

/** Admin şəkil yükləmə (5 MB, yalnız şəkil). */
export async function uploadStreamingImage(file: File): Promise<{ url: string } | { error: string }> {
  if (!file.type.startsWith("image/")) return { error: "Yalnız şəkil faylı yükləyə bilərsiniz." };
  if (file.size > 5 * 1024 * 1024) return { error: "Fayl çox böyükdür (max 5 MB)." };
  const up = await uploadAdminImage("/api/admin/services/image-upload", file);
  if (!up.ok) return { error: up.error || "Yükləmə alınmadı." };
  return { url: String(up.url) };
}

// ─── Xidmət (üst platforma) ────────────────────────────────────────────────

export function ServiceModal({
  platform,
  nextSortOrder,
  onClose,
  onSaved,
}: {
  /** Yoxdursa yeni xidmət. */
  platform?: AdminPlatform;
  nextSortOrder: number;
  onClose: () => void;
  onSaved: (code: string) => Promise<void>;
}) {
  const isCreate = !platform;
  const [label, setLabel] = useState(platform?.label ?? "");
  const [slug, setSlug] = useState(platform?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!isCreate);
  const [tagline, setTagline] = useState(platform?.tagline ?? "");
  const [description, setDescription] = useState(platform?.description ?? "");
  const [sortOrder, setSortOrder] = useState(String(platform?.sortOrder ?? nextSortOrder));
  const [isActive, setIsActive] = useState(platform?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const code = platform?.code ?? streamingCode(label);
  const effectiveSlug = slugTouched ? streamingSlug(slug) : streamingSlug(label);

  async function save() {
    if (!label.trim()) return setError("Ad tələb olunur.");
    if (!code) return setError("Addan kod qurulmadı — latın hərfi və ya rəqəm yazın.");
    setSaving(true);
    setError(null);
    const res = await postStreaming<AdminPlatform>({
      action: "UPSERT_PLATFORM",
      ...(isCreate ? { mode: "create" } : {}),
      code,
      label: label.trim(),
      slug: effectiveSlug,
      category: platform?.category ?? "STREAMING",
      tagline: tagline.trim(),
      description: description.trim(),
      sortOrder: Number(sortOrder || 0),
      isActive,
    });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    await onSaved(res.data.code);
    onClose();
  }

  return (
    <Modal
      title={isCreate ? "Yeni xidmət" : `${platform!.label} — redaktə`}
      subtitle={isCreate ? "Məs: HBO Max, Disney+, Prime Video. Planları (şəxsi / paylaşımlı) sonra əlavə edəcəksən." : undefined}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={btn.secondary}>
            İmtina
          </button>
          <button type="button" onClick={save} disabled={saving} className={btn.primary}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isCreate ? "Yarat" : "Yadda saxla"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Ad" hint={isCreate && code ? <>Kod: <span className="font-mono">{code}</span></> : undefined}>
          <input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="HBO Max" className={inputCls} />
        </Field>
        <Field label="Sayt ünvanı" hint={<span className="font-mono">/streaming/{effectiveSlug || "…"}</span>}>
          <input
            value={slugTouched ? slug : effectiveSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            className={`${inputCls} font-mono`}
          />
        </Field>
        <Field label="Qısa təsvir" hint="Kart alt-mətni və axtarış nəticəsi təsviri.">
          <input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Premium serial və film abunəliyi" className={inputCls} />
        </Field>
        <Field label="Ətraflı təsvir (SEO)">
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sıralama" hint="Kiçik rəqəm əvvəl.">
            <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className={inputCls} />
          </Field>
          <label className="mt-5 flex items-center gap-2 self-start rounded-lg border border-admin-line px-3 py-2 text-sm text-zinc-700">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Aktiv (gizli deyil)
          </label>
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>
    </Modal>
  );
}

// ─── Plan (Şəxsi / Paylaşımlı) ─────────────────────────────────────────────

export function TierModal({
  service,
  accessMode,
  tier,
  nextSortOrder,
  onClose,
  onSaved,
}: {
  service: ServiceView;
  accessMode: StreamingAccessMode;
  /** Yoxdursa yeni plan. */
  tier?: TierView;
  nextSortOrder: number;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const isCreate = !tier;
  const locked = tier?.locked ?? false;
  const [tierName, setTierName] = useState(tier?.name ?? "");
  const [featuresText, setFeaturesText] = useState(featuresToText(tier?.features ?? []));
  const [devices, setDevices] = useState<string[]>(tier?.devices ?? DEVICES.map((d) => d.value));
  const [vpnRequired, setVpnRequired] = useState(tier?.vpnRequired ?? false);
  const [isActive, setIsActive] = useState(tier?.platform.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = ACCESS_MODE_META[accessMode];
  const codePreview = isCreate && tierName.trim() ? childPlatformCode(service.code, accessMode, tierName) : "";

  async function save() {
    if (!locked && !tierName.trim()) return setError("Plan adı tələb olunur.");
    setSaving(true);
    setError(null);
    const features = featuresFromText(featuresText);
    const res = isCreate
      ? await postStreaming({
          action: "UPSERT_PLATFORM",
          mode: "create",
          parentCode: service.code,
          accessMode,
          tierName: tierName.trim(),
          features,
          devices,
          vpnRequired,
          isActive: true,
          sortOrder: nextSortOrder,
        })
      : await postStreaming({
          action: "UPSERT_PLATFORM",
          code: tier!.code,
          slug: tier!.platform.slug,
          sortOrder: tier!.platform.sortOrder,
          isActive,
          ...(locked
            ? { label: tier!.platform.label }
            : { tierName: tierName.trim(), label: `${service.label} ${tierName.trim()}`, features }),
        });
    if (!res.ok) {
      setSaving(false);
      return setError(res.error);
    }
    // Cihaz / VPN mövcud paketlərə də yazılır (vitrin paket metadata-sını oxuyur).
    const accessChanged =
      !isCreate &&
      (vpnRequired !== tier!.vpnRequired ||
        devices.length !== tier!.devices.length ||
        devices.some((d) => !tier!.devices.includes(d)));
    if (accessChanged) {
      const acc = await postStreaming({ action: "SET_SERVICE_ACCESS", service: tier!.code, devices, vpnRequired });
      if (!acc.ok) {
        setSaving(false);
        return setError(acc.error);
      }
    }
    setSaving(false);
    await onSaved();
    onClose();
  }

  return (
    <Modal
      title={isCreate ? `${service.label} — yeni ${meta.label.toLowerCase()} planı` : `${service.label} ${tier!.name}`}
      subtitle={meta.description}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" onClick={onClose} className={btn.secondary}>
            İmtina
          </button>
          <button type="button" onClick={save} disabled={saving} className={btn.primary}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isCreate ? "Planı yarat" : "Yadda saxla"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {locked && (
          <p className="flex items-start gap-2 rounded-lg border border-admin-line bg-admin-chip/60 px-3 py-2 text-xs leading-relaxed text-zinc-600">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Netflix planının adı və xüsusiyyətləri koddadır və CRM ilə bağlıdır. Burada cihazları, VPN-i və görünməni
            dəyişə bilərsən; qiymətlər plan kartındakı cədvəldədir.
          </p>
        )}
        <Field
          label="Plan adı"
          hint={codePreview ? <>Kod: <span className="font-mono">{codePreview}</span> — sonra dəyişmir.</> : "Məs: Standart, Premium, Reklamsız."}
        >
          <input
            autoFocus={isCreate}
            disabled={locked}
            value={tierName}
            onChange={(e) => setTierName(e.target.value)}
            placeholder="Standart"
            className={inputCls}
          />
        </Field>

        {locked ? (
          tier!.features.length > 0 && (
            <ul className="space-y-1 text-xs text-zinc-600">
              {tier!.features.map((f, i) => (
                <li key={i}>• {f.text}</li>
              ))}
            </ul>
          )
        ) : (
          <Field
            label="Xüsusiyyətlər (vitrində plan kartında)"
            hint={<>Hər sətir bir bənd. Başına <b>+</b> yaşıl, <b>-</b> qırmızı, <b>!</b> sarı nişan qoyur.</>}
          >
            <textarea
              rows={4}
              value={featuresText}
              onChange={(e) => setFeaturesText(e.target.value)}
              placeholder={"+ 4K Ultra HD\n+ Eyni anda 2 ekran\n- TV ilə istifadə olunmur"}
              className={`${inputCls} font-mono text-xs`}
            />
          </Field>
        )}

        <div>
          <p className="mb-1 text-xs font-semibold text-zinc-600">İzlənilə bilən cihazlar</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {DEVICES.map((d) => {
              const checked = devices.includes(d.value);
              return (
                <label
                  key={d.value}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition ${
                    checked ? "border-violet-500/45 bg-violet-500/10 text-violet-700" : "border-admin-line text-zinc-600"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => setDevices((cur) => (checked ? cur.filter((x) => x !== d.value) : [...cur, d.value]))}
                  />
                  {d.label}
                </label>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-admin-line px-3 py-2 text-xs text-zinc-700">
            <input type="checkbox" checked={vpnRequired} onChange={(e) => setVpnRequired(e.target.checked)} />
            VPN lazımdır
          </label>
          {!isCreate && (
            <label className="flex items-center gap-2 rounded-lg border border-admin-line px-3 py-2 text-xs text-zinc-700">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Vitrində göstər
            </label>
          )}
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>
    </Modal>
  );
}

// ─── Paket detalı (cədvəl xanasının "⋯" düyməsi) ───────────────────────────

export function PackageModal({
  product,
  onClose,
  onSaved,
}: {
  product: AdminProduct;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const dialog = useDialog();
  const m = readProductMeta(product);
  const [title, setTitle] = useState(product.title);
  const [description, setDescription] = useState(product.description ?? "");
  const [price, setPrice] = useState(formatAzn(product.priceAznCents));
  const [originalPrice, setOriginalPrice] = useState(m.originalPriceAznCents != null ? formatAzn(m.originalPriceAznCents) : "");
  const [sortOrder, setSortOrder] = useState(String(product.sortOrder));
  const [isActive, setIsActive] = useState(product.isActive);
  const [imageUrl, setImageUrl] = useState(product.imageUrl ?? "");
  const [busy, setBusy] = useState<null | "save" | "image" | "delete">(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function save() {
    setBusy("save");
    setError(null);
    const res = await postStreaming({
      action: "UPSERT_PRODUCT",
      id: product.id,
      title: title.trim(),
      description,
      isActive,
      sortOrder: Number(sortOrder || 0),
      service: m.service,
      variantSlug: m.variantSlug,
      durationMonths: m.durationMonths,
      seats: m.seats,
      priceAzn: Number(price.replace(",", ".")),
      originalPriceAzn: originalPrice.trim() ? Number(originalPrice.replace(",", ".")) : "",
    });
    setBusy(null);
    if (!res.ok) return setError(res.error);
    await onSaved();
    onClose();
  }

  async function changeImage(file: File | null) {
    setBusy("image");
    setError(null);
    let next = "";
    if (file) {
      const up = await uploadStreamingImage(file);
      if ("error" in up) {
        setBusy(null);
        return setError(up.error);
      }
      next = up.url;
    }
    const res = await postStreaming({ action: "SET_PRODUCT_IMAGE", id: product.id, imageUrl: next });
    setBusy(null);
    if (!res.ok) return setError(res.error);
    setImageUrl(next);
    await onSaved();
  }

  async function remove() {
    const ok = await dialog.confirm({
      title: "Paketi sil?",
      message: (
        <p>
          «{product.title}» birdəfəlik silinsin? Satışdan çıxarmaq üçün silmək lazım deyil — cədvəldə xananı boşaltmaq
          kifayətdir.
        </p>
      ),
      confirmLabel: "Sil",
      tone: "danger",
    });
    if (!ok) return;
    setBusy("delete");
    const res = await postStreaming({ action: "DELETE_PRODUCT", id: product.id });
    setBusy(null);
    if (!res.ok) return setError(res.error);
    await onSaved();
    onClose();
  }

  return (
    <Modal
      title="Paket detalları"
      subtitle={`${m.durationMonths} ay${m.seats > 1 ? ` · ${m.seats} nəfər` : ""}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={remove} disabled={busy !== null} className={`${btn.danger} mr-auto`}>
            {busy === "delete" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Sil
          </button>
          <button type="button" onClick={onClose} className={btn.secondary}>
            İmtina
          </button>
          <button type="button" onClick={save} disabled={busy !== null} className={btn.primary}>
            {busy === "save" && <Loader2 className="h-4 w-4 animate-spin" />}
            Yadda saxla
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Ad (səbətdə və sifarişdə görünür)">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Qiymət (AZN)">
            <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Köhnə qiymət" hint="Boş = endirim göstərilmir.">
            <input
              inputMode="decimal"
              value={originalPrice}
              placeholder="məs: 15.00"
              onChange={(e) => setOriginalPrice(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
        <Field label="Təsvir">
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
        </Field>
        <div className="flex items-center gap-3">
          <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-admin-line bg-admin-chip">
            {imageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <span className="grid h-full place-items-center text-[10px] text-zinc-500">şəkil yoxdur</span>
            )}
          </div>
          <div className="flex flex-col items-start gap-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) changeImage(f);
              }}
            />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy !== null} className={btn.secondary}>
              {busy === "image" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {imageUrl ? "Paket şəklini dəyiş" : "Paketə ayrıca şəkil"}
            </button>
            {imageUrl && (
              <button type="button" onClick={() => changeImage(null)} disabled={busy !== null} className="text-[11px] text-zinc-500 hover:text-rose-600">
                Şəkli sil
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sıralama">
            <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className={inputCls} />
          </Field>
          <label className="mt-5 flex items-center gap-2 self-start rounded-lg border border-admin-line px-3 py-2 text-sm text-zinc-700">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Satışdadır
          </label>
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>
    </Modal>
  );
}
