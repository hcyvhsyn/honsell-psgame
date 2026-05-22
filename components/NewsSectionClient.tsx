"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Calendar,
  Newspaper,
  Radio,
  Sparkles,
  X,
} from "lucide-react";

export type NewsCardData = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  coverImageUrl: string | null;
  category: string | null;
  isFeatured: boolean;
  publishedAt: string;
};

type Props = {
  items: NewsCardData[];
  title?: string;
  subtitle?: string;
};

export default function NewsSectionClient({
  items,
  title = "Xəbərlər və Yeniliklər",
  subtitle = "Platforma ilə bağlı ən son anonslar, endirimlər və daha çoxu.",
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  const featured = useMemo(() => items.find((i) => i.isFeatured) ?? items[0], [items]);
  const rest = useMemo(
    () => items.filter((i) => i.id !== featured?.id),
    [items, featured],
  );

  const opened = items.find((i) => i.id === openId) ?? null;

  // Modal açılanda body scroll-unu bağla
  useEffect(() => {
    if (!openId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [openId]);

  // Esc düyməsi ilə bağlama
  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId]);

  return (
    <section className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 sm:py-20">
      {/* Ambient glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
      </div>

      {/* Header */}
      <header className="mb-10 flex flex-col gap-3 sm:mb-14">
        <div className="inline-flex items-center gap-2 self-start rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-200">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
          </span>
          <Radio className="h-3 w-3" /> Canlı Xəbərlər
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-balance text-3xl font-black leading-tight tracking-tight text-zinc-950 dark:text-white sm:text-5xl">
              {title}
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400 sm:text-base">{subtitle}</p>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500 shadow-sm dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-400 dark:shadow-none sm:inline-flex">
            <Newspaper className="h-3.5 w-3.5" />
            {items.length} yazı
          </div>
        </div>
      </header>

      {/* Featured hero */}
      {featured && <FeaturedCard item={featured} onOpen={() => setOpenId(featured.id)} />}

      {/* Grid */}
      {rest.length > 0 && (
        <div className="mt-6 grid gap-5 sm:mt-8 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {rest.map((it) => (
            <NewsCard key={it.id} item={it} onOpen={() => setOpenId(it.id)} />
          ))}
        </div>
      )}

      {/* Article modal */}
      {opened && <ArticleModal item={opened} onClose={() => setOpenId(null)} />}
    </section>
  );
}

/* ─── Featured ─────────────────────────────────────────────── */

function FeaturedCard({ item, onOpen }: { item: NewsCardData; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative block w-full overflow-hidden rounded-3xl border border-zinc-200 bg-white text-left shadow-[0_40px_120px_-60px_rgba(15,23,42,0.45)] transition hover:border-zinc-300 hover:shadow-[0_40px_120px_-56px_rgba(124,58,237,0.45)] dark:border-white/10 dark:bg-zinc-900 dark:shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)] dark:hover:border-white/20"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-zinc-950 sm:aspect-[21/9]">
        {item.coverImageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={item.coverImageUrl}
            alt={item.title}
            className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="grid h-full place-items-center bg-gradient-to-br from-fuchsia-900/40 via-zinc-900 to-amber-900/30">
            <Sparkles className="h-16 w-16 text-zinc-700" />
          </div>
        )}

        {/* gradient stack */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/70 via-transparent to-transparent" />

        {/* corner badges */}
        <div className="absolute left-4 top-4 flex items-center gap-2 sm:left-6 sm:top-6">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/95 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-zinc-900 shadow-lg">
            <Sparkles className="h-3 w-3" /> Featured
          </span>
          {item.category && (
            <span className="inline-flex items-center rounded-full border border-white/20 bg-black/40 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-md">
              {item.category}
            </span>
          )}
        </div>

        <div className="absolute right-4 top-4 hidden items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[10px] font-medium text-zinc-200 backdrop-blur-md sm:inline-flex sm:right-6 sm:top-6">
          <Calendar className="h-3 w-3" />
          {formatDate(item.publishedAt)}
        </div>

        {/* content */}
        <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8 lg:p-10">
          <h3 className="max-w-3xl text-balance text-2xl font-black leading-tight text-white drop-shadow-lg sm:text-4xl lg:text-5xl">
            {item.title}
          </h3>
          {item.excerpt && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-200 line-clamp-2 sm:mt-4 sm:text-base">
              {item.excerpt}
            </p>
          )}
          <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-zinc-900 shadow-lg transition group-hover:gap-3">
            Davam et <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </button>
  );
}

