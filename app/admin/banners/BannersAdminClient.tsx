"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, Plus, Edit2, Trash2, Upload, X, GripVertical, Eye, EyeOff } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { BANNER_SCOPES } from "@/lib/contentScopes";
import { useDialog } from "@/lib/dialogs";
import { BANNER_POSITIONS, bannerPreviewWrapClass, bannerPreviewGradient, bannerThemeClasses, type BannerPosition, type BannerTheme } from "@/components/bannerLayout";

type BannerScope = string;

type Banner = {
  id: string;
  title: string | null;
  subtitle: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
  linkUrl: string | null;
  actionType: "LINK" | "ADD_TO_CART";
  gameId: string | null;
  game?: { id: string; title: string; imageUrl: string | null } | null;
  serviceProductId: string | null;
  serviceProduct?: { id: string; title: string; imageUrl: string | null } | null;
  contentPosition: string;
  contentPositionMobile: string;
  contentTheme: string;
  isActive: boolean;
  sortOrder: number;
  scope: BannerScope;
};

const SCOPE_OPTIONS = BANNER_SCOPES;

type EditForm = {
  title: string;
  subtitle: string;
  imageUrl: string;
  mobileImageUrl: string;
  linkUrl: string;
  actionType: "LINK" | "ADD_TO_CART";
  // Səbət-banneri ya bir oyuna (productKind="GAME", gameId), ya da bir
  // xidmət/məhsula (productKind="SERVICE", serviceProductId) bağlanır.
  productKind: "GAME" | "SERVICE" | "";
  gameId: string;
  serviceProductId: string;
  productLabel: string;
  productImageUrl: string | null;
  productFinalAzn: number | null;
  productOriginalAzn: number | null;
  productDiscountPct: number | null;
  contentPosition: BannerPosition;
  contentPositionMobile: BannerPosition;
  contentTheme: BannerTheme;
  isActive: boolean;
  sortOrder: string;
  scope: BannerScope;
};

type ProductOption = {
  id: string;
  kind: "GAME" | "SERVICE";
  productType: string;
  title: string;
  imageUrl: string | null;
  finalAzn?: number;
  originalAzn?: number | null;
  discountPct?: number | null;
};

// Xidmət məhsul tiplərini insanların oxuya biləcəyi etiketlərə çevirir.
const PRODUCT_TYPE_LABELS: Record<string, string> = {
  GAME: "Oyun",
  STREAMING: "Streaming",
  PLATFORM: "Platforma",
  PS_PLUS: "PS Plus",
  EA_PLAY: "EA Play",
  TRY_BALANCE: "TL balans",
  ACCOUNT_CREATION: "Hesab açılışı",
  EPIC_ACCOUNT_CREATION: "Epic hesab",
  PUBG_UC: "PUBG UC",
  POINT_BLANK_TG: "Point Blank",
  HONSELL_GIFT_CARD: "Hədiyyə kartı",
};

function productTypeLabel(t: string): string {
  return PRODUCT_TYPE_LABELS[t] ?? t;
}

// 9-nöqtəli mövqe seçici — hər düymə seçilmiş küncü vizual göstərir.
function PositionGrid({ value, onChange }: { value: BannerPosition; onChange: (p: BannerPosition) => void }) {
  return (
    <div className="inline-grid grid-cols-3 gap-1 rounded-lg border border-admin-line bg-admin-card p-1">
      {BANNER_POSITIONS.map((p) => {
        const [v, h] = p.key.split("_");
        const vAlign = v === "TOP" ? "items-start" : v === "MIDDLE" ? "items-center" : "items-end";
        const hAlign = h === "LEFT" ? "justify-start" : h === "CENTER" ? "justify-center" : "justify-end";
        const active = value === p.key;
        return (
          <button
            key={p.key}
            type="button"
            title={p.label}
            onClick={() => onChange(p.key as BannerPosition)}
            className={`flex h-7 w-11 rounded p-1.5 transition ${vAlign} ${hAlign} ${active ? "bg-violet-600" : "bg-admin-chip hover:bg-admin-chip2"}`}
          >
            <span className={`block h-1.5 w-3.5 rounded-full ${active ? "bg-white" : "bg-zinc-400"}`} />
          </button>
        );
      })}
    </div>
  );
}

