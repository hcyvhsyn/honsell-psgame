"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2, Plus, Search, ThumbsUp, ThumbsDown, X, Sparkles, Trash2,
  CheckCircle2, Clock, AlertCircle, Film, Tv as TvIcon, Star, Share2, EyeOff, Eye, Quote, BadgeCheck,
  Bookmark, ChevronDown, ChevronUp, ListPlus,
} from "lucide-react";
import { STREAMING_SERVICE_LABELS, STREAMING_SERVICES, type StreamingService } from "@/lib/streamingCart";
import { formatAzDate } from "@/lib/streamingLanguages";
import { useDialog } from "@/lib/dialogs";

export type ReviewItem = {
  id: string;
  tmdbId: number;
  kind: "MOVIE" | "SERIES";
  service: string;
  rating: number;
  body: string;
  status: string;
  watchLanguage: string | null;
  spoiler: boolean;
  titleSnap: string;
  posterUrlSnap: string | null;
  backdropUrlSnap: string | null;
  yearSnap: number | null;
  genresSnap: string[];
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null; trusted?: boolean };
  likes: number;
  dislikes: number;
  myReaction: "LIKE" | "DISLIKE" | null;
  isMine: boolean;
  favorited: boolean;
};

type TmdbHit = {
  id: string;
  title: string;
  year: number | null;
  kind: "MOVIE" | "SERIES";
  posterUrl: string | null;
};

type TmdbDetails = {
  externalId: string;
  title: string;
  kind: "MOVIE" | "SERIES";
  year: number | null;
  description: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  genres: string[];
  originalLanguage: string | null;
  trailerUrl: string | null;
};

const RATING_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

const WATCH_LANG_OPTIONS: Array<{ code: string; label: string }> = [
  { code: "tr", label: "Türk dublyajı" },
  { code: "ru", label: "Rus dublyajı" },
  { code: "en", label: "İngilis dublyajı" },
  { code: "original", label: "Orijinal dil" },
];

function watchLangLabel(code: string | null): string | null {
  if (!code) return null;
  return WATCH_LANG_OPTIONS.find((o) => o.code === code)?.label ?? code.toUpperCase();
}

