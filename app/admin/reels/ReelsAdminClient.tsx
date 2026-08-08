"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  X,
  Loader2,
  Upload,
  Eye,
  EyeOff,
  Search,
  MessageSquare,
  Link2,
  Layers,
  ImageOff,
} from "lucide-react";
import { useDialog } from "@/lib/dialogs";
import { uploadAdminImage, uploadAdminVideo } from "@/lib/uploadImageClient";
import { captureVideoPoster, captureVideoPosterFromUrl } from "@/lib/videoPoster";
import { detectVideoCodec } from "@/lib/videoCodec";

const HEVC_MSG =
  "Bu video H.265/HEVC formatındadır — Chrome, Firefox və əksər brauzerlər onu oynada bilmir (yalnız Safari). Zəhmət olmasa videonu H.264 (MP4) formatına çevirib yenidən yükləyin.";

/** Fayl adından səliqəli başlıq ("Oppenheimer_trailer.mp4" → "Oppenheimer trailer"). */
function titleFromName(name: string): string {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

type Reel = {
  id: string;
  title: string;
  caption: string | null;
  videoUrl: string;
  posterUrl: string;
  width: number;
  height: number;
  durationMs: number;
  platformCode: string | null;
  platformLabel: string | null;
  platformLogoUrl: string | null;
  ctaType: string;
  ctaTargetId: string | null;
  ctaHref: string | null;
  ctaLabel: string | null;
  editionGameIds: string[];
  category: string;
  viewCount: number;
  isPublished: boolean;
  sortOrder: number;
  _count?: { comments: number; reactions: number };
};

type FormState = {
  id?: string;
  title: string;
  caption: string;
  videoUrl: string;
  posterUrl: string;
  width: number;
  height: number;
  durationMs: number;
  platformCode: string;
  platformLabel: string;
  platformLogoUrl: string;
  ctaType: string;
  ctaTargetId: string;
  ctaTargetLabel: string;
  ctaHref: string;
  ctaLabel: string;
  /** ctaType=GAME olduqda feed-də göstəriləcək sürümlər (Game.id). */
  editionGameIds: string[];
  /** GAME | STREAMING — feed ayrımı. "Hamısı" saxlanılan dəyər deyil. */
  category: string;
  isPublished: boolean;
  sortOrder: number;
};

const EMPTY: FormState = {
  title: "",
  caption: "",
  videoUrl: "",
  posterUrl: "",
  width: 720,
  height: 1280,
  durationMs: 0,
  platformCode: "",
  platformLabel: "",
  platformLogoUrl: "",
  ctaType: "URL",
  ctaTargetId: "",
  ctaTargetLabel: "",
  ctaHref: "",
  ctaLabel: "Hesab al",
  editionGameIds: [],
  category: "GAME",
  isPublished: true,
  sortOrder: 0,
};

export default function ReelsAdminClient() {
  const dialog = useDialog();
  const [items, setItems] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoPct, setVideoPct] = useState(0);
  const [posterBusy, setPosterBusy] = useState(false);
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);
  const [tab, setTab] = useState<"ALL" | "GAME" | "STREAMING">("ALL");
  const bulkRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/reels", { cache: "no-store" });
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(r: Reel) {
    setForm({
      id: r.id,
      title: r.title,
      caption: r.caption ?? "",
      videoUrl: r.videoUrl,
      posterUrl: r.posterUrl,
      width: r.width,
      height: r.height,
      durationMs: r.durationMs,
      platformCode: r.platformCode ?? "",
      platformLabel: r.platformLabel ?? "",
      platformLogoUrl: r.platformLogoUrl ?? "",
      ctaType: r.ctaType,
      ctaTargetId: r.ctaTargetId ?? "",
      ctaTargetLabel: "",
      ctaHref: r.ctaHref ?? "",
      ctaLabel: r.ctaLabel ?? "Hesab al",
      editionGameIds: r.editionGameIds ?? [],
      category: r.category === "GAME" ? "GAME" : "STREAMING",
      isPublished: r.isPublished,
      sortOrder: r.sortOrder,
    });
    setOpen(true);
  }

  async function onVideoPick(file: File) {
    setVideoBusy(true);
    setVideoPct(0);
    try {
      // Codec yoxla — H.265/HEVC brauzerdə oynamır, boş yerə 100MB+ yükləmə.
      const codec = await detectVideoCodec(file);
      if (codec.isHevc) {
        await dialog.alert({ title: "Uyğun olmayan format (H.265)", message: HEVC_MSG, tone: "danger" });
        return;
      }
      // Videodan ilk kadrı tutub poster kimi (əl işi olmadan) yüklə + ölçüləri al.
      let posterUrl = form.posterUrl;
      let width = form.width;
      let height = form.height;
      let durationMs = form.durationMs;
      try {
        const cap = await captureVideoPoster(file);
        width = cap.width || width;
        height = cap.height || height;
        durationMs = cap.durationMs || durationMs;
        if (cap.posterFile) {
          const up = await uploadAdminImage("/api/admin/reels/image-upload", cap.posterFile);
          if (up.ok) posterUrl = up.url;
        }
      } catch {
        // poster tuta bilməsək, admin əl ilə yükləyər
      }

      const res = await uploadAdminVideo("/api/admin/reels/video-upload", file, setVideoPct);
      if (!res.ok) {
        await dialog.alert({ title: "Video yüklənmədi", message: res.error, tone: "danger" });
        return;
      }
      setForm((f) => ({
        ...f,
        videoUrl: res.url,
        posterUrl,
        width,
        height,
        durationMs,
        title: f.title || titleFromName(file.name),
      }));
    } finally {
      setVideoBusy(false);
    }
  }

  // URL-dən idxal: server videonu R2-yə çəkir, sonra posteri həmin URL-dən tuturuq.
  async function onVideoImport(url: string) {
    if (!url.trim()) return;
    setVideoBusy(true);
    setVideoPct(0);
    try {
      const res = await fetch("/api/admin/reels/video-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        await dialog.alert({ title: "İdxal alınmadı", message: data.error, tone: "danger" });
        return;
      }
      const videoUrl: string = data.url;
      let posterUrl = form.posterUrl;
      let width = form.width;
      let height = form.height;
      let durationMs = form.durationMs;
      try {
        const cap = await captureVideoPosterFromUrl(videoUrl);
        width = cap.width || width;
        height = cap.height || height;
        durationMs = cap.durationMs || durationMs;
        if (cap.posterFile) {
          const up = await uploadAdminImage("/api/admin/reels/image-upload", cap.posterFile);
          if (up.ok) posterUrl = up.url;
        }
      } catch {
        // poster tutula bilmədi — admin əl ilə əlavə edə bilər
      }
      setForm((f) => ({ ...f, videoUrl, posterUrl, width, height, durationMs }));
    } finally {
      setVideoBusy(false);
    }
  }

  // Toplu yükləmə: hər video → poster (avto) + başlıq (fayl adı) ilə QARALAMA reel.
  async function onBulkPick(files: FileList) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setBulk({ done: 0, total: list.length });
    let created = 0;
    let skippedHevc = 0;
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      setBulk({ done: i, total: list.length });
      try {
        const codec = await detectVideoCodec(file);
        if (codec.isHevc) {
          skippedHevc++;
          continue; // H.265 — brauzerdə oynamır, ötür
        }
        let posterUrl = "";
        let width = 720;
        let height = 1280;
        let durationMs = 0;
        try {
          const cap = await captureVideoPoster(file);
          width = cap.width || width;
          height = cap.height || height;
          durationMs = cap.durationMs || durationMs;
          if (cap.posterFile) {
            const up = await uploadAdminImage("/api/admin/reels/image-upload", cap.posterFile);
            if (up.ok) posterUrl = up.url;
          }
        } catch {
          /* poster olmadan davam */
        }
        const vid = await uploadAdminVideo("/api/admin/reels/video-upload", file);
        if (!vid.ok) continue;
        const resp = await fetch("/api/admin/reels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "UPSERT",
            title: titleFromName(file.name),
            videoUrl: vid.url,
            posterUrl,
            width,
            height,
            durationMs,
            ctaType: "URL",
            // Toplu yükləmə hansı kateqoriya olduğunu bilə bilmir; qaralamalar
            // yayımlanmadığı üçün admin yayımdan əvvəl onsuz da düzəldir.
            category: "STREAMING",
            isPublished: false, // qaralama — admin CTA/kateqoriya təyin edib yayımlayır
          }),
        });
        if (resp.ok) created++;
      } catch {
        /* bu faylı ötür */
      }
    }
    setBulk(null);
    if (bulkRef.current) bulkRef.current.value = "";
    await load();
    await dialog.alert({
      title: "Toplu yükləmə bitdi",
      message:
        `${created}/${list.length} video qaralama kimi əlavə olundu. İndi hər birinə CTA/platforma təyin edib yayımlayın.` +
        (skippedHevc > 0
          ? `\n\n⚠️ ${skippedHevc} video H.265/HEVC olduğu üçün ötürüldü (brauzerlər oynada bilmir — H.264-ə çevirin).`
          : ""),
    });
  }

  async function onPosterPick(file: File) {
    setPosterBusy(true);
    try {
      const up = await uploadAdminImage("/api/admin/reels/image-upload", file);
      if (!up.ok) {
        await dialog.alert({ title: "Poster yüklənmədi", message: up.error, tone: "danger" });
        return;
      }
      setForm((f) => ({ ...f, posterUrl: up.url }));
    } finally {
      setPosterBusy(false);
    }
  }

  async function save() {
    if (!form.title.trim()) {
      await dialog.alert({ title: "Başlıq tələb olunur", tone: "warning" });
      return;
    }
    if (!form.videoUrl) {
      await dialog.alert({ title: "Video yükləyin", tone: "warning" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/reels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "UPSERT", ...form }),
      });
      const data = await res.json();
      if (!res.ok) {
        await dialog.alert({ title: "Yadda saxlanmadı", message: data.error, tone: "danger" });
        return;
      }
      setOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(r: Reel) {
    await fetch("/api/admin/reels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "TOGGLE_PUBLISHED", id: r.id, isPublished: !r.isPublished }),
    });
    await load();
  }

  async function remove(r: Reel) {
    const ok = await dialog.confirm({
      title: "Reel silinsin?",
      message: `"${r.title}" həmişəlik silinəcək (şərhlər və reaksiyalar da).`,
      tone: "danger",
      confirmLabel: "Sil",
    });
    if (!ok) return;
    await fetch("/api/admin/reels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DELETE", id: r.id }),
    });
    await load();
  }

  // Kateqoriya nişanı "GAME" deyilsə film sayılır — köhnə sətirlərdə dəyər boş
  // ola bilməz (sütunun DEFAULT-u var), amma müdafiəli oxuyuruq.
  const counts = {
    GAME: items.filter((r) => r.category === "GAME").length,
    STREAMING: items.filter((r) => r.category !== "GAME").length,
  };
  const visible =
    tab === "ALL" ? items : items.filter((r) => (tab === "GAME" ? r.category === "GAME" : r.category !== "GAME"));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-500">{visible.length} reel</span>
          <div className="flex rounded-lg bg-admin-chip p-0.5">
            {(
              [
                ["ALL", `Hamısı (${items.length})`],
                ["GAME", `🎮 Oyun (${counts.GAME})`],
                ["STREAMING", `🎬 Film (${counts.STREAMING})`],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  tab === value
                    ? "bg-violet-500/15 text-violet-700 ring-1 ring-violet-500/30"
                    : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={bulkRef}
            type="file"
            accept="video/mp4,video/webm"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && onBulkPick(e.target.files)}
          />
          <button
            onClick={() => bulkRef.current?.click()}
            disabled={!!bulk}
            className="inline-flex items-center gap-2 rounded-lg border border-admin-line2 px-4 py-2 text-sm font-semibold hover:bg-admin-chip disabled:opacity-60"
          >
            {bulk ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Yüklənir {bulk.done + 1}/{bulk.total}
              </>
            ) : (
              <>
                <Layers className="h-4 w-4" /> Toplu yüklə
              </>
            )}
          </button>
          <button
            onClick={openNew}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
          >
            <Plus className="h-4 w-4" /> Yeni reel
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-admin-line2 py-16 text-center text-sm text-zinc-500">
          {items.length === 0
            ? "Hələ reel yoxdur. İlk videonu əlavə edin."
            : "Bu kateqoriyada reel yoxdur."}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((r) => (
            <div key={r.id} className="overflow-hidden rounded-xl border border-admin-line bg-admin-card shadow-sm">
              <div className="relative aspect-[9/16] bg-admin-chip">
                {r.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.posterUrl} alt={r.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-zinc-300">
                    <ImageOff className="h-8 w-8" />
                  </div>
                )}
                {!r.isPublished && (
                  <span className="absolute left-2 top-2 rounded bg-zinc-900/80 px-2 py-0.5 text-[10px] font-bold text-white">
                    Gizli
                  </span>
                )}
                <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
                  {r.category === "GAME" ? "🎮 Oyun" : "🎬 Film"}
                </span>
                {r.platformLabel && (
                  <span className="absolute right-2 top-2 rounded bg-violet-600/90 px-2 py-0.5 text-[10px] font-bold text-white">
                    {r.platformLabel}
                  </span>
                )}
              </div>
              <div className="space-y-2 p-3">
                <div className="truncate text-sm font-semibold" title={r.title}>
                  {r.title || <span className="text-zinc-400">(başlıqsız)</span>}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3 w-3" /> {r.viewCount}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" /> {r._count?.comments ?? 0}
                  </span>
                  <span>#{r.sortOrder}</span>
                </div>
                <div className="flex gap-1 pt-1">
                  <button
                    onClick={() => openEdit(r)}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-admin-chip py-1.5 text-xs font-medium hover:bg-admin-chip2"
                  >
                    <Edit2 className="h-3 w-3" /> Redaktə
                  </button>
                  <button
                    onClick={() => togglePublished(r)}
                    title={r.isPublished ? "Gizlə" : "Yayımla"}
                    className="inline-flex items-center justify-center rounded-md bg-admin-chip px-2 py-1.5 hover:bg-admin-chip2"
                  >
                    {r.isPublished ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </button>
                  <button
                    onClick={() => remove(r)}
                    className="inline-flex items-center justify-center rounded-md bg-red-50 px-2 py-1.5 text-red-600 hover:bg-red-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <ReelFormModal
          form={form}
          setForm={setForm}
          onClose={() => setOpen(false)}
          onSave={save}
          saving={saving}
          onVideoPick={onVideoPick}
          onVideoImport={onVideoImport}
          onPosterPick={onPosterPick}
          videoBusy={videoBusy}
          videoPct={videoPct}
          posterBusy={posterBusy}
        />
      )}
    </div>
  );
}

