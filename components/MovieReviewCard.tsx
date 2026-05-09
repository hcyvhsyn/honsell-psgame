"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  BadgeCheck,
  Bookmark,
  ChevronDown,
  ChevronUp,
  ListPlus,
  MessageCircle,
  PencilLine,
  Play,
  Quote,
  Share2,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Tv,
} from "lucide-react";

export type MovieReviewKind = "FILM" | "SERIAL";

export type MovieReviewData = {
  id: string;
  kind: MovieReviewKind;
  title: string;
  year: number;
  genres: string[];
  posterUrl: string | null;
  platform?: { name: string; tone?: "hbo" | "netflix" | "disney" | "prime" | "apple" };
  watchedDubbed?: boolean;
  hasSpoiler?: boolean;
  trailerUrl?: string | null;
  rating: number;
  ratingMax?: number;
  body: string;
  excerptLength?: number;
  author: { name: string; avatarUrl?: string | null; verified?: boolean };
  createdAt: string;
  likes: number;
  dislikes: number;
  commentCount: number;
};

type Props = {
  review?: MovieReviewData;
  onWriteComment?: () => void;
  onShare?: () => void;
  onAddToWatchlist?: () => void;
  onPlayTrailer?: () => void;
};

const SAMPLE: MovieReviewData = {
  id: "demo-1",
  kind: "SERIAL",
  title: "Kralın Son Cəngavəri",
  year: 2026,
  genres: ["Drama", "Fantastik", "Macəra"],
  posterUrl: null,
  platform: { name: "HBO Max", tone: "hbo" },
  watchedDubbed: true,
  hasSpoiler: true,
  trailerUrl: "#",
  rating: 10,
  ratingMax: 10,
  body:
    "Yeddi Krallığın atmosferi ilk dəqiqədən sizi içinə çəkir. Səhnələrin ritmi, musiqi və operator işi həqiqətən kinematik səviyyədədir. Personajlar arasındakı dialoqlar güclü yazılıb, hər bölümün finalı növbəti epizoda başlamaq üçün sizi şirin bir gərginlikdə saxlayır. Türk dublyajı ilə izlədim — səsləndirmə qəhrəmanların xarakterinə uyğun, mətn axıcı tərcümə olunub. Vizual effektlər mübaliğəsiz, hekayə bunun arxasında itmir. Qısaca: bu mövsümün ən mükəmməl serialı və mütləq izlənməli buraxılışlardan biridir.",
  excerptLength: 180,
  author: { name: "huseyn", verified: true },
  createdAt: "2026-05-09T12:00:00.000Z",
  likes: 125,
  dislikes: 3,
  commentCount: 28,
};