/* ─── Card ─────────────────────────────────────────────────── */

function NewsCard({ item, onOpen }: { item: NewsCardData; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:border-violet-300 hover:shadow-xl dark:border-white/[0.08] dark:bg-gradient-to-br dark:from-[#0e1119] dark:to-[#0a0c12] dark:shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)] dark:hover:border-white/20 dark:hover:shadow-[0_30px_70px_-30px_rgba(99,1,243,0.4)]"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-950">
        {item.coverImageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={item.coverImageUrl}
            alt={item.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.06]"
          />
        ) : (
          <div className="grid h-full place-items-center bg-gradient-to-br from-indigo-100 to-fuchsia-100 dark:from-indigo-900/30 dark:to-fuchsia-900/30">
            <Newspaper className="h-10 w-10 text-zinc-400 dark:text-zinc-700" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

        {item.category && (
          <span className="absolute left-3 top-3 inline-flex items-center rounded-full border border-white/20 bg-black/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-md">
            {item.category}
          </span>
        )}

        <span className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white backdrop-blur-md transition group-hover:bg-white group-hover:text-black">
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-5">
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <Calendar className="h-3 w-3" />
          {formatDate(item.publishedAt)}
        </div>
        <h3 className="line-clamp-2 text-balance text-lg font-bold leading-snug text-zinc-950 transition group-hover:text-violet-700 dark:text-white dark:group-hover:text-amber-200">
          {item.title}
        </h3>
        {item.excerpt && (
          <p className="line-clamp-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{item.excerpt}</p>
        )}
        <span className="mt-auto inline-flex items-center gap-1 pt-2 text-xs font-bold uppercase tracking-wider text-violet-600 transition group-hover:gap-2 dark:text-amber-300">
          Oxu <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </button>
  );
}

/* ─── Modal ────────────────────────────────────────────────── */

function ArticleModal({
  item,
  onClose,
}: {
  item: NewsCardData;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-zinc-950/75 p-0 backdrop-blur-md sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <article
        className="relative max-h-[92vh] w-full max-w-3xl overflow-hidden overflow-y-auto rounded-t-3xl border border-zinc-200 bg-white shadow-[0_40px_120px_-42px_rgba(15,23,42,0.7)] dark:border-white/10 dark:bg-gradient-to-b dark:from-[#0c0e16] dark:to-[#070910] dark:shadow-[0_40px_120px_-30px_rgba(0,0,0,0.95)] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Bağla"
          className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white backdrop-blur-md transition hover:bg-black/80"
        >
          <X className="h-5 w-5" />
        </button>

        {item.coverImageUrl && (
          <div className="relative aspect-[21/9] w-full overflow-hidden bg-zinc-950">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.coverImageUrl}
              alt={item.title}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent dark:from-[#0c0e16]" />
          </div>
        )}

        <div className="px-5 pb-10 pt-6 sm:px-10 sm:pt-8">
          <div className="flex flex-wrap items-center gap-2">
            {item.category && (
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
                {item.category}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
              <Calendar className="h-3 w-3" />
              {formatDate(item.publishedAt)}
            </span>
          </div>
          <h1 className="mt-4 text-balance text-3xl font-black leading-tight text-zinc-950 dark:text-white sm:text-4xl">
            {item.title}
          </h1>
          {item.excerpt && (
            <p className="mt-3 text-base leading-relaxed text-zinc-600 dark:text-zinc-300">{item.excerpt}</p>
          )}
          <div className="my-6 h-px bg-zinc-200 dark:bg-white/10" />
          <div className="whitespace-pre-line text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-200 sm:text-base">
            {item.body}
          </div>
        </div>
      </article>
    </div>
  );
}

/* ─── helpers ──────────────────────────────────────────────── */

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
