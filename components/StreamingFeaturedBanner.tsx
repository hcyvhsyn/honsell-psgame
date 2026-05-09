"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Film, Tv as TvIcon, Play } from "lucide-react";
import { STREAMING_SERVICE_LABELS } from "@/lib/streamingCart";
import TrailerModal from "@/components/TrailerModal";

export type FeaturedSlide = {
  id: string;
  titleId: string;
  title: string;
  service: string;
  kind: "MOVIE" | "SERIES";
  year: number | null;
  description: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  genres: string[];
  trailerUrl: string | null;
};

export default function StreamingFeaturedBanner({ slides }: { slides: FeaturedSlide[] }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);

  const prev = useCallback(
    () => setCurrent((c) => (c - 1 + slides.length) % slides.length),
    [slides.length],
  );
  const next = useCallback(
    () => setCurrent((c) => (c + 1) % slides.length),
    [slides.length],
  );

  useEffect(() => {
    // Trailer modal açıq olanda auto-rotate-i dayandırırıq — yoxsa slaydlar
    // modal-ın arxasında fade ilə dəyişir və yarı-şəffaf backdrop-dan
    // "qaralma/ağarma" effekti görünür.
    if (slides.length <= 1 || paused || trailerOpen) return;
    const id = setInterval(next, 6000);
    return () => clearInterval(id);
  }, [slides.length, paused, next, trailerOpen]);

  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => setTouchStartX(e.touches[0].clientX);
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) {
      if (dx < 0) next();
      else prev();
    }
    setTouchStartX(null);
  };

  if (slides.length === 0) return null;
  const slide = slides[current];
  const Kind = slide.kind === "SERIES" ? TvIcon : Film;

  return (
    <div
      className="grid w-full gap-3 lg:grid-cols-[minmax(0,1fr)_280px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="group relative w-full overflow-hidden rounded-2xl aspect-[4/5] sm:aspect-[16/8] lg:aspect-[21/9]"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {slides.map((s, i) => {
          const src = s.backdropUrl || s.posterUrl;
          return (
            <div
              key={s.id}
              className={`absolute inset-0 transition-opacity duration-700 ${
                i === current ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              {src && (
                <Image
                  src={src}
                  alt={s.title}
                  fill
                  sizes="(max-width: 1280px) 100vw, 1000px"
                  className="object-cover object-center"
                  priority={i === 0}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent sm:bg-gradient-to-r sm:from-black/85 sm:via-black/35 sm:to-transparent" />
            </div>
          );
        })}

        <div className="absolute inset-x-0 bottom-0 p-5 pb-12 sm:bottom-0 sm:right-auto sm:max-w-[60%] sm:p-8 sm:pb-10 lg:p-10 lg:pb-12">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white backdrop-blur-md ring-1 ring-white/25">
              <Kind className="h-3 w-3" />
              {slide.kind === "SERIES" ? "Serial" : "Film"}
            </span>
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md ring-1 ring-white/25">
              {STREAMING_SERVICE_LABELS[slide.service] ?? slide.service}
            </span>
            {slide.year && (
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md ring-1 ring-white/25">
                {slide.year}
              </span>
            )}
          </div>

          <h2 className="mt-3 text-2xl font-black leading-tight text-white drop-shadow-lg sm:text-3xl lg:text-5xl">
            {slide.title}
          </h2>

          {slide.genres.length > 0 && (
            <p className="mt-2 text-xs uppercase tracking-widest text-zinc-300 drop-shadow sm:text-sm">
              {slide.genres.join(" · ")}
            </p>
          )}

          {slide.description && (
            <p className="mt-3 line-clamp-3 max-w-xl text-sm leading-snug text-zinc-200 drop-shadow sm:text-base">
              {slide.description}
            </p>
          )}

          {slide.trailerUrl && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setTrailerOpen(true);
              }}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-zinc-900 shadow-lg transition hover:bg-zinc-100"
            >
              <Play className="h-4 w-4 fill-current" /> Trailer izlə
            </button>
          )}
        </div>

        {slides.length > 1 && (
          <>
            <button
              aria-label="Əvvəlki"
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition hover:bg-black/70 sm:left-3 sm:opacity-0 sm:group-hover:opacity-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              aria-label="Növbəti"
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition hover:bg-black/70 sm:right-3 sm:opacity-0 sm:group-hover:opacity-100"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 lg:hidden">
              {slides.map((_, i) => (
                <button
                  key={i}
                  aria-label={`Slide ${i + 1}`}
                  onClick={() => setCurrent(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === current ? "w-6 bg-white" : "w-1.5 bg-white/40"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Right list (desktop) */}
      {slides.length > 1 && (
        <ul
          className="hidden flex-col gap-2 overflow-y-auto pr-1 lg:flex"
          style={{ maxHeight: "100%" }}
        >
          {slides.map((s, i) => {
            const active = i === current;
            const thumb = s.posterUrl || s.backdropUrl;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setCurrent(i)}
                  onMouseEnter={() => setPaused(true)}
                  className={`group/item flex w-full items-center gap-3 rounded-xl p-2 text-left transition ${
                    active ? "bg-white/10 ring-1 ring-white/15" : "hover:bg-white/5"
                  }`}
                >
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-900">
                    {thumb && (
                      <Image src={thumb} alt={s.title} fill sizes="56px" className="object-cover" />
                    )}
                  </div>
                  <span
                    className={`line-clamp-2 text-sm font-medium leading-tight ${
                      active ? "text-white" : "text-zinc-300 group-hover/item:text-white"
                    }`}
                  >
                    {s.title}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <TrailerModal
        open={trailerOpen}
        onClose={() => setTrailerOpen(false)}
        url={slide.trailerUrl}
        title={slide.title}
      />
    </div>
  );
}