export default function MovieReviewCard({
  review = SAMPLE,
  onWriteComment,
  onShare,
  onAddToWatchlist,
  onPlayTrailer,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [reaction, setReaction] = useState<0 | 1 | -1>(0);
  const [likes, setLikes] = useState(review.likes);
  const [dislikes, setDislikes] = useState(review.dislikes);
  const [bookmarked, setBookmarked] = useState(false);

  const excerptLen = review.excerptLength ?? 180;
  const isLong = review.body.length > excerptLen;
  const visibleText = useMemo(() => {
    if (!isLong || expanded) return review.body;
    const cut = review.body.slice(0, excerptLen);
    return cut.replace(/\s+\S*$/, "") + "…";
  }, [review.body, excerptLen, expanded, isLong]);

  function handleLike() {
    if (reaction === 1) {
      setReaction(0);
      setLikes((n) => Math.max(0, n - 1));
      return;
    }
    if (reaction === -1) {
      setDislikes((n) => Math.max(0, n - 1));
    }
    setReaction(1);
    setLikes((n) => n + 1);
  }

  function handleDislike() {
    if (reaction === -1) {
      setReaction(0);
      setDislikes((n) => Math.max(0, n - 1));
      return;
    }
    if (reaction === 1) {
      setLikes((n) => Math.max(0, n - 1));
    }
    setReaction(-1);
    setDislikes((n) => n + 1);
  }

  const initial = (review.author.name?.trim()?.[0] ?? "?").toUpperCase();
  const ratingMax = review.ratingMax ?? 10;
  const ratingLabel = ratingLabelFor(review.rating, ratingMax);

  return (
    <article className="relative isolate overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-br from-[#0d1018] via-[#0a0d14] to-[#070a10] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]">
      {/* ambient glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl"
      />

      <div className="relative grid gap-6 p-5 sm:p-6 md:grid-cols-[220px_1fr] md:gap-8 md:p-7 lg:grid-cols-[240px_1fr]">
        {/* ───── Left: poster + trailer ───── */}
        <div className="flex flex-col gap-3">
          <div className="group relative aspect-[2/3] w-full overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl shadow-black/60">
            {review.posterUrl ? (
              <Image
                src={review.posterUrl}
                alt={review.title}
                fill
                sizes="(min-width: 1024px) 240px, (min-width: 768px) 220px, 60vw"
                className="object-cover transition duration-700 group-hover:scale-105"
              />
            ) : (
              <PosterFallback title={review.title} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0" />
          </div>

          <button
            type="button"
            onClick={onPlayTrailer}
            className="group inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-zinc-100 backdrop-blur-md transition hover:border-amber-400/40 hover:bg-amber-400/10 hover:text-amber-200"
          >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-amber-400 text-black transition group-hover:scale-110">
              <Play className="h-3 w-3 fill-black" />
            </span>
            Treyleri izlə
          </button>
        </div>

        {/* ───── Right: content ───── */}
        <div className="flex min-w-0 flex-col gap-5">
          {/* chips */}
          <div className="flex flex-wrap items-center gap-2">
            <Chip>
              <Tv className="h-3.5 w-3.5" />
              {review.kind === "SERIAL" ? "SERİAL" : "FİLM"}
            </Chip>
            {review.platform ? <PlatformBadge platform={review.platform} /> : null}
            {review.watchedDubbed ? (
              <Chip tone="indigo">
                <Sparkles className="h-3.5 w-3.5" />
                Türk dublyajı ilə izlənib
              </Chip>
            ) : null}
            {review.hasSpoiler ? (
              <Chip tone="rose">
                <span className="font-bold tracking-wider">SPOILER</span>
              </Chip>
            ) : null}
          </div>

          {/* title row */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-balance text-2xl font-semibold leading-tight tracking-tight text-white sm:text-3xl md:text-4xl">
                {review.title}
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                {review.year} <span className="mx-1.5 text-zinc-600">•</span>
                {review.genres.join(" • ")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setBookmarked((b) => !b)}
              aria-label="Saxla"
              aria-pressed={bookmarked}
              className={`shrink-0 rounded-full border p-2.5 transition ${
                bookmarked
                  ? "border-amber-400/50 bg-amber-400/10 text-amber-300"
                  : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20 hover:text-zinc-200"
              }`}
            >
              <Bookmark
                className={`h-4 w-4 ${bookmarked ? "fill-amber-300" : ""}`}
              />
            </button>
          </div>

          {/* rating */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-xl border border-amber-400/30 bg-gradient-to-br from-amber-400/15 via-amber-400/5 to-transparent px-3.5 py-2 shadow-inner shadow-amber-500/10">
              <Star className="h-5 w-5 fill-amber-300 text-amber-300 drop-shadow" />
              <span className="text-lg font-bold text-amber-200">
                {review.rating}
                <span className="ml-1 text-xs font-medium text-amber-200/60">
                  / {ratingMax}
                </span>
              </span>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-zinc-100">
                {ratingLabel}
              </span>
              <span className="text-xs text-zinc-500">İzləməyə dəyər!</span>
            </div>
          </div>

          {/* review text */}
          <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
              <Quote className="h-3.5 w-3.5" />
              İstifadəçi rəyi
            </div>
            <p
              className={`text-[15px] leading-relaxed text-zinc-200 transition-all duration-300 ease-out sm:text-base ${
                expanded ? "" : "line-clamp-none"
              }`}
            >
              {visibleText}
            </p>
            {isLong ? (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-amber-300 transition hover:text-amber-200"
              >
                {expanded ? "Daha az" : "Daha çox"}
                {expanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            ) : null}
          </section>

          {/* author */}
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-rose-500 text-sm font-bold uppercase text-black shadow-lg shadow-amber-500/20">
              {initial}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold text-zinc-100">
                  {review.author.name}
                </span>
                {review.author.verified ? (
                  <BadgeCheck className="h-4 w-4 fill-amber-300 text-black" />
                ) : null}
              </div>
              <div className="text-xs text-zinc-500">{formatDate(review.createdAt)}</div>
            </div>
          </div>

          {/* actions */}
          <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-4">
            <ActionPill
              active={reaction === 1}
              onClick={handleLike}
              tone="emerald"
              icon={<ThumbsUp className="h-4 w-4" />}
            >
              {likes}
            </ActionPill>
            <ActionPill
              active={reaction === -1}
              onClick={handleDislike}
              tone="rose"
              icon={<ThumbsDown className="h-4 w-4" />}
            >
              {dislikes}
            </ActionPill>
            <ActionPill
              onClick={onWriteComment}
              icon={<MessageCircle className="h-4 w-4" />}
            >
              <span className="font-semibold">{review.commentCount}</span>
              <span className="ml-1 hidden text-zinc-400 sm:inline">Cavab ver</span>
            </ActionPill>

            <span className="hidden h-5 w-px bg-white/10 sm:inline-block" />

            <ActionPill
              onClick={onWriteComment}
              icon={<PencilLine className="h-4 w-4" />}
            >
              Şərh yaz
            </ActionPill>
            <ActionPill
              onClick={onAddToWatchlist}
              icon={<ListPlus className="h-4 w-4" />}
            >
              <span className="hidden sm:inline">İzləmə siyahısına əlavə et</span>
              <span className="sm:hidden">Siyahıya əlavə</span>
            </ActionPill>
            <ActionPill onClick={onShare} icon={<Share2 className="h-4 w-4" />}>
              Paylaş
            </ActionPill>
          </div>
        </div>
      </div>
    </article>
  );
}

/* ─── helpers ───────────────────────────────────────────── */

function Chip({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "indigo" | "rose";
}) {
  const tones: Record<string, string> = {
    default:
      "border-white/10 bg-white/[0.04] text-zinc-200",
    indigo:
      "border-indigo-400/30 bg-indigo-400/10 text-indigo-200",
    rose: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider backdrop-blur-md ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function PlatformBadge({
  platform,
}: {
  platform: NonNullable<MovieReviewData["platform"]>;
}) {
  const tones: Record<string, string> = {
    hbo: "from-fuchsia-500/30 via-violet-500/20 to-indigo-500/30 text-white border-violet-400/30",
    netflix: "from-red-600/30 via-red-500/20 to-rose-500/30 text-white border-red-400/30",
    disney: "from-sky-500/30 via-blue-500/20 to-indigo-500/30 text-white border-sky-400/30",
    prime: "from-cyan-500/30 via-sky-500/20 to-blue-500/30 text-white border-cyan-400/30",
    apple: "from-zinc-300/30 via-zinc-200/20 to-zinc-400/30 text-white border-zinc-300/30",
  };
  const tone = tones[platform.tone ?? ""] ?? tones.hbo;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border bg-gradient-to-r px-2.5 py-1 text-[11px] font-extrabold tracking-[0.12em] shadow-sm ${tone}`}
    >
      {platform.name.toUpperCase()}
    </span>
  );
}

function ActionPill({
  children,
  icon,
  onClick,
  active = false,
  tone,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  tone?: "emerald" | "rose";
}) {
  const idle =
    "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/20 hover:bg-white/[0.06] hover:text-white";
  const activeStyles =
    tone === "emerald"
      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
      : tone === "rose"
        ? "border-rose-400/40 bg-rose-400/10 text-rose-200"
        : "border-white/30 bg-white/10 text-white";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${active ? activeStyles : idle}`}
    >
      {icon}
      <span className="inline-flex items-center">{children}</span>
    </button>
  );
}

function PosterFallback({ title }: { title: string }) {
  const initials = title
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div className="grid h-full w-full place-items-center bg-gradient-to-br from-zinc-800 via-zinc-900 to-black">
      <span className="text-3xl font-bold tracking-widest text-zinc-500">
        {initials || "—"}
      </span>
    </div>
  );
}

function ratingLabelFor(value: number, max: number): string {
  const pct = (value / max) * 100;
  if (pct >= 95) return "Mükəmməl";
  if (pct >= 80) return "Əla";
  if (pct >= 65) return "Yaxşı";
  if (pct >= 45) return "Orta";
  if (pct >= 25) return "Zəif";
  return "Pis";
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("az-AZ", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
}
