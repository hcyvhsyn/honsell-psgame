"use client";

import { useState } from "react";
import { Film, Tv as TvIcon, Play } from "lucide-react";
import TrailerModal from "./TrailerModal";

export type StreamingTitleCardData = {
  id: string;
  title: string;
  kind: "MOVIE" | "SERIES";
  year: number | null;
  posterUrl: string | null;
  /** ISO dil kodları — public kartda kiçik badge-lər kimi göstərilir. */
  dubbedLanguages?: string[];
  subtitleLanguages?: string[];
  /** YouTube URL — varsa kart üzərində play overlay-i görünür. */
  trailerUrl?: string | null;
};

export default function StreamingTitleCard({ title }: { title: StreamingTitleCardData }) {
  const Kind = title.kind === "SERIES" ? TvIcon : Film;
  const [trailerOpen, setTrailerOpen] = useState(false);
  // Yalnız ən populyar 2 dil badge-i göstəririk ki, kart sıxılmasın.
  const dubs = (title.dubbedLanguages ?? []).slice(0, 2);
  const subs = (title.subtitleLanguages ?? []).slice(0, 2);
  const hasTrailer = Boolean(title.trailerUrl);

  return (
    <div className="group relative w-full overflow-hidden rounded-xl border border-white/10 bg-zinc-900 transition hover:-translate-y-0.5 hover:border-indigo-500/40">
      <div className="relative aspect-[2/3] w-full">
        {title.posterUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={title.posterUrl}
            alt={title.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
            <Kind className="h-10 w-10 text-zinc-700" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
        {(dubs.length > 0 || subs.length > 0) && (
          <div className="absolute right-2 top-2 flex flex-wrap gap-1">
            {dubs.map((c) => (
              <span
                key={`d-${c}`}
                className="rounded bg-indigo-500/85 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white shadow"
                title={`Dublyaj: ${c.toUpperCase()}`}
              >
                {c.toUpperCase()} dub
              </span>
            ))}
            {subs.map((c) => (
              <span
                key={`s-${c}`}
                className="rounded bg-emerald-500/85 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white shadow"
                title={`Subtitr: ${c.toUpperCase()}`}
              >
                {c.toUpperCase()} sub
              </span>
            ))}
          </div>
        )}
        {hasTrailer && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setTrailerOpen(true);
            }}
            aria-label={`${title.title} trailer-ini izlə`}
            className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100 focus:opacity-100"
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-white/95 text-zinc-900 shadow-2xl transition hover:scale-110">
              <Play className="h-5 w-5 fill-current" />
            </span>
          </button>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p className="line-clamp-2 text-sm font-bold leading-tight text-white">
            {title.title}
          </p>
          <p className="mt-1 text-[11px] text-zinc-400">
            {title.kind === "SERIES" ? "Serial" : "Film"}
            {title.year ? ` · ${title.year}` : ""}
          </p>
        </div>
      </div>

      {hasTrailer && (
        <TrailerModal
          open={trailerOpen}
          onClose={() => setTrailerOpen(false)}
          url={title.trailerUrl ?? null}
          title={title.title}
        />
      )}
    </div>
  );
}
