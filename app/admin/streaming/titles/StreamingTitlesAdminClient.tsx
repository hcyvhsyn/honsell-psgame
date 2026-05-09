"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, Plus, Edit2, Trash2, Upload, X, Eye, EyeOff, Film, Tv as TvIcon, Search, Sparkles, Play } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { STREAMING_SERVICE_LABELS, STREAMING_SERVICES, type StreamingService } from "@/lib/streamingCart";
import { LANGUAGE_OPTIONS, type LanguageCode } from "@/lib/streamingLanguages";

type StreamingTitle = {
  id: string;
  slug: string;
  title: string;
  kind: "MOVIE" | "SERIES";
  service: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  year: number | null;
  genres: string[] | null;
  description: string | null;
  azAvailable: boolean;
  isActive: boolean;
  sortOrder: number;
  externalId: string | null;
  originalLanguage: string | null;
  dubbedLanguages: string[] | null;
  subtitleLanguages: string[] | null;
  trailerUrl: string | null;
};

type TmdbSearchHit = {
  id: string;
  title: string;
  year: number | null;
  kind: "MOVIE" | "SERIES";
  posterUrl: string | null;
};

type EditForm = {
  title: string;
  slug: string;
  kind: "MOVIE" | "SERIES";
  service: StreamingService;
  posterUrl: string;
  backdropUrl: string;
  year: string;
  genres: string;
  description: string;
  azAvailable: boolean;
  isActive: boolean;
  sortOrder: string;
  externalId: string;
  originalLanguage: string;
  dubbedLanguages: string[];
  subtitleLanguages: string[];
  trailerUrl: string;
};

type ServiceFilter = "ALL" | (typeof STREAMING_SERVICES)[number];