export default function BannersAdminClient() {
  const dialog = useDialog();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [activeScope, setActiveScope] = useState<BannerScope>("HOME");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | "NEW" | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ title: "", subtitle: "", imageUrl: "", mobileImageUrl: "", linkUrl: "", actionType: "LINK", productKind: "", gameId: "", serviceProductId: "", productLabel: "", productImageUrl: null, productFinalAzn: null, productOriginalAzn: null, productDiscountPct: null, contentPosition: "BOTTOM_LEFT", contentPositionMobile: "BOTTOM_LEFT", contentTheme: "LIGHT", isActive: true, sortOrder: "0", scope: "HOME" });
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState<"desktop" | "mobile" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mobileFileInputRef = useRef<HTMLInputElement>(null);
  const [productQuery, setProductQuery] = useState("");
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  async function persistOrder(ordered: Banner[]) {
    await fetch("/api/admin/banners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "REORDER", ids: ordered.map((b) => b.id) }),
    });
  }

  function onDragStart(id: string) {
    setDragId(id);
  }

  function onDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    if (id !== dragOverId) setDragOverId(id);
  }

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setDragOverId(null);
      return;
    }
    setBanners((prev) => {
      const fromIdx = prev.findIndex((b) => b.id === dragId);
      const toIdx = prev.findIndex((b) => b.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      const reindexed = next.map((b, i) => ({ ...b, sortOrder: i }));
      persistOrder(reindexed);
      return reindexed;
    });
    setDragId(null);
    setDragOverId(null);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/banners?scope=${activeScope}`);
    if (res.ok) setBanners(await res.json());
    setLoading(false);
  }, [activeScope]);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setSaveError(null);
    setEditingId("NEW");
    setEditForm({ title: "", subtitle: "", imageUrl: "", mobileImageUrl: "", linkUrl: "", actionType: "ADD_TO_CART", productKind: "", gameId: "", serviceProductId: "", productLabel: "", productImageUrl: null, productFinalAzn: null, productOriginalAzn: null, productDiscountPct: null, contentPosition: "BOTTOM_LEFT", contentPositionMobile: "BOTTOM_LEFT", contentTheme: "LIGHT", isActive: true, sortOrder: String(banners.length), scope: activeScope });
    setProductQuery("");
    setProductOptions([]);
  }

  function openEdit(b: Banner) {
    setSaveError(null);
    setEditingId(b.id);
    setEditForm({
      title: b.title ?? "",
      subtitle: b.subtitle ?? "",
      imageUrl: b.imageUrl,
      mobileImageUrl: b.mobileImageUrl ?? "",
      linkUrl: b.linkUrl ?? "",
      actionType: b.actionType ?? "LINK",
      productKind: b.serviceProductId ? "SERVICE" : b.gameId ? "GAME" : "",
      gameId: b.gameId ?? "",
      serviceProductId: b.serviceProductId ?? "",
      productLabel: b.game?.title ?? b.serviceProduct?.title ?? "",
      productImageUrl: b.game?.imageUrl ?? b.serviceProduct?.imageUrl ?? null,
      productFinalAzn: null,
      productOriginalAzn: null,
      productDiscountPct: null,
      contentPosition: (b.contentPosition as BannerPosition) ?? "BOTTOM_LEFT",
      contentPositionMobile: (b.contentPositionMobile as BannerPosition) ?? "BOTTOM_LEFT",
      contentTheme: (b.contentTheme as BannerTheme) ?? "LIGHT",
      isActive: b.isActive,
      sortOrder: String(b.sortOrder),
      scope: b.scope ?? "HOME",
    });
    setProductQuery("");
    setProductOptions([]);
  }

  useEffect(() => {
    if (editForm.actionType !== "ADD_TO_CART") return;
    const q = productQuery.trim();
    if (q.length < 2) { setProductOptions([]); return; }
    const t = setTimeout(async () => {
      setSearchingProducts(true);
      try {
        const res = await fetch(`/api/admin/banners/product-search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setProductOptions((data.results ?? []) as ProductOption[]);
        }
      } finally {
        setSearchingProducts(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [productQuery, editForm.actionType]);

  async function handleImageUpload(file: File, target: "desktop" | "mobile") {
    if (!file.type.startsWith("image/")) {
      await dialog.alert({ title: "Yanlış fayl tipi", message: "Yalnız şəkil faylı", tone: "warning" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      await dialog.alert({ title: "Fayl ölçüsü çox böyükdür", message: "Fayl çox böyükdür (max 10 MB)", tone: "warning" });
      return;
    }
    setUploadingImage(target);
    try {
      const init = await fetch("/api/admin/banners/image-upload", {
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
      const { error: upErr } = await supabase.storage.from(initData.bucket).uploadToSignedUrl(initData.path, initData.token, file);
      if (upErr) {
        await dialog.alert({ title: "Upload alınmadı", message: upErr.message, tone: "danger" });
        return;
      }
      setEditForm((prev) => target === "desktop"
        ? { ...prev, imageUrl: initData.publicUrl }
        : { ...prev, mobileImageUrl: initData.publicUrl });
    } finally {
      setUploadingImage(null);
    }
  }

  async function saveBanner() {
    // Oyun seçilibsə, server avtomatik olaraq oyunun heroImageUrl-ini istifadə
    // edəcək — ona görə şəkil yalnız LINK action-da məcburidir.
    if (editForm.actionType === "LINK" && !editForm.imageUrl) {
      setSaveError("Link banneri üçün şəkil mütləqdir!");
      return;
    }
    if (editForm.actionType === "ADD_TO_CART" && !editForm.gameId && !editForm.serviceProductId) {
      setSaveError("Məhsul seçməlisiniz!");
      return;
    }
    setSaving(true);
    setSaveError(null);
    const res = await fetch("/api/admin/banners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "UPSERT",
        id: editingId === "NEW" ? undefined : editingId,
        title: editForm.title,
        subtitle: editForm.subtitle,
        imageUrl: editForm.imageUrl,
        mobileImageUrl: editForm.mobileImageUrl || null,
        linkUrl: editForm.linkUrl,
        actionType: editForm.actionType,
        gameId: editForm.gameId || null,
        serviceProductId: editForm.serviceProductId || null,
        contentPosition: editForm.contentPosition,
        contentPositionMobile: editForm.contentPositionMobile,
        contentTheme: editForm.contentTheme,
        isActive: editForm.isActive,
        sortOrder: Number(editForm.sortOrder || 0),
        scope: editForm.scope,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setSaveError(d.error ?? "Yadda saxlanmadı");
      setSaving(false);
      return;
    }
    setSaving(false);
    setEditingId(null);
    load();
  }

  async function toggleActive(b: Banner) {
    // Optimistik yeniləmə — istifadəçi dərhal nəticəni görsün, sonra server-i sinxronlaşdır.
    const nextActive = !b.isActive;
    setBanners((prev) => prev.map((x) => (x.id === b.id ? { ...x, isActive: nextActive } : x)));
    const res = await fetch("/api/admin/banners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "TOGGLE_ACTIVE", id: b.id, isActive: nextActive }),
    });
    if (!res.ok) {
      // Rollback
      setBanners((prev) => prev.map((x) => (x.id === b.id ? { ...x, isActive: b.isActive } : x)));
      await dialog.alert({ title: "Status dəyişmədi", tone: "danger" });
    }
  }

  async function deleteBanner(id: string) {
    if (
      !(await dialog.confirm({
        title: "Banneri sil?",
        confirmLabel: "Sil",
        tone: "danger",
      }))
    )
      return;
    await fetch("/api/admin/banners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DELETE", id }),
    });
    load();
  }

  if (loading) return <div className="py-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {SCOPE_OPTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setActiveScope(s.key)}
              title={s.description}
              className={`rounded-full px-4 py-2 text-sm transition ${
                activeScope === s.key
                  ? "bg-violet-600 text-white"
                  : "bg-admin-card text-zinc-700 hover:bg-admin-chip2"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">
          <Plus className="h-4 w-4" /> Yeni Banner
        </button>
      </div>
      <p className="text-xs text-zinc-500">
        {SCOPE_OPTIONS.find((s) => s.key === activeScope)?.description}
      </p>

      {banners.length === 0 ? (
        <div className="rounded-xl border border-dashed border-admin-line bg-admin-card py-16 text-center text-zinc-500">
          Hələ heç bir banner yoxdur. &ldquo;Yeni Banner&rdquo; düyməsini klikləyin.
        </div>
      ) : (
        <div className="space-y-3">
          {banners.map((b) => (
            <div
              key={b.id}
              draggable
              onDragStart={() => onDragStart(b.id)}
              onDragOver={(e) => onDragOver(e, b.id)}
              onDrop={() => onDrop(b.id)}
              onDragEnd={() => { setDragId(null); setDragOverId(null); }}
              className={`flex items-center gap-4 rounded-xl border bg-admin-card p-4 transition ${
                dragId === b.id ? "opacity-40" : ""
              } ${dragOverId === b.id && dragId !== b.id ? "border-violet-500" : "border-admin-line"}`}
            >
              <GripVertical className="h-5 w-5 shrink-0 cursor-grab text-zinc-500 active:cursor-grabbing" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.imageUrl} alt={b.title ?? ""} className="h-16 w-28 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-zinc-800">{b.title || <span className="text-zinc-600">Başlıq yoxdur</span>}</p>
                {b.subtitle && <p className="truncate text-sm text-zinc-500">{b.subtitle}</p>}
                {b.actionType === "ADD_TO_CART"
                  ? <p className="truncate text-xs text-emerald-600">Səbətə əlavə: {b.game?.title ?? b.serviceProduct?.title ?? "—"}</p>
                  : b.linkUrl && <p className="truncate text-xs text-violet-600">{b.linkUrl}</p>}
                <div className="mt-1 flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${b.isActive ? "bg-emerald-500/20 text-emerald-600" : "bg-admin-chip text-zinc-500"}`}>
                    {b.isActive ? "Aktiv" : "Passiv"}
                  </span>
                  <span className="text-[11px] text-zinc-600">Sıra: {b.sortOrder}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggleActive(b)}
                  title={b.isActive ? "Passiv et" : "Aktiv et"}
                  className={`rounded p-2 transition ${b.isActive ? "text-emerald-600 hover:text-emerald-700" : "text-zinc-500 hover:text-zinc-700"}`}
                >
                  {b.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <button onClick={() => openEdit(b)} className="rounded p-2 text-zinc-500 hover:text-violet-600"><Edit2 className="h-4 w-4" /></button>
                <button onClick={() => deleteBanner(b.id)} className="rounded p-2 text-zinc-500 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-admin-line bg-admin-card p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-bold">{editingId === "NEW" ? "Yeni Banner" : "Banneri Redaktə et"}</h3>

            {/* Canlı ön-izləmə — user tərəfdə necə görünəcəyini göstərir */}
            {(() => {
              const img = previewDevice === "mobile"
                ? (editForm.mobileImageUrl || editForm.imageUrl || editForm.productImageUrl)
                : (editForm.imageUrl || editForm.productImageUrl);
              const pTitle = editForm.title.trim() || editForm.productLabel;
              const pSubtitle = editForm.subtitle.trim();
              const isCart = editForm.actionType === "ADD_TO_CART";
              const th = bannerThemeClasses(editForm.contentTheme);
              return (
                <div className="mb-5">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-zinc-700">Ön izləmə</p>
                    <div className="flex gap-0.5 rounded-lg bg-admin-chip p-0.5">
                      {(["desktop", "mobile"] as const).map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setPreviewDevice(d)}
                          className={`rounded px-3 py-1 text-xs font-medium transition ${previewDevice === d ? "bg-violet-600 text-white" : "text-zinc-600 hover:text-zinc-900"}`}
                        >
                          {d === "desktop" ? "Desktop" : "Mobil"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className={`relative overflow-hidden rounded-xl border border-admin-line bg-zinc-800 ${previewDevice === "mobile" ? "mx-auto aspect-[4/5] max-w-[240px]" : "aspect-[16/9] w-full"}`}>
                    {img ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 grid place-items-center text-xs text-zinc-400">Şəkil seçin / yükləyin</div>
                    )}
                    <div className={`absolute inset-0 ${bannerPreviewGradient(editForm.contentTheme, previewDevice)}`} />
                    {editForm.productDiscountPct != null && (
                      <div className="absolute right-2 top-2 rounded-lg bg-gradient-to-br from-rose-500 to-amber-400 px-2 py-1 text-center text-white shadow">
                        <span className="block text-[7px] font-black uppercase leading-none tracking-wider">Endirim</span>
                        <span className="text-xs font-black leading-none">-%{editForm.productDiscountPct}</span>
                      </div>
                    )}
                    <div className={bannerPreviewWrapClass(previewDevice === "mobile" ? editForm.contentPositionMobile : editForm.contentPosition)}>
                      {pTitle && <p className={`text-base font-black leading-tight ${th.title}`}>{pTitle}</p>}
                      {pSubtitle && <p className={`mt-1 text-[11px] leading-snug ${th.subtitle}`}>{pSubtitle}</p>}
                      {isCart && editForm.productFinalAzn != null && (
                        <p className="mt-1.5 flex items-baseline gap-1.5">
                          {editForm.productOriginalAzn != null && (
                            <span className={`text-[11px] line-through ${th.priceOriginal}`}>{editForm.productOriginalAzn.toFixed(2)}₼</span>
                          )}
                          <span className={`text-sm font-extrabold ${th.priceFinal}`}>{editForm.productFinalAzn.toFixed(2)}₼</span>
                        </p>
                      )}
                      <span className="mt-2 inline-flex items-center rounded-full bg-white px-3 py-1 text-[11px] font-bold text-zinc-900">
                        {isCart ? "Səbətə Əlavə Et" : "Kəşfet →"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="space-y-4">
              <label className="block text-sm text-zinc-700">
                Bannerin yeri
                <select
                  value={editForm.scope}
                  onChange={(e) => setEditForm({ ...editForm, scope: e.target.value as BannerScope })}
                  className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-violet-500 focus:outline-none"
                >
                  {SCOPE_OPTIONS.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </label>

              <label className="block text-sm text-zinc-700">
                Klikləndikdə
                <select
                  value={editForm.actionType}
                  onChange={(e) => setEditForm({ ...editForm, actionType: e.target.value as "LINK" | "ADD_TO_CART" })}
                  className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-violet-500 focus:outline-none"
                >
                  <option value="ADD_TO_CART">Səbətə əlavə et (məhsul)</option>
                  <option value="LINK">Linkə yönləndir</option>
                </select>
              </label>

              {editForm.actionType === "ADD_TO_CART" && (
                <div>
                  <p className="mb-1 text-sm text-zinc-700">Məhsul <span className="text-rose-600">*</span>
                    <span className="ml-2 text-xs text-zinc-500">(oyun, streaming, platforma, PS Plus və s. — şəkil, ad və qiymət avtomatik götürülür)</span>
                  </p>
                  {(editForm.gameId || editForm.serviceProductId) && editForm.productLabel ? (
                    <div className="flex items-center gap-3 rounded-xl border border-admin-line bg-admin-card p-3">
                      {editForm.productImageUrl && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={editForm.productImageUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-900">{editForm.productLabel}</p>
                        {editForm.productFinalAzn != null && (
                          <p className="mt-0.5 text-xs text-zinc-600">
                            {editForm.productOriginalAzn != null && (
                              <span className="line-through">{editForm.productOriginalAzn.toFixed(2)}₼</span>
                            )}{" "}
                            <span className="font-semibold text-emerald-600">{editForm.productFinalAzn.toFixed(2)}₼</span>
                            {editForm.productDiscountPct != null && (
                              <span className="ml-2 rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-bold text-cyan-700">
                                -%{editForm.productDiscountPct}
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditForm((p) => ({ ...p, productKind: "", gameId: "", serviceProductId: "", productLabel: "", productImageUrl: null, productFinalAzn: null, productOriginalAzn: null, productDiscountPct: null }))}
                        className="text-zinc-500 hover:text-rose-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        value={productQuery}
                        onChange={(e) => setProductQuery(e.target.value)}
                        placeholder="Məhsul adı yaz (min 2 hərf): oyun, Spotify, YouTube..."
                        className="w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-violet-500 focus:outline-none"
                      />
                      {(searchingProducts || productOptions.length > 0) && (
                        <div className="mt-2 max-h-56 overflow-y-auto rounded border border-admin-line bg-admin-card">
                          {searchingProducts && <div className="px-3 py-2 text-xs text-zinc-500">Axtarılır...</div>}
                          {productOptions.map((g) => (
                            <button
                              key={`${g.kind}:${g.id}`}
                              type="button"
                              onClick={() => {
                                setEditForm((p) => ({
                                  ...p,
                                  productKind: g.kind,
                                  gameId: g.kind === "GAME" ? g.id : "",
                                  serviceProductId: g.kind === "SERVICE" ? g.id : "",
                                  productLabel: g.title,
                                  productImageUrl: g.imageUrl,
                                  productFinalAzn: g.finalAzn ?? null,
                                  productOriginalAzn: g.originalAzn ?? null,
                                  productDiscountPct: g.discountPct ?? null,
                                }));
                                setProductQuery("");
                                setProductOptions([]);
                              }}
                              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-zinc-800 hover:bg-admin-chip2"
                            >
                              {g.imageUrl && (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={g.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                              )}
                              <div className="min-w-0 flex-1">
                                <span className="flex items-center gap-2">
                                  <span className="truncate">{g.title}</span>
                                  <span className="shrink-0 rounded bg-admin-chip px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">{productTypeLabel(g.productType)}</span>
                                </span>
                                {g.finalAzn != null && (
                                  <span className="block text-[11px] text-zinc-500">
                                    {g.finalAzn.toFixed(2)}₼
                                    {g.discountPct != null && <span className="ml-1 text-cyan-600">-%{g.discountPct}</span>}
                                  </span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Desktop Image Upload */}
              <div>
                <p className="mb-1 text-sm text-zinc-700">
                  Desktop şəkli {editForm.actionType === "LINK" ? <span className="text-rose-600">*</span> : <span className="text-xs text-zinc-500">(opsional — boş buraxılarsa, məhsulun şəkli istifadə olunacaq)</span>}
                  <span className="ml-2 text-xs text-zinc-500">(geniş, 16:9)</span>
                </p>
                <p className="mb-2 text-[11px] text-zinc-500">
                  Tövsiyə olunan ölçü: <b className="text-zinc-700">1920×1080px</b> (16:9 aspekt). Şəkil ekran ölçüsünə görə mərkəzdən kəsilir (geniş ekranda ~16:9, planşetdə 2:1), ona görə əsas obyekt və mətn mərkəzdə olsun.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, "desktop"); e.target.value = ""; }}
                />
                {editForm.imageUrl ? (
                  <div className="relative overflow-hidden rounded-xl border border-admin-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={editForm.imageUrl} alt="" className="h-40 w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, imageUrl: "" })}
                      className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-2 right-2 rounded-lg bg-black/60 px-3 py-1.5 text-xs text-white hover:bg-black/80"
                    >
                      Dəyiş
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={uploadingImage !== null}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-36 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-admin-line2 bg-admin-card text-sm text-zinc-600 hover:border-violet-500 hover:text-violet-600 disabled:opacity-50"
                  >
                    {uploadingImage === "desktop" ? <><Loader2 className="h-4 w-4 animate-spin" /> Yüklənir...</> : <><Upload className="h-5 w-5" /> Şəkil seç (PNG/JPEG/WEBP, max 10 MB)</>}
                  </button>
                )}
              </div>

              {/* Mobile Image Upload (optional) */}
              <div>
                <p className="mb-1 text-sm text-zinc-700">
                  Mobil şəkli <span className="text-zinc-500 text-xs">(opsional)</span>
                  <span className="ml-2 text-xs text-zinc-500">(portret, 4:5 tövsiyə olunur)</span>
                </p>
                <p className="mb-2 text-xs text-zinc-500">
                  Boş buraxılarsa, telefonda da desktop şəkli istifadə olunacaq.
                </p>
                <p className="mb-2 text-[11px] text-zinc-500">
                  Tövsiyə olunan ölçü: <b className="text-zinc-700">1080×1350px</b> (4:5 aspekt) — telefon ekranında 4:5 nisbətdə render olunur.
                </p>
                <input
                  ref={mobileFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, "mobile"); e.target.value = ""; }}
                />
                {editForm.mobileImageUrl ? (
                  <div className="relative overflow-hidden rounded-xl border border-admin-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={editForm.mobileImageUrl} alt="" className="mx-auto h-56 w-auto object-contain" />
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, mobileImageUrl: "" })}
                      className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => mobileFileInputRef.current?.click()}
                      className="absolute bottom-2 right-2 rounded-lg bg-black/60 px-3 py-1.5 text-xs text-white hover:bg-black/80"
                    >
                      Dəyiş
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={uploadingImage !== null}
                    onClick={() => mobileFileInputRef.current?.click()}
                    className="flex h-32 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-admin-line2 bg-admin-card text-sm text-zinc-600 hover:border-violet-500 hover:text-violet-600 disabled:opacity-50"
                  >
                    {uploadingImage === "mobile" ? <><Loader2 className="h-4 w-4 animate-spin" /> Yüklənir...</> : <><Upload className="h-5 w-5" /> Mobil şəkil seç</>}
                  </button>
                )}
              </div>

              <label className="block text-sm text-zinc-700">
                Başlıq (ixtiyari)
                <span className="ml-2 text-xs text-zinc-500">Boş buraxılarsa, məhsulun adı göstərilir</span>
                <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-violet-500 focus:outline-none" placeholder="Məs: Yay Endirimi" />
              </label>
              <label className="block text-sm text-zinc-700">
                Alt başlıq (ixtiyari)
                <input value={editForm.subtitle} onChange={(e) => setEditForm({ ...editForm, subtitle: e.target.value })} className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-violet-500 focus:outline-none" placeholder="Məs: Seçilmiş oyunlarda 50%-ə qədər endirim" />
              </label>

              {/* Yazıların yeri (9-nöqtəli ızgara — desktop + mobil ayrıca) + mətn teması */}
              <div>
                <p className="mb-1.5 text-sm text-zinc-700">Yazıların yeri <span className="text-xs text-zinc-500">(desktop və mobil üçün ayrıca)</span></p>
                <div className="flex flex-wrap gap-6">
                  <div>
                    <p className="mb-1 text-xs font-medium text-zinc-500">Desktop</p>
                    <PositionGrid value={editForm.contentPosition} onChange={(p) => setEditForm({ ...editForm, contentPosition: p })} />
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-zinc-500">Mobil</p>
                    <PositionGrid value={editForm.contentPositionMobile} onChange={(p) => setEditForm({ ...editForm, contentPositionMobile: p })} />
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-zinc-500">Mətn rəngi</p>
                    <div className="flex flex-col gap-1.5">
                      {([
                        { key: "LIGHT", label: "Açıq", hint: "tünd şəkil üçün" },
                        { key: "DARK", label: "Tünd", hint: "açıq şəkil üçün" },
                      ] as const).map((t) => (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => setEditForm({ ...editForm, contentTheme: t.key })}
                          className={`rounded-lg border px-3 py-1.5 text-left text-sm transition ${editForm.contentTheme === t.key ? "border-violet-500 bg-violet-600/10 text-violet-700" : "border-admin-line bg-admin-card text-zinc-700 hover:bg-admin-chip2"}`}
                        >
                          {t.label} <span className="text-xs text-zinc-500">({t.hint})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {editForm.actionType === "LINK" && (
                <label className="block text-sm text-zinc-700">
                  Link (ixtiyari)
                  <input value={editForm.linkUrl} onChange={(e) => setEditForm({ ...editForm, linkUrl: e.target.value })} className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-violet-500 focus:outline-none" placeholder="/hediyye-kartlari" />
                </label>
              )}
              <div className="flex gap-4">
                <label className="block flex-1 text-sm text-zinc-700">
                  Sıralama
                  <input type="number" value={editForm.sortOrder} onChange={(e) => setEditForm({ ...editForm, sortOrder: e.target.value })} className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-violet-500 focus:outline-none" />
                </label>
                <label className="flex items-end gap-2 pb-2 text-sm text-zinc-700">
                  <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })} /> Aktivdir
                </label>
              </div>
            </div>

            {saveError && <div className="mt-4 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">{saveError}</div>}

            <div className="mt-8 flex justify-end gap-3">
              <button onClick={() => { setEditingId(null); setSaveError(null); }} className="rounded bg-admin-chip px-4 py-2 text-sm text-zinc-700 hover:bg-admin-chip2">İmtina</button>
              <button onClick={saveBanner} disabled={saving || uploadingImage !== null} className="inline-flex items-center gap-2 rounded bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-50">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Yadda saxla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
