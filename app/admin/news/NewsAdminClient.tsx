"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  X,
  Star,
  Image as ImageIcon,
  Upload,
  Home,
  Pin,
  PinOff,
} from "lucide-react";
import { NEWS_SCOPES } from "@/lib/contentScopes";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type NewsItem = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  coverImageUrl: string | null;
  category: string | null;
  scope: string;
  isFeatured: boolean;
  isPublished: boolean;
  showOnHome: boolean;
  publishedAt: string | null;
  sortOrder: number;
};

type EditForm = {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  coverImageUrl: string;
  category: string;
  scope: string;
  isFeatured: boolean;
  isPublished: boolean;
  showOnHome: boolean;
  publishedAt: string;
  sortOrder: string;
};

// Yaratma tabları — HOME daxil deyil. HOME üçün ayrıca seçim view-i var.
const CREATE_SCOPES = NEWS_SCOPES.filter((s) => s.key !== "HOME");

function emptyForm(scope: string): EditForm {
  return {
    title: "",
    slug: "",
    excerpt: "",
    body: "",
    coverImageUrl: "",
    category: "",
    scope,
    isFeatured: false,
    isPublished: true,
    showOnHome: false,
    publishedAt: "",
    sortOrder: "0",
  };
}

type View =
  | { kind: "scope"; scope: string }
  | { kind: "home" };