function ReelFormModal({
  form,
  setForm,
  onClose,
  onSave,
  saving,
  onVideoPick,
  onVideoImport,
  onPosterPick,
  videoBusy,
  videoPct,
  posterBusy,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  onVideoPick: (f: File) => void;
  onVideoImport: (url: string) => void;
  onPosterPick: (f: File) => void;
  videoBusy: boolean;
  videoPct: number;
  posterBusy: boolean;
}) {
  const videoRef = useRef<HTMLInputElement>(null);
  const posterRef = useRef<HTMLInputElement>(null);
  const [importUrl, setImportUrl] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("video/")) onVideoPick(file);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="my-8 w-full max-w-2xl rounded-2xl bg-admin-card shadow-xl">
        <div className="flex items-center justify-between border-b border-admin-line p-4">
          <h2 className="text-lg font-bold">{form.id ? "Reel redaktə" : "Yeni reel"}</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-admin-chip">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Video */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-600">Video (9:16, MP4)</label>
              <input
                ref={videoRef}
                type="file"
                accept="video/mp4,video/webm"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onVideoPick(e.target.files[0])}
              />
              <button
                onClick={() => videoRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                disabled={videoBusy}
                className={`flex aspect-[9/16] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-admin-chip text-sm text-zinc-500 transition ${
                  dragOver ? "border-violet-500 bg-violet-50" : "border-admin-line2 hover:border-violet-400"
                }`}
              >
                {videoBusy ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span>{videoPct}%</span>
                  </>
                ) : form.videoUrl ? (
                  <video src={form.videoUrl} className="h-full w-full rounded-xl object-cover" muted playsInline />
                ) : (
                  <>
                    <Upload className="h-6 w-6" />
                    <span className="px-2 text-center text-xs">Sürüşdür-burax<br />və ya klik et</span>
                  </>
                )}
              </button>
            </div>

            {/* Poster */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-600">Poster (avto)</label>
              <input
                ref={posterRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onPosterPick(e.target.files[0])}
              />
              <button
                onClick={() => posterRef.current?.click()}
                disabled={posterBusy}
                className="flex aspect-[9/16] w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed border-admin-line2 bg-admin-chip text-sm text-zinc-500 hover:border-violet-400"
              >
                {posterBusy ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : form.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.posterUrl} alt="poster" className="h-full w-full object-cover" />
                ) : (
                  <>
                    <Upload className="h-6 w-6" />
                    <span>Poster seç</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* URL-dən idxal — fayl seçmədən birbaşa link yapışdır */}
          <div className="flex items-end gap-2 rounded-lg bg-admin-chip p-2">
            <div className="flex-1">
              <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-zinc-600">
                <Link2 className="h-3.5 w-3.5" /> Və ya video URL yapışdır
              </label>
              <input
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                className="input"
                placeholder="https://.../trailer.mp4"
              />
            </div>
            <button
              onClick={() => onVideoImport(importUrl)}
              disabled={videoBusy || !importUrl.trim()}
              className="rounded-lg bg-zinc-800 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              İdxal et
            </button>
          </div>

          <Field label="Başlıq">
            <input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className="input"
              placeholder="Məs. Oppenheimer — treyler"
            />
          </Field>

          <Field label="Təsvir (opsional)">
            <textarea
              value={form.caption}
              onChange={(e) => set("caption", e.target.value)}
              rows={2}
              className="input"
            />
          </Field>

          {/* Platforma nişanı */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Platforma kodu (opsional)">
              <input
                value={form.platformCode}
                onChange={(e) => set("platformCode", e.target.value)}
                className="input"
                placeholder="NETFLIX / PS / STEAM"
              />
            </Field>
            <Field label="Platforma etiketi (badge)">
              <input
                value={form.platformLabel}
                onChange={(e) => set("platformLabel", e.target.value)}
                className="input"
                placeholder="Netflix"
              />
            </Field>
          </div>
          <Field label="Platforma logo URL (opsional)">
            <input
              value={form.platformLogoUrl}
              onChange={(e) => set("platformLogoUrl", e.target.value)}
              className="input"
              placeholder="https://cdn.honsell.store/..."
            />
          </Field>

          {/* Feed kateqoriyası — oyun və film/serial auditoriyaları ayrıdır. */}
          <div className="rounded-xl border border-admin-line p-3">
            <Field label="Feed kateqoriyası">
              <select
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                className="input"
              >
                <option value="GAME">🎮 Oyun</option>
                <option value="STREAMING">🎬 Film / Serial</option>
              </select>
            </Field>
            <p className="mt-1.5 text-[11px] text-zinc-500">
              İstifadəçi <b>/reels</b>-ə ilk girişdə hansını izləyəcəyini seçir və yalnız
              onu görür. Səhv kateqoriya = video yanlış auditoriyaya düşür.
            </p>
          </div>

          {/* CTA */}
          <div className="rounded-xl border border-admin-line p-3">
            <div className="mb-3 text-xs font-bold uppercase tracking-wide text-zinc-500">
              Tək toxunuşla al (CTA)
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="CTA növü">
                <select
                  value={form.ctaType}
                  onChange={(e) => set("ctaType", e.target.value)}
                  className="input"
                >
                  <option value="URL">Xarici link</option>
                  <option value="GAME">Oyun</option>
                  <option value="SERVICE">Hesab / Xidmət</option>
                </select>
              </Field>
              <Field label="Düymə mətni">
                <input value={form.ctaLabel} onChange={(e) => set("ctaLabel", e.target.value)} className="input" />
              </Field>
            </div>

            {form.ctaType === "URL" ? (
              <div className="mt-3">
                <Field label="Link (URL)">
                  <input
                    value={form.ctaHref}
                    onChange={(e) => set("ctaHref", e.target.value)}
                    className="input"
                    placeholder="https://..."
                  />
                </Field>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <ProductPicker
                  type={form.ctaType}
                  value={form.ctaTargetId}
                  label={form.ctaTargetLabel}
                  onPick={(id, label) =>
                    setForm((f) => ({
                      ...f,
                      ctaTargetId: id,
                      ctaTargetLabel: label,
                      // Başqa oyun seçildi → köhnə sürüm siyahısı artıq yad oyuna aiddir.
                      editionGameIds: id === f.ctaTargetId ? f.editionGameIds : [],
                    }))
                  }
                />

                {form.ctaType === "GAME" && form.ctaTargetId && (
                  <EditionPicker
                    gameId={form.ctaTargetId}
                    selected={form.editionGameIds}
                    onChange={(ids) => set("editionGameIds", ids)}
                  />
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Sıra (kiçik = əvvəl)">
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => set("sortOrder", Number(e.target.value))}
                className="input"
              />
            </Field>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(e) => set("isPublished", e.target.checked)}
                className="h-4 w-4"
              />
              Yayımla (public)
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-admin-line p-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium hover:bg-admin-chip">
            Ləğv et
          </button>
          <button
            onClick={onSave}
            disabled={saving || videoBusy}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Yadda saxla
          </button>
        </div>
      </div>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid rgb(228 228 231);
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }
        :global(.input:focus) {
          border-color: rgb(139 92 246);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-zinc-600">{label}</label>
      {children}
    </div>
  );
}

type EditionItem = {
  id: string;
  title: string;
  imageUrl: string | null;
  platform: string | null;
  editionName: string;
  finalAzn: number;
  originalAzn: number | null;
  discountPct: number | null;
  isPrimary: boolean;
};

/**
 * Sürüm seçicisi — seçilmiş oyunun sürüm NAMİZƏDLƏRİNİ gətirib admin təsdiqinə
 * verir. Avtomatik tapılma başlıq evristikasıdır (lib/gameEditions.ts) və səhv
 * ola bilər, ona görə feed-ə yalnız işarələnənlər çıxır.
 *
 * Namizədlər gələndə əvvəlcədən HEÇ NƏ işarələnmir (yeni reel) — admin şüurlu
 * seçim etsin; mövcud reel redaktə olunanda isə saxlanmış siyahı qorunur.
 */
function EditionPicker({
  gameId,
  selected,
  onChange,
}: {
  gameId: string;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [items, setItems] = useState<EditionItem[]>([]);
  const [baseTitle, setBaseTitle] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    fetch(`/api/admin/reels/editions?gameId=${encodeURIComponent(gameId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [], baseTitle: "" }))
      .then((d: { items?: EditionItem[]; baseTitle?: string }) => {
        if (cancelled) return;
        setItems(Array.isArray(d.items) ? d.items : []);
        setBaseTitle(d.baseTitle ?? "");
      })
      .catch(() => !cancelled && setItems([]))
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  if (busy) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-admin-line p-3 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Sürümlər axtarılır...
      </div>
    );
  }

  if (items.length <= 1) {
    return (
      <p className="rounded-lg border border-dashed border-admin-line2 p-3 text-xs text-zinc-500">
        Bu oyun üçün başqa sürüm tapılmadı — feed-də tək qiymət göstəriləcək.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-admin-line p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-zinc-700">
            Sürümlər <span className="text-zinc-400">({selected.length}/{items.length} seçili)</span>
          </p>
          <p className="truncate text-[11px] text-zinc-400">
            Baza başlıq: <b>{baseTitle}</b> — səhv sürüm varsa işarəni götür.
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => onChange(items.map((i) => i.id))}
            className="rounded-md bg-admin-chip px-2 py-1 text-[11px] font-semibold hover:bg-admin-chip2"
          >
            Hamısı
          </button>
          <button
            type="button"
            onClick={() => onChange([])}
            className="rounded-md bg-admin-chip px-2 py-1 text-[11px] font-semibold hover:bg-admin-chip2"
          >
            Heç biri
          </button>
        </div>
      </div>

      <div className="max-h-56 space-y-1 overflow-y-auto">
        {items.map((it) => (
          <label
            key={it.id}
            className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 hover:bg-admin-chip"
          >
            <input
              type="checkbox"
              checked={selected.includes(it.id)}
              onChange={() => toggle(it.id)}
              className="h-4 w-4 shrink-0"
            />
            {it.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-sm font-medium">{it.editionName}</span>
                {it.isPrimary && (
                  <span className="shrink-0 rounded bg-violet-100 px-1.5 py-px text-[9px] font-bold text-violet-700">
                    əsas
                  </span>
                )}
              </span>
              <span className="block truncate text-[11px] text-zinc-400">{it.title}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-sm font-bold">{it.finalAzn.toFixed(2)} ₼</span>
              {it.discountPct != null && (
                <span className="block text-[10px] font-semibold text-rose-600">
                  −{it.discountPct}% ({it.originalAzn?.toFixed(2)} ₼)
                </span>
              )}
              {it.platform && <span className="block text-[10px] text-zinc-400">{it.platform}</span>}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

type PickItem = { id: string; title: string; imageUrl: string | null; subtitle: string };

function ProductPicker({
  type,
  value,
  label,
  onPick,
}: {
  type: string;
  value: string;
  label: string;
  onPick: (id: string, label: string) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [openList, setOpenList] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch(
          `/api/admin/reels/products?type=${type}&q=${encodeURIComponent(q)}`,
          { cache: "no-store" },
        );
        const data = await res.json();
        if (!cancelled) setResults(Array.isArray(data.items) ? data.items : []);
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, type]);

  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-zinc-600">
        Məhsul {value && <span className="text-emerald-600">✓ seçildi{label ? `: ${label}` : ""}</span>}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-zinc-400" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpenList(true);
          }}
          onFocus={() => setOpenList(true)}
          placeholder={type === "GAME" ? "Oyun axtar..." : "Xidmət axtar..."}
          className="input"
          style={{ paddingLeft: "2rem" }}
        />
        {busy && <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-zinc-400" />}
      </div>
      {openList && results.length > 0 && (
        <div className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-admin-line bg-admin-card shadow-lg">
          {results.map((it) => (
            <button
              key={it.id}
              onClick={() => {
                onPick(it.id, it.title);
                setOpenList(false);
                setQ(it.title);
              }}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-admin-chip"
            >
              {it.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.imageUrl} alt="" className="h-8 w-8 rounded object-cover" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{it.title}</span>
                <span className="block truncate text-[11px] text-zinc-400">{it.subtitle}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