export default function StreamingTitlesAdminClient() {
  const [items, setItems] = useState<StreamingTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>("ALL");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | "NEW" | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<"poster" | "backdrop" | null>(null);
  const posterInputRef = useRef<HTMLInputElement>(null);
  const backdropInputRef = useRef<HTMLInputElement>(null);

  // TMDB axtarış state-i — modal yenidən açılanda sıfırlanır.
  const [omdbQuery, setOmdbQuery] = useState("");
  const [omdbResults, setOmdbResults] = useState<TmdbSearchHit[]>([]);
  const [omdbSearching, setOmdbSearching] = useState(false);
  const [omdbFilling, setOmdbFilling] = useState<string | null>(null);
  const [omdbError, setOmdbError] = useState<string | null>(null);

  function emptyForm(): EditForm {
    return {
      title: "",
      slug: "",
      kind: "MOVIE",
      service: "HBO_MAX",
      posterUrl: "",
      backdropUrl: "",
      year: "",
      genres: "",
      description: "",
      azAvailable: true,
      isActive: true,
      sortOrder: "0",
      externalId: "",
      originalLanguage: "",
      dubbedLanguages: [],
      subtitleLanguages: [],
      trailerUrl: "",
    };
  }

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (serviceFilter !== "ALL") params.set("service", serviceFilter);
    if (search.length >= 2) params.set("q", search);
    const res = await fetch(`/api/admin/streaming/titles?${params}`);
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, [serviceFilter, search]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  function openNew() {
    setSaveError(null);
    setEditingId("NEW");
    setEditForm({ ...emptyForm(), sortOrder: String(items.length) });
    setOmdbQuery("");
    setOmdbResults([]);
    setOmdbError(null);
  }

  // TMDB axtarış — debounced. Yalnız modal açıqdırsa işləyir.
  useEffect(() => {
    if (!editingId) return;
    const q = omdbQuery.trim();
    if (q.length < 2) {
      setOmdbResults([]);
      setOmdbError(null);
      return;
    }
    const t = setTimeout(async () => {
      setOmdbSearching(true);
      setOmdbError(null);
      try {
        const res = await fetch(`/api/admin/streaming/lookup/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (!res.ok) {
          setOmdbError(data.error ?? "TMDB axtarışı uğursuz oldu");
          setOmdbResults([]);
        } else {
          setOmdbResults(data.results ?? []);
        }
      } catch {
        setOmdbError("Şəbəkə xətası");
      } finally {
        setOmdbSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [omdbQuery, editingId]);

  // Seçilmiş TMDB nəticəsindən form-u doldur. Mövcud manual dəyərlər üzərinə yazır
  // — istifadəçi sonra istəsə əl ilə dəyişə bilər. TMDB-də backdrop da var, ona
  // görə posterlə yanaşı bunu da avtomatik doldururuq.
  async function fillFromOmdb(hit: TmdbSearchHit) {
    setOmdbFilling(hit.id);
    setOmdbError(null);
    try {
      const params = new URLSearchParams({ id: hit.id, kind: hit.kind });
      const res = await fetch(`/api/admin/streaming/lookup/details?${params}`);
      const d = await res.json();
      if (!res.ok) {
        setOmdbError(d.error ?? "Məlumat çəkilmədi");
        return;
      }
      setEditForm((prev) => ({
        ...prev,
        title: d.title || prev.title,
        kind: d.kind === "SERIES" ? "SERIES" : "MOVIE",
        year: d.year != null ? String(d.year) : prev.year,
        description: d.description ?? prev.description,
        posterUrl: d.posterUrl ?? prev.posterUrl,
        backdropUrl: d.backdropUrl ?? prev.backdropUrl,
        genres: Array.isArray(d.genres) && d.genres.length > 0 ? d.genres.join(", ") : prev.genres,
        externalId: d.externalId ?? prev.externalId,
        originalLanguage: d.originalLanguage ?? prev.originalLanguage,
        trailerUrl: d.trailerUrl ?? prev.trailerUrl,
      }));
      setOmdbResults([]);
      setOmdbQuery("");
    } finally {
      setOmdbFilling(null);
    }
  }

  function toggleLang(field: "dubbedLanguages" | "subtitleLanguages", code: LanguageCode) {
    setEditForm((prev) => {
      const cur = prev[field];
      const has = cur.includes(code);
      const next = has ? cur.filter((c) => c !== code) : [...cur, code];
      return { ...prev, [field]: next };
    });
  }

  function openEdit(t: StreamingTitle) {
    setSaveError(null);
    setEditingId(t.id);
    setOmdbQuery("");
    setOmdbResults([]);
    setOmdbError(null);
    setEditForm({
      title: t.title,
      slug: t.slug,
      kind: t.kind,
      service: (t.service as StreamingService) || "HBO_MAX",
      posterUrl: t.posterUrl ?? "",
      backdropUrl: t.backdropUrl ?? "",
      year: t.year?.toString() ?? "",
      genres: (t.genres ?? []).join(", "),
      description: t.description ?? "",
      azAvailable: t.azAvailable,
      isActive: t.isActive,
      sortOrder: String(t.sortOrder),
      externalId: t.externalId ?? "",
      originalLanguage: t.originalLanguage ?? "",
      dubbedLanguages: t.dubbedLanguages ?? [],
      subtitleLanguages: t.subtitleLanguages ?? [],
      trailerUrl: t.trailerUrl ?? "",
    });
  }

  async function handleImageUpload(file: File, target: "poster" | "backdrop") {
    if (!file.type.startsWith("image/")) { alert("Yalnız şəkil faylı"); return; }
    if (file.size > 10 * 1024 * 1024) { alert("Fayl çox böyükdür (max 10 MB)"); return; }
    setUploading(target);
    try {
      const init = await fetch("/api/admin/streaming/titles/image-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type }),
      });
      const initData = await init.json();
      if (!init.ok) { alert(initData.error ?? "Upload hazırlanmadı"); return; }
      const supabase = getSupabaseBrowser();
      const { error: upErr } = await supabase.storage
        .from(initData.bucket)
        .uploadToSignedUrl(initData.path, initData.token, file);
      if (upErr) { alert(`Upload alınmadı: ${upErr.message}`); return; }
      setEditForm((prev) =>
        target === "poster"
          ? { ...prev, posterUrl: initData.publicUrl }
          : { ...prev, backdropUrl: initData.publicUrl }
      );
    } finally {
      setUploading(null);
    }
  }

  async function saveItem() {
    if (!editForm.title.trim()) { setSaveError("Başlıq tələb olunur"); return; }
    setSaving(true);
    setSaveError(null);
    const genresArr = editForm.genres
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean);
    const res = await fetch("/api/admin/streaming/titles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "UPSERT",
        id: editingId === "NEW" ? undefined : editingId,
        title: editForm.title,
        slug: editForm.slug || undefined,
        kind: editForm.kind,
        service: editForm.service,
        posterUrl: editForm.posterUrl || null,
        backdropUrl: editForm.backdropUrl || null,
        year: editForm.year ? Number(editForm.year) : null,
        genres: genresArr,
        description: editForm.description || null,
        azAvailable: editForm.azAvailable,
        isActive: editForm.isActive,
        sortOrder: Number(editForm.sortOrder || 0),
        externalId: editForm.externalId || null,
        originalLanguage: editForm.originalLanguage || null,
        dubbedLanguages: editForm.dubbedLanguages,
        subtitleLanguages: editForm.subtitleLanguages,
        trailerUrl: editForm.trailerUrl || null,
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

  async function toggleActive(t: StreamingTitle) {
    const next = !t.isActive;
    setItems((prev) => prev.map((x) => (x.id === t.id ? { ...x, isActive: next } : x)));
    const res = await fetch("/api/admin/streaming/titles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "TOGGLE_ACTIVE", id: t.id, isActive: next }),
    });
    if (!res.ok) {
      setItems((prev) => prev.map((x) => (x.id === t.id ? { ...x, isActive: t.isActive } : x)));
    }
  }

  async function deleteItem(id: string) {
    if (!confirm("Bu title-ı silmək istəyirsiniz?")) return;
    await fetch("/api/admin/streaming/titles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DELETE", id }),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value as ServiceFilter)}
          className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
        >
          <option value="ALL">Bütün xidmətlər</option>
          {STREAMING_SERVICES.map((s) => (
            <option key={s} value={s}>{STREAMING_SERVICE_LABELS[s] ?? s}</option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Başlıq axtar..."
          className="flex-1 min-w-[200px] rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
        />
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
        >
          <Plus className="h-4 w-4" /> Yeni Title
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-500" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 py-16 text-center text-zinc-500">
          Hələ heç bir title yoxdur.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((t) => (
            <div key={t.id} className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
              <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-md bg-zinc-900">
                {t.posterUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={t.posterUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-zinc-700">
                    {t.kind === "SERIES" ? <TvIcon className="h-6 w-6" /> : <Film className="h-6 w-6" />}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-zinc-100">{t.title}</p>
                <p className="truncate text-xs text-zinc-500">
                  {STREAMING_SERVICE_LABELS[t.service] ?? t.service} · {t.kind === "SERIES" ? "Serial" : "Film"}
                  {t.year ? ` · ${t.year}` : ""}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${t.isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-800 text-zinc-500"}`}>
                    {t.isActive ? "Aktiv" : "Passiv"}
                  </span>
                  {!t.azAvailable && (
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/15 text-amber-300">
                      AZ-da yox
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <button
                    onClick={() => toggleActive(t)}
                    title={t.isActive ? "Passiv et" : "Aktiv et"}
                    className={`rounded p-1.5 ${t.isActive ? "text-emerald-400 hover:text-emerald-300" : "text-zinc-500 hover:text-zinc-300"}`}
                  >
                    {t.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <button onClick={() => openEdit(t)} className="rounded p-1.5 text-zinc-500 hover:text-indigo-400">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => deleteItem(t.id)} className="rounded p-1.5 text-zinc-500 hover:text-rose-400">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-bold">{editingId === "NEW" ? "Yeni Title" : "Title-ı redaktə et"}</h3>

            {/* TMDB axtarış: avtomatik doldurma */}
            <div className="mb-6 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-indigo-200">
                <Sparkles className="h-4 w-4" /> TMDB-dən avtomatik doldur
              </p>
              <p className="mb-3 text-xs text-indigo-300/70">
                Film və ya serial adı yaz, nəticədən birini seç — başlıq, il, açıqlama, poster, backdrop, janr və orijinal dil avtomatik dolacaq. Sonra hər sahəni əl ilə dəyişə bilərsən.
              </p>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  value={omdbQuery}
                  onChange={(e) => setOmdbQuery(e.target.value)}
                  placeholder="Məs: Stranger Things"
                  className="w-full rounded border border-zinc-800 bg-zinc-900 pl-9 pr-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
              {omdbError && (
                <div className="mt-2 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                  {omdbError}
                </div>
              )}
              {(omdbSearching || omdbResults.length > 0) && (
                <div className="mt-3 max-h-64 overflow-y-auto rounded border border-zinc-800 bg-zinc-900">
                  {omdbSearching && <div className="px-3 py-2 text-xs text-zinc-500">Axtarılır...</div>}
                  {omdbResults.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      disabled={omdbFilling !== null}
                      onClick={() => fillFromOmdb(h)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-50"
                    >
                      <div className="relative h-12 w-9 shrink-0 overflow-hidden rounded bg-zinc-900">
                        {h.posterUrl && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={h.posterUrl} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{h.title}</span>
                        <span className="block truncate text-[11px] text-zinc-500">
                          {h.kind === "SERIES" ? "Serial" : "Film"}
                          {h.year ? ` · ${h.year}` : ""} · {h.id}
                        </span>
                      </div>
                      {omdbFilling === h.id && <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-zinc-300 sm:col-span-2">
                Başlıq <span className="text-rose-400">*</span>
                <input
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="Stranger Things"
                />
              </label>

              <label className="block text-sm text-zinc-300">
                Platforma <span className="text-rose-400">*</span>
                <select
                  value={editForm.service}
                  onChange={(e) => setEditForm({ ...editForm, service: e.target.value as StreamingService })}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                >
                  {STREAMING_SERVICES.map((s) => (
                    <option key={s} value={s}>{STREAMING_SERVICE_LABELS[s] ?? s}</option>
                  ))}
                </select>
              </label>

              <label className="block text-sm text-zinc-300">
                Növ
                <select
                  value={editForm.kind}
                  onChange={(e) => setEditForm({ ...editForm, kind: e.target.value as "MOVIE" | "SERIES" })}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="MOVIE">Film</option>
                  <option value="SERIES">Serial</option>
                </select>
              </label>

              <label className="block text-sm text-zinc-300">
                İl
                <input
                  type="number"
                  value={editForm.year}
                  onChange={(e) => setEditForm({ ...editForm, year: e.target.value })}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="2024"
                />
              </label>

              <label className="block text-sm text-zinc-300">
                Slug (opsional, avtomatik yaradılır)
                <input
                  value={editForm.slug}
                  onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="stranger-things"
                />
              </label>

              <label className="block text-sm text-zinc-300 sm:col-span-2">
                Janrlar (vergüllə ayır)
                <input
                  value={editForm.genres}
                  onChange={(e) => setEditForm({ ...editForm, genres: e.target.value })}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="Drama, Sci-Fi, Thriller"
                />
              </label>

              <label className="block text-sm text-zinc-300 sm:col-span-2">
                Açıqlama
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                />
              </label>

              {/* Dublyaj dilləri */}
              <div className="sm:col-span-2">
                <p className="mb-2 text-sm text-zinc-300">
                  Dublyaj dilləri
                  <span className="ml-2 text-xs text-zinc-500">(manual seçim)</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGE_OPTIONS.map((l) => {
                    const active = editForm.dubbedLanguages.includes(l.code);
                    return (
                      <button
                        key={l.code}
                        type="button"
                        onClick={() => toggleLang("dubbedLanguages", l.code)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                          active
                            ? "border-indigo-400/50 bg-indigo-500/20 text-indigo-100"
                            : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                        }`}
                      >
                        {l.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Trailer URL */}
              <div className="sm:col-span-2">
                <p className="mb-1 text-sm text-zinc-300">
                  Trailer linki
                  <span className="ml-2 text-xs text-zinc-500">YouTube URL — TMDB-dən avtomatik dolur, manual dəyişə bilərsən</span>
                </p>
                <div className="flex gap-2">
                  <input
                    value={editForm.trailerUrl}
                    onChange={(e) => setEditForm({ ...editForm, trailerUrl: e.target.value })}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="flex-1 rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  />
                  {editForm.trailerUrl && (
                    <a
                      href={editForm.trailerUrl}
                      target="_blank"
                      rel="noreferrer"
                      title="YouTube-da aç"
                      className="inline-flex items-center gap-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 hover:border-indigo-500 hover:text-indigo-300"
                    >
                      <Play className="h-3.5 w-3.5" /> Önizlə
                    </a>
                  )}
                </div>
              </div>

              {/* Subtitr dilləri */}
              <div className="sm:col-span-2">
                <p className="mb-2 text-sm text-zinc-300">
                  Subtitr dilləri
                  <span className="ml-2 text-xs text-zinc-500">(manual seçim)</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGE_OPTIONS.map((l) => {
                    const active = editForm.subtitleLanguages.includes(l.code);
                    return (
                      <button
                        key={l.code}
                        type="button"
                        onClick={() => toggleLang("subtitleLanguages", l.code)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                          active
                            ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-100"
                            : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                        }`}
                      >
                        {l.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Poster */}
              <div>
                <p className="mb-1 text-sm text-zinc-300">Poster (şaquli, 2:3)</p>
                <input
                  ref={posterInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, "poster"); e.target.value = ""; }}
                />
                {editForm.posterUrl ? (
                  <div className="relative overflow-hidden rounded-lg border border-zinc-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={editForm.posterUrl} alt="" className="mx-auto h-48 w-auto object-contain" />
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, posterUrl: "" })}
                      className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={uploading !== null}
                    onClick={() => posterInputRef.current?.click()}
                    className="flex h-32 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-700 bg-zinc-900 text-sm text-zinc-400 hover:border-indigo-500 hover:text-indigo-400 disabled:opacity-50"
                  >
                    {uploading === "poster" ? <><Loader2 className="h-4 w-4 animate-spin" /> Yüklənir...</> : <><Upload className="h-4 w-4" /> Poster seç</>}
                  </button>
                )}
              </div>

              {/* Backdrop */}
              <div>
                <p className="mb-1 text-sm text-zinc-300">Backdrop (üfüqi, 16:9)</p>
                <input
                  ref={backdropInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, "backdrop"); e.target.value = ""; }}
                />
                {editForm.backdropUrl ? (
                  <div className="relative overflow-hidden rounded-lg border border-zinc-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={editForm.backdropUrl} alt="" className="h-32 w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, backdropUrl: "" })}
                      className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={uploading !== null}
                    onClick={() => backdropInputRef.current?.click()}
                    className="flex h-32 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-700 bg-zinc-900 text-sm text-zinc-400 hover:border-indigo-500 hover:text-indigo-400 disabled:opacity-50"
                  >
                    {uploading === "backdrop" ? <><Loader2 className="h-4 w-4 animate-spin" /> Yüklənir...</> : <><Upload className="h-4 w-4" /> Backdrop seç</>}
                  </button>
                )}
              </div>

              <label className="block text-sm text-zinc-300">
                Sıralama
                <input
                  type="number"
                  value={editForm.sortOrder}
                  onChange={(e) => setEditForm({ ...editForm, sortOrder: e.target.value })}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                />
              </label>

              <div className="flex items-end gap-4 text-sm text-zinc-300">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.azAvailable}
                    onChange={(e) => setEditForm({ ...editForm, azAvailable: e.target.checked })}
                  />
                  AZ-da yayımlanır
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                  />
                  Aktivdir
                </label>
              </div>
            </div>

            {saveError && <div className="mt-4 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{saveError}</div>}

            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={() => { setEditingId(null); setSaveError(null); }}
                className="rounded bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
              >
                İmtina
              </button>
              <button
                onClick={saveItem}
                disabled={saving || uploading !== null}
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