export default function NewsAdminClient() {
  const [view, setView] = useState<View>({ kind: "scope", scope: "PLAYSTATION" });
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | "NEW" | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(emptyForm("PLAYSTATION"));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const url =
      view.kind === "home"
        ? `/api/admin/news?view=ALL`
        : `/api/admin/news?scope=${view.scope}`;
    const res = await fetch(url);
    if (res.ok) {
      const d = await res.json();
      setItems(d.items ?? []);
    }
    setLoading(false);
  }, [view]);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    if (view.kind !== "scope") return;
    setSaveError(null);
    setEditingId("NEW");
    setEditForm({ ...emptyForm(view.scope), sortOrder: String(items.length) });
  }

  function openEdit(n: NewsItem) {
    setSaveError(null);
    setEditingId(n.id);
    setEditForm({
      title: n.title,
      slug: n.slug,
      excerpt: n.excerpt ?? "",
      body: n.body,
      coverImageUrl: n.coverImageUrl ?? "",
      category: n.category ?? "",
      scope: n.scope,
      isFeatured: n.isFeatured,
      isPublished: n.isPublished,
      showOnHome: n.showOnHome,
      publishedAt: n.publishedAt ? new Date(n.publishedAt).toISOString().slice(0, 16) : "",
      sortOrder: String(n.sortOrder),
    });
  }

  async function uploadCover(file: File) {
    if (!file.type.startsWith("image/")) {
      alert("Yalnız şəkil faylı");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("Fayl çox böyükdür (max 10 MB)");
      return;
    }
    setUploading(true);
    try {
      const init = await fetch("/api/admin/news/image-upload", {
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
      setEditForm((prev) => ({ ...prev, coverImageUrl: initData.publicUrl }));
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!editForm.title.trim()) {
      setSaveError("Başlıq tələb olunur");
      return;
    }
    if (!editForm.body.trim()) {
      setSaveError("Mətn tələb olunur");
      return;
    }
    setSaving(true);
    setSaveError(null);
    const res = await fetch("/api/admin/news", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "UPSERT",
        id: editingId === "NEW" ? undefined : editingId,
        title: editForm.title,
        slug: editForm.slug || undefined,
        excerpt: editForm.excerpt || null,
        body: editForm.body,
        coverImageUrl: editForm.coverImageUrl || null,
        category: editForm.category || null,
        scope: editForm.scope,
        isFeatured: editForm.isFeatured,
        isPublished: editForm.isPublished,
        showOnHome: editForm.showOnHome,
        publishedAt: editForm.publishedAt ? new Date(editForm.publishedAt).toISOString() : null,
        sortOrder: Number(editForm.sortOrder || 0),
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

  async function togglePublished(n: NewsItem) {
    const next = !n.isPublished;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isPublished: next } : x)));
    const res = await fetch("/api/admin/news", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "TOGGLE_PUBLISHED", id: n.id, isPublished: next }),
    });
    if (!res.ok) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isPublished: n.isPublished } : x)));
    }
  }

  async function toggleFeatured(n: NewsItem) {
    const next = !n.isFeatured;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isFeatured: next } : x)));
    const res = await fetch("/api/admin/news", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "TOGGLE_FEATURED", id: n.id, isFeatured: next }),
    });
    if (!res.ok) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isFeatured: n.isFeatured } : x)));
    }
  }

  async function toggleHome(n: NewsItem) {
    const next = !n.showOnHome;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, showOnHome: next } : x)));
    const res = await fetch("/api/admin/news", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "TOGGLE_HOME", id: n.id, showOnHome: next }),
    });
    if (!res.ok) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, showOnHome: n.showOnHome } : x)));
    }
  }

  async function deleteItem(id: string) {
    if (!confirm("Bu xəbəri silmək istəyirsən?")) return;
    await fetch("/api/admin/news", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DELETE", id }),
    });
    load();
  }

  function scopeLabel(key: string): string {
    return NEWS_SCOPES.find((s) => s.key === key)?.label ?? key;
  }

  const isHomeView = view.kind === "home";
  const homeSelectedCount = isHomeView ? items.filter((x) => x.showOnHome).length : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {CREATE_SCOPES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setView({ kind: "scope", scope: s.key })}
            title={s.description}
            className={`rounded-full px-3 py-1.5 text-xs transition ${
              view.kind === "scope" && view.scope === s.key
                ? "bg-indigo-500 text-white"
                : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            {s.label}
          </button>
        ))}
        <span className="hidden h-6 w-px bg-zinc-800 sm:inline-block" />
        <button
          type="button"
          onClick={() => setView({ kind: "home" })}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition ${
            isHomeView
              ? "bg-amber-400 text-zinc-900"
              : "border border-amber-400/40 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20"
          }`}
        >
          <Home className="h-3.5 w-3.5" /> Ana Səhifə Seçimi
        </button>
      </div>

      {isHomeView ? (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-xs text-amber-200">
          Bütün scope-lardan yaradılmış xəbərlər. Pin işarəsinə klikləyərək hansılarının
          ana səhifədə görünəcəyini seç. <span className="font-bold">{homeSelectedCount}</span>{" "}
          xəbər ana səhifə üçün seçilib.
        </div>
      ) : (
        <div className="flex justify-end">
          <button
            onClick={openNew}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
          >
            <Plus className="h-4 w-4" /> Yeni Xəbər
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 py-16 text-center text-zinc-500">
          {isHomeView ? "Hələ heç bir xəbər yaradılmayıb." : "Bu scope üçün hələ xəbər yoxdur."}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((n) => (
            <article
              key={n.id}
              className={`flex gap-4 rounded-xl border p-4 transition ${
                isHomeView && n.showOnHome
                  ? "border-amber-400/40 bg-amber-400/5"
                  : "border-zinc-800 bg-zinc-900/50"
              }`}
            >
              <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-white/10">
                {n.coverImageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={n.coverImageUrl}
                    alt={n.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-zinc-700">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                )}
                {n.isFeatured && (
                  <span className="absolute left-1 top-1 inline-flex items-center gap-1 rounded-full bg-amber-400/95 px-2 py-0.5 text-[10px] font-bold text-zinc-900">
                    <Star className="h-2.5 w-2.5 fill-current" /> Featured
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold text-white">{n.title}</p>
                    <p className="text-xs text-zinc-500">
                      <span className="text-zinc-400">{scopeLabel(n.scope)}</span>
                      {n.category ? ` · ${n.category}` : ""}
                      {n.publishedAt
                        ? ` · ${new Date(n.publishedAt).toLocaleDateString("az-AZ", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {isHomeView ? (
                      <button
                        onClick={() => toggleHome(n)}
                        title={n.showOnHome ? "Ana səhifədən çıxar" : "Ana səhifəyə əlavə et"}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                          n.showOnHome
                            ? "bg-amber-400 text-zinc-900 hover:bg-amber-300"
                            : "border border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-amber-400/50 hover:text-amber-300"
                        }`}
                      >
                        {n.showOnHome ? (
                          <>
                            <Pin className="h-3.5 w-3.5 fill-current" /> Anasəhifədə
                          </>
                        ) : (
                          <>
                            <PinOff className="h-3.5 w-3.5" /> Seç
                          </>
                        )}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => toggleHome(n)}
                          title={n.showOnHome ? "Ana səhifədən çıxar" : "Ana səhifəyə də göstər"}
                          className={`rounded p-1.5 hover:bg-zinc-800 ${
                            n.showOnHome ? "text-amber-300" : "text-zinc-500"
                          }`}
                        >
                          <Pin className={`h-4 w-4 ${n.showOnHome ? "fill-current" : ""}`} />
                        </button>
                        <button
                          onClick={() => toggleFeatured(n)}
                          title={n.isFeatured ? "Featured-dan çıxar" : "Featured et"}
                          className={`rounded p-1.5 hover:bg-zinc-800 ${
                            n.isFeatured ? "text-amber-300" : "text-zinc-500"
                          }`}
                        >
                          <Star className={`h-4 w-4 ${n.isFeatured ? "fill-current" : ""}`} />
                        </button>
                        <button
                          onClick={() => togglePublished(n)}
                          title={n.isPublished ? "Drafta gətir" : "Yayımla"}
                          className={`rounded p-1.5 hover:bg-zinc-800 ${
                            n.isPublished ? "text-emerald-400" : "text-zinc-500"
                          }`}
                        >
                          {n.isPublished ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => openEdit(n)}
                          className="rounded p-1.5 text-zinc-500 hover:text-indigo-400"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteItem(n.id)}
                          className="rounded p-1.5 text-zinc-500 hover:text-rose-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {n.excerpt && (
                  <p className="mt-2 line-clamp-2 text-sm text-zinc-300">{n.excerpt}</p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">
                {editingId === "NEW" ? "Yeni Xəbər" : "Xəbəri redaktə et"}
              </h3>
              <button
                onClick={() => setEditingId(null)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-zinc-300 sm:col-span-2">
                Başlıq <span className="text-rose-400">*</span>
                <input
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="GTA VI rəsmi treyleri yayımlandı"
                />
              </label>

              <label className="block text-sm text-zinc-300">
                Scope <span className="text-rose-400">*</span>
                <select
                  value={editForm.scope}
                  onChange={(e) => setEditForm({ ...editForm, scope: e.target.value })}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                >
                  {CREATE_SCOPES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-[11px] text-zinc-500">
                  Hansı səhifədə görünməlidir
                </span>
              </label>

              <label className="block text-sm text-zinc-300">
                Kategori
                <input
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="Yenilik · Endirim · Müsahibə"
                />
              </label>

              {/* Cover şəkil — fayl upload */}
              <div className="text-sm text-zinc-300 sm:col-span-2">
                <span className="mb-1 block">Cover şəkil</span>
                {editForm.coverImageUrl ? (
                  <div className="relative overflow-hidden rounded-lg border border-zinc-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={editForm.coverImageUrl}
                      alt="Cover preview"
                      className="h-48 w-full object-cover"
                    />
                    <div className="absolute right-2 top-2 flex gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md hover:bg-black/90">
                        <Upload className="h-3.5 w-3.5" />
                        {uploading ? "Yüklənir..." : "Dəyiş"}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          disabled={uploading}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) uploadCover(f);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setEditForm({ ...editForm, coverImageUrl: "" })}
                        className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/80 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md hover:bg-rose-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Sil
                      </button>
                    </div>
                  </div>
                ) : (
                  <label
                    className={`flex h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-700 bg-zinc-900/50 text-center transition hover:border-indigo-500/60 hover:bg-zinc-900 ${
                      uploading ? "pointer-events-none opacity-60" : ""
                    }`}
                  >
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadCover(f);
                        e.target.value = "";
                      }}
                    />
                    {uploading ? (
                      <>
                        <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
                        <span className="text-xs text-zinc-400">Yüklənir...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-6 w-6 text-zinc-500" />
                        <span className="text-sm font-semibold text-zinc-300">
                          Şəkil seç
                        </span>
                        <span className="text-[11px] text-zinc-500">
                          PNG, JPEG və ya WEBP — max 10 MB
                        </span>
                      </>
                    )}
                  </label>
                )}
              </div>

              <label className="block text-sm text-zinc-300">
                Slug (avtomatik)
                <input
                  value={editForm.slug}
                  onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="gta-vi-treyleri"
                />
              </label>

              <label className="block text-sm text-zinc-300">
                Yayımlanma tarixi
                <input
                  type="datetime-local"
                  value={editForm.publishedAt}
                  onChange={(e) => setEditForm({ ...editForm, publishedAt: e.target.value })}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                />
              </label>

              <label className="block text-sm text-zinc-300 sm:col-span-2">
                Qısa anons (excerpt)
                <textarea
                  value={editForm.excerpt}
                  onChange={(e) => setEditForm({ ...editForm, excerpt: e.target.value })}
                  rows={2}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="2 cümləlik anons — kartlarda göstəriləcək"
                />
              </label>

              <label className="block text-sm text-zinc-300 sm:col-span-2">
                Mətn <span className="text-rose-400">*</span>
                <textarea
                  value={editForm.body}
                  onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
                  rows={10}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="Tam xəbər mətni — paragraflar, detallar..."
                />
              </label>

              <label className="block text-sm text-zinc-300">
                Sıralama
                <input
                  type="number"
                  value={editForm.sortOrder}
                  onChange={(e) => setEditForm({ ...editForm, sortOrder: e.target.value })}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                />
              </label>

              <div className="flex flex-col gap-2 pt-1 text-sm text-zinc-300">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.isPublished}
                    onChange={(e) => setEditForm({ ...editForm, isPublished: e.target.checked })}
                  />
                  Yayımdadır
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.isFeatured}
                    onChange={(e) => setEditForm({ ...editForm, isFeatured: e.target.checked })}
                  />
                  <Star
                    className={`h-3.5 w-3.5 ${
                      editForm.isFeatured ? "fill-amber-300 text-amber-300" : "text-zinc-500"
                    }`}
                  />
                  Featured (hero kart)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.showOnHome}
                    onChange={(e) => setEditForm({ ...editForm, showOnHome: e.target.checked })}
                  />
                  <Home
                    className={`h-3.5 w-3.5 ${
                      editForm.showOnHome ? "text-amber-300" : "text-zinc-500"
                    }`}
                  />
                  Ana səhifədə də göstər
                </label>
              </div>
            </div>

            {saveError && (
              <div className="mt-4 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                {saveError}
              </div>
            )}

            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={() => setEditingId(null)}
                className="rounded bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
              >
                İmtina
              </button>
              <button
                onClick={save}
                disabled={saving || uploading}
                className="inline-flex items-center gap-2 rounded bg-indigo-500 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-400 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Yadda saxla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