export default function StreamingReviewsClient({
  isLoggedIn,
  isTrusted,
  myUser,
  mine,
  feed,
}: {
  isLoggedIn: boolean;
  isTrusted: boolean;
  myUser: { id: string; name: string; avatarUrl: string | null } | null;
  mine: ReviewItem[];
  feed: ReviewItem[];
}) {
  const dialog = useDialog();
  const [items, setItems] = useState<ReviewItem[]>(() => [...mine, ...feed]);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    setItems([...mine, ...feed]);
  }, [mine, feed]);

  function onSubmitted(newItem: ReviewItem) {
    setItems((prev) => [newItem, ...prev]);
    setFormOpen(false);
  }

  async function onReact(id: string, kind: "LIKE" | "DISLIKE") {
    const prev = items;
    setItems((arr) =>
      arr.map((x) => {
        if (x.id !== id) return x;
        const wasLike = x.myReaction === "LIKE";
        const wasDislike = x.myReaction === "DISLIKE";
        let newKind: "LIKE" | "DISLIKE" | null = kind;
        let likes = x.likes;
        let dislikes = x.dislikes;
        if (x.myReaction === kind) {
          newKind = null;
          if (kind === "LIKE") likes -= 1;
          else dislikes -= 1;
        } else {
          if (wasLike) likes -= 1;
          if (wasDislike) dislikes -= 1;
          if (kind === "LIKE") likes += 1;
          else dislikes += 1;
        }
        return { ...x, myReaction: newKind, likes, dislikes };
      }),
    );
    const res = await fetch(`/api/streaming/reviews/${id}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind }),
    });
    if (!res.ok) {
      setItems(prev);
      const d = await res.json().catch(() => ({}));
      await dialog.alert({
        title: "Reaksiya göndərilmədi",
        message: d.error ?? "Yenidən cəhd edin.",
        tone: "danger",
      });
    }
  }

  async function onWatchlist(item: ReviewItem) {
    const prev = items;
    setItems((arr) =>
      arr.map((x) =>
        x.tmdbId === item.tmdbId && x.kind === item.kind ? { ...x, favorited: !x.favorited } : x,
      ),
    );
    const res = await fetch("/api/streaming/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tmdbId: item.tmdbId,
        kind: item.kind,
        titleSnap: item.titleSnap,
        posterUrlSnap: item.posterUrlSnap,
        yearSnap: item.yearSnap,
      }),
    });
    if (!res.ok) {
      setItems(prev);
      const d = await res.json().catch(() => ({}));
      await dialog.alert({
        title: "İzləmə listi yenilənmədi",
        message: d.error ?? "Yenidən cəhd edin.",
        tone: "danger",
      });
    }
  }

  async function onDelete(id: string) {
    if (
      !(await dialog.confirm({
        title: "İcmalı sil?",
        message: "Bu icmal silinəcək.",
        confirmLabel: "Sil",
        tone: "danger",
      }))
    )
      return;
    const res = await fetch(`/api/streaming/reviews/${id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((arr) => arr.filter((x) => x.id !== id));
    } else {
      const d = await res.json().catch(() => ({}));
      await dialog.alert({
        title: "Silinmədi",
        message: d.error ?? "Yenidən cəhd edin.",
        tone: "danger",
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm text-zinc-300">
          {isLoggedIn
            ? isTrusted
              ? "Etibarlı icmalçısan — yazdıqların dərhal yayımlanır."
              : "İcmalın admin tərəfindən yoxlanıldıqdan sonra yayımlanacaq."
            : "İcmal yazmaq üçün hesabınla daxil ol."}
        </p>
        {isLoggedIn ? (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-bold text-zinc-900 hover:bg-zinc-100"
          >
            <Plus className="h-4 w-4" /> Yeni icmal yaz
          </button>
        ) : (
          <Link
            href="/login?next=/icma"
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-bold text-zinc-900 hover:bg-zinc-100"
          >
            Daxil ol
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center text-sm text-zinc-400">
          Hələ heç bir icmal yoxdur. İlk yazan sən ol!
        </div>
      ) : (
        <ul className="space-y-6">
          {items.map((it) => (
            <li key={it.id} id={`r-${it.id}`}>
              <ReviewCard item={it} onReact={onReact} onWatchlist={onWatchlist} onDelete={onDelete} />
            </li>
          ))}
        </ul>
      )}

      {formOpen && myUser && (
        <NewReviewModal
          onClose={() => setFormOpen(false)}
          onSubmitted={onSubmitted}
          isTrusted={isTrusted}
          myUser={myUser}
        />
      )}
    </div>
  );
}

// ─── Review card ──────────────────────────────────────────────────────────────

function ReviewCard({
  item,
  onReact,
  onWatchlist,
  onDelete,
}: {
  item: ReviewItem;
  onReact: (id: string, kind: "LIKE" | "DISLIKE") => void;
  onWatchlist: (item: ReviewItem) => void;
  onDelete: (id: string) => void;
}) {
  const Kind = item.kind === "SERIES" ? TvIcon : Film;
  const [revealed, setRevealed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const watchLabel = watchLangLabel(item.watchLanguage);
  const isSpoilerHidden = item.spoiler && !item.isMine && !revealed;

  const EXCERPT_LEN = 220;
  const isLong = item.body.length > EXCERPT_LEN;
  const visibleText =
    !isLong || expanded
      ? item.body
      : item.body.slice(0, EXCERPT_LEN).replace(/\s+\S*$/, "") + "…";

  const platformLabel = STREAMING_SERVICE_LABELS[item.service] ?? item.service;
  const ratingLabel = ratingLabelFor(item.rating);
  const initial = (item.author.name || "?").trim().charAt(0).toUpperCase();

  const statusBadge =
    item.status === "PENDING" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300 ring-1 ring-amber-500/30">
        <Clock className="h-3 w-3" /> Yoxlanılır
      </span>
    ) : item.status === "REJECTED" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-300 ring-1 ring-rose-500/30">
        <AlertCircle className="h-3 w-3" /> Rədd edildi
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
        <CheckCircle2 className="h-3 w-3" /> Yayımda
      </span>
    );

  async function share() {
    const url = `${window.location.origin}/icma?tab=icmallar#r-${item.id}`;
    const shareData = {
      title: `${item.titleSnap} — ${item.rating}/10`,
      text: `${item.author.name} icmalı: "${item.body.slice(0, 120)}…"`,
      url,
    };
    try {
      if (typeof navigator !== "undefined" && (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share) {
        await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share(shareData);
        return;
      }
    } catch {
      // user cancelled
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      window.prompt("Bu linki kopyala:", url);
    }
  }

  return (
    <article className="relative isolate overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-br from-[#0d1018] via-[#0a0d14] to-[#070a10] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl"
      />

      <div className="relative grid gap-6 p-5 sm:p-6 md:grid-cols-[220px_1fr] md:gap-8 md:p-7 lg:grid-cols-[240px_1fr]">
        {/* Left: poster */}
        <div className="flex flex-col gap-3">
          <div className="group relative aspect-[2/3] w-full overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl shadow-black/60">
            {item.posterUrlSnap ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={item.posterUrlSnap}
                alt={item.titleSnap}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
              />
            ) : (
              <div className="grid h-full place-items-center">
                <Kind className="h-10 w-10 text-zinc-700" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0" />
          </div>
        </div>

        {/* Right: content */}
        <div className="flex min-w-0 flex-col gap-5">
          {/* chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-zinc-200 backdrop-blur-md">
              <Kind className="h-3.5 w-3.5" /> {item.kind === "SERIES" ? "SERİAL" : "FİLM"}
            </span>
            <PlatformBadge service={item.service} label={platformLabel} />
            {watchLabel && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-400/30 bg-indigo-400/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-indigo-200 backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5" /> {watchLabel} ilə izlənib
              </span>
            )}
            {item.spoiler && (
              <span className="inline-flex items-center rounded-full border border-rose-400/30 bg-rose-400/10 px-2.5 py-1 text-[11px] font-bold tracking-wider text-rose-200 backdrop-blur-md">
                SPOILER
              </span>
            )}
            {item.isMine && statusBadge}
          </div>

          {/* title + bookmark */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-balance text-2xl font-semibold leading-tight tracking-tight text-white sm:text-3xl md:text-4xl">
                {item.titleSnap}
              </h3>
              <p className="mt-2 text-sm text-zinc-400">
                {item.yearSnap ? `${item.yearSnap}` : ""}
                {item.genresSnap.length > 0
                  ? `${item.yearSnap ? " • " : ""}${item.genresSnap.join(" • ")}`
                  : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onWatchlist(item)}
              aria-label={item.favorited ? "Siyahıdan çıxar" : "Siyahıya əlavə et"}
              aria-pressed={item.favorited}
              className={`shrink-0 rounded-full border p-2.5 transition ${
                item.favorited
                  ? "border-amber-400/50 bg-amber-400/10 text-amber-300"
                  : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20 hover:text-zinc-200"
              }`}
            >
              <Bookmark className={`h-4 w-4 ${item.favorited ? "fill-amber-300" : ""}`} />
            </button>
          </div>

          {/* rating */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-xl border border-amber-400/30 bg-gradient-to-br from-amber-400/15 via-amber-400/5 to-transparent px-3.5 py-2 shadow-inner shadow-amber-500/10">
              <Star className="h-5 w-5 fill-amber-300 text-amber-300 drop-shadow" />
              <span className="text-lg font-bold text-amber-200 tabular-nums">
                {item.rating}
                <span className="ml-1 text-xs font-medium text-amber-200/60">/ 10</span>
              </span>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-zinc-100">{ratingLabel}</span>
              <span className="text-xs text-zinc-500">İzləməyə dəyər!</span>
            </div>
          </div>

          {/* review text */}
          <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
              <Quote className="h-3.5 w-3.5" />
              İstifadəçi rəyi
            </div>
            <div className="relative">
              <p
                className={`whitespace-pre-line text-[15px] leading-relaxed text-zinc-200 transition-all duration-300 ease-out sm:text-base ${
                  isSpoilerHidden ? "select-none blur-md" : ""
                }`}
              >
                {visibleText}
              </p>
              {isSpoilerHidden && (
                <button
                  type="button"
                  onClick={() => setRevealed(true)}
                  className="absolute inset-0 flex items-center justify-center rounded-xl bg-zinc-950/40 backdrop-blur-sm transition hover:bg-zinc-950/30"
                >
                  <span className="inline-flex items-center gap-2 rounded-full bg-rose-500/30 px-4 py-2 text-sm font-bold text-rose-100 ring-1 ring-rose-400/40">
                    <EyeOff className="h-4 w-4" /> Spoiler — açmaq üçün kliklə
                  </span>
                </button>
              )}
            </div>
            {isLong && !isSpoilerHidden && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-amber-300 transition hover:text-amber-200"
              >
                {expanded ? "Daha az" : "Daha çox"}
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            )}
            {item.spoiler && !isSpoilerHidden && !item.isMine && (
              <button
                type="button"
                onClick={() => setRevealed(false)}
                className="ml-3 mt-3 inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300"
              >
                <Eye className="h-3 w-3" /> Spoileri gizlət
              </button>
            )}
          </section>

          {/* author */}
          <div className="flex items-center gap-3">
            {item.author.avatarUrl ? (
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-white/15">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.author.avatarUrl}
                  alt={item.author.name}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-rose-500 text-sm font-bold uppercase text-black shadow-lg shadow-amber-500/20">
                {initial}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold text-zinc-100">
                  {item.author.name}
                </span>
                {item.author.trusted && (
                  <BadgeCheck
                    className="h-4 w-4 fill-amber-300 text-black"
                    aria-label="Etibarlı icmalçı"
                  />
                )}
              </div>
              <div className="text-xs text-zinc-500">{formatAzDate(item.createdAt)}</div>
            </div>
          </div>

          {/* actions */}
          {item.status === "APPROVED" && (
            <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-4">
              <button
                type="button"
                disabled={item.isMine}
                onClick={() => onReact(item.id, "LIKE")}
                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  item.myReaction === "LIKE"
                    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                    : "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                <ThumbsUp
                  className={`h-4 w-4 ${item.myReaction === "LIKE" ? "fill-current" : ""}`}
                />
                {item.likes}
              </button>
              <button
                type="button"
                disabled={item.isMine}
                onClick={() => onReact(item.id, "DISLIKE")}
                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  item.myReaction === "DISLIKE"
                    ? "border-rose-400/40 bg-rose-400/10 text-rose-200"
                    : "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                <ThumbsDown
                  className={`h-4 w-4 ${item.myReaction === "DISLIKE" ? "fill-current" : ""}`}
                />
                {item.dislikes}
              </button>

              <span className="hidden h-5 w-px bg-white/10 sm:inline-block" />

              <button
                type="button"
                onClick={() => onWatchlist(item)}
                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                  item.favorited
                    ? "border-rose-400/40 bg-rose-400/10 text-rose-200"
                    : "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                <ListPlus className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {item.favorited ? "İzləmə listində" : "İzləmə siyahısına əlavə et"}
                </span>
                <span className="sm:hidden">
                  {item.favorited ? "Siyahıda" : "Siyahıya əlavə"}
                </span>
              </button>
              <button
                type="button"
                onClick={share}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
              >
                <Share2 className="h-4 w-4" />
                {shareCopied ? "Link kopyalandı" : "Paylaş"}
              </button>
              {item.isMine && (
                <button
                  type="button"
                  onClick={() => onDelete(item.id)}
                  className="ml-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-rose-400/30 hover:bg-rose-500/10 hover:text-rose-300"
                >
                  <Trash2 className="h-4 w-4" /> Sil
                </button>
              )}
            </div>
          )}
          {item.status === "PENDING" && item.isMine && (
            <p className="border-t border-white/5 pt-4 text-xs text-zinc-500">
              Sənin icmalın admin yoxlamasındadır. Təsdiqdən sonra başqaları görə biləcək.
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function PlatformBadge({ service, label }: { service: string; label: string }) {
  const tones: Record<string, string> = {
    HBO_MAX:
      "from-fuchsia-500/30 via-violet-500/20 to-indigo-500/30 text-white border-violet-400/30",
    NETFLIX:
      "from-red-600/30 via-red-500/20 to-rose-500/30 text-white border-red-400/30",
    GAIN:
      "from-emerald-500/30 via-teal-500/20 to-cyan-500/30 text-white border-emerald-400/30",
    YOUTUBE_PREMIUM:
      "from-red-500/30 via-rose-500/20 to-pink-500/30 text-white border-red-400/30",
  };
  const tone =
    tones[service] ??
    "from-white/10 via-white/5 to-white/10 text-white border-white/15";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border bg-gradient-to-r px-2.5 py-1 text-[11px] font-extrabold tracking-[0.12em] shadow-sm ${tone}`}
    >
      {label.toUpperCase()}
    </span>
  );
}

function ratingLabelFor(value: number): string {
  if (value >= 9.5) return "Mükəmməl";
  if (value >= 8) return "Əla";
  if (value >= 6.5) return "Yaxşı";
  if (value >= 4.5) return "Orta";
  if (value >= 2.5) return "Zəif";
  return "Pis";
}

// ─── New review modal ─────────────────────────────────────────────────────────

function NewReviewModal({
  onClose,
  onSubmitted,
  isTrusted,
  myUser,
}: {
  onClose: () => void;
  onSubmitted: (it: ReviewItem) => void;
  isTrusted: boolean;
  myUser: { id: string; name: string; avatarUrl: string | null };
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TmdbHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [picked, setPicked] = useState<TmdbDetails | null>(null);
  const [filling, setFilling] = useState(false);

  const [service, setService] = useState<StreamingService>("NETFLIX");
  const [rating, setRating] = useState<number>(8);
  const [body, setBody] = useState("");
  const [watchLanguage, setWatchLanguage] = useState<string>("original");
  const [spoiler, setSpoiler] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    if (picked) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearchError(null);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const res = await fetch(`/api/streaming/lookup/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (!res.ok) {
          setSearchError(data.error ?? "Axtarış uğursuz");
          setResults([]);
        } else {
          setResults(data.results ?? []);
        }
      } catch {
        setSearchError("Şəbəkə xətası");
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query, picked]);

  async function pick(hit: TmdbHit) {
    setFilling(true);
    setSearchError(null);
    try {
      const params = new URLSearchParams({ id: hit.id, kind: hit.kind });
      const res = await fetch(`/api/streaming/lookup/details?${params}`);
      const d = await res.json();
      if (!res.ok) {
        setSearchError(d.error ?? "Məlumat çəkilmədi");
        return;
      }
      setPicked(d as TmdbDetails);
      setResults([]);
      setQuery("");
    } finally {
      setFilling(false);
    }
  }

  async function submit() {
    if (!picked) return;
    if (body.trim().length < 10) {
      setSubmitError("İcmal mətni ən az 10 simvol olmalıdır");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const res = await fetch("/api/streaming/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tmdbId: Number(picked.externalId),
        kind: picked.kind,
        service,
        rating,
        body: body.trim(),
        watchLanguage,
        spoiler,
        titleSnap: picked.title,
        posterUrlSnap: picked.posterUrl,
        backdropUrlSnap: picked.backdropUrl,
        yearSnap: picked.year,
        genresSnap: picked.genres,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setSubmitError(d.error ?? "Yadda saxlanmadı");
      setSubmitting(false);
      return;
    }
    const created = await res.json();
    setSubmitting(false);

    const item: ReviewItem = {
      id: created.id,
      tmdbId: Number(picked.externalId),
      kind: picked.kind,
      service,
      rating,
      body: body.trim(),
      status: created.status ?? (isTrusted ? "APPROVED" : "PENDING"),
      watchLanguage,
      spoiler,
      titleSnap: picked.title,
      posterUrlSnap: picked.posterUrl,
      backdropUrlSnap: picked.backdropUrl,
      yearSnap: picked.year,
      genresSnap: picked.genres,
      createdAt: new Date().toISOString(),
      author: { id: myUser.id, name: myUser.name, avatarUrl: myUser.avatarUrl, trusted: isTrusted },
      likes: 0,
      dislikes: 0,
      myReaction: null,
      isMine: true,
      favorited: false,
    };
    onSubmitted(item);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-3 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Yeni icmal yaz</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!picked ? (
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-indigo-200">
              <Sparkles className="h-4 w-4" /> Film və ya serial seç
            </p>
            <p className="mb-3 text-xs text-indigo-300/70">
              Adı yaz, TMDB-dən nəticələri gətirək — başlıq, poster, il və janr avtomatik dolacaq.
            </p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Məs: Stranger Things"
                className="w-full rounded border border-zinc-800 bg-zinc-900 pl-9 pr-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                autoFocus
              />
            </div>
            {searchError && (
              <div className="mt-2 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                {searchError}
              </div>
            )}
            {(searching || results.length > 0) && (
              <div className="mt-3 max-h-72 overflow-y-auto rounded border border-zinc-800 bg-zinc-900">
                {searching && <div className="px-3 py-2 text-xs text-zinc-500">Axtarılır...</div>}
                {results.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    disabled={filling}
                    onClick={() => pick(h)}
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
                        {h.year ? ` · ${h.year}` : ""}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
              <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded bg-zinc-900">
                {picked.posterUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={picked.posterUrl} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold text-white">{picked.title}</p>
                <p className="text-xs text-zinc-500">
                  {picked.kind === "SERIES" ? "Serial" : "Film"}
                  {picked.year ? ` · ${picked.year}` : ""}
                </p>
                {picked.genres.length > 0 && (
                  <p className="mt-1 text-xs text-zinc-400">{picked.genres.join(", ")}</p>
                )}
              </div>
              <button type="button" onClick={() => setPicked(null)} className="text-zinc-500 hover:text-rose-300">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <p className="mb-2 text-sm text-zinc-300">Hansı platformada izlədin?</p>
              <div className="flex flex-wrap gap-2">
                {STREAMING_SERVICES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setService(s)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      service === s
                        ? "border-indigo-400/60 bg-indigo-500/25 text-white"
                        : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-600"
                    }`}
                  >
                    {STREAMING_SERVICE_LABELS[s] ?? s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm text-zinc-300">Hansı dildə izlədin?</p>
              <div className="flex flex-wrap gap-2">
                {WATCH_LANG_OPTIONS.map((o) => (
                  <button
                    key={o.code}
                    type="button"
                    onClick={() => setWatchLanguage(o.code)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      watchLanguage === o.code
                        ? "border-emerald-400/60 bg-emerald-500/20 text-white"
                        : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-600"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm text-zinc-300">
                Reytinq: <span className="font-bold text-amber-300">{rating}/10</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {RATING_VALUES.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    className={`h-9 w-9 rounded-full text-sm font-bold transition ${
                      n <= rating ? "bg-amber-400 text-zinc-900" : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm text-zinc-300">İcmal mətni</p>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                maxLength={2000}
                placeholder="Filmi/serialı necə qiymətləndirirsən? Süjet, oyunçuluq, vizual..."
                className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              />
              <p className="mt-1 text-right text-[11px] text-zinc-500">{body.length}/2000</p>
            </div>

            <label className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={spoiler}
                onChange={(e) => setSpoiler(e.target.checked)}
                className="mt-1"
              />
              <span>
                <span className="font-semibold text-rose-300">Spoiler var</span>
                <span className="ml-1 text-xs text-zinc-500">— digər istifadəçilərdə icmal mətni blurlu görünəcək, klik edib açacaqlar.</span>
              </span>
            </label>

            {!isTrusted && (
              <div className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                İcmal admin tərəfindən yoxlanıldıqdan sonra başqaları görə biləcək.
              </div>
            )}
            {submitError && (
              <div className="rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                {submitError}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
              >
                İmtina
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded bg-white px-4 py-2 text-sm font-bold text-zinc-900 hover:bg-zinc-100 disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                İcmalı paylaş
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
