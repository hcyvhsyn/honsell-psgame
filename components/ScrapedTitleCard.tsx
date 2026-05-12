"use client";

import Link from "next/link";
import { Film, Tv as TvIcon } from "lucide-react";

/**
 * Scraping-dən gələn başlıq üçün kart. Mövcud `StreamingTitleCard`-dan fərqi:
 *  - bir başlıq bir neçə platformda görünə bilər → platform rozetkaları göstərir
 *  - dil rozetkaları bütün availability-lərdən birləşdirilmiş halda olur
 *  - klik → detay (/streaming/[slug]) — mövcud public detay səhifəsi.
 */

export type ScrapedCardPlatform = {
  platform: "NETFLIX" | "HBOMAX" | "PRIME" | "GAIN";
  deepLinkUrl: string | null;
};

export type ScrapedCardData = {
  id: string;
  slug: string;
  title: string;
  kind: "MOVIE" | "SERIES";
  year: number | null;
  posterUrl: string | null;
  platforms: ScrapedCardPlatform[];
  /** "tr"|"ru"|"en" — bütün platformlardan birləşik. */
  audioLanguages: string[];
  subtitleLanguages: string[];
};

const PLATFORM_LABEL: Record<ScrapedCardPlatform["platform"], string> = {
  NETFLIX: "N",
  HBOMAX: "HBO",
  PRIME: "Prime",
  GAIN: "Gain",
};

const PLATFORM_CLASS: Record<ScrapedCardPlatform["platform"], string> = {
  NETFLIX: "bg-red-600 text-white",
  HBOMAX: "bg-purple-600 text-white",
  PRIME: "bg-sky-500 text-white",
  GAIN: "bg-rose-500 text-white",
};

export default function ScrapedTitleCard({ data }: { data: ScrapedCardData }) {
  const Kind = data.kind === "SERIES" ? TvIcon : Film;
  const dubs = data.audioLanguages.slice(0, 3);
  const subs = data.subtitleLanguages.slice(0, 3);

  return (
    <Link
      href={`/streaming/${data.slug}`}
      className="group relative block overflow-hidden rounded-xl border border-white/10 bg-zinc-900 transition hover:-translate-y-0.5 hover:border-indigo-500/40"
    >
      <div className="relative aspect-[2/3] w-full">
        {data.posterUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={data.posterUrl}
            alt={data.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
            <Kind className="h-10 w-10 text-zinc-700" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />

        {/* Sağ üst — dil rozetkaları */}
        {(dubs.length > 0 || subs.length > 0) && (
          <div className="absolute right-2 top-2 flex flex-wrap justify-end gap-1">
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

        {/* Sol üst — platform rozetkaları */}
        {data.platforms.length > 0 && (
          <div className="absolute left-2 top-2 flex flex-wrap gap-1">
            {data.platforms.map((p) => (
              <span
                key={p.platform}
                className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide shadow ${PLATFORM_CLASS[p.platform]}`}
                title={p.platform}
              >
                {PLATFORM_LABEL[p.platform]}
              </span>
            ))}
          </div>
        )}

        {/* Alt — başlıq */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p className="line-clamp-2 text-sm font-bold leading-tight text-white">{data.title}</p>
          <p className="mt-1 text-[11px] text-zinc-400">
            {data.kind === "SERIES" ? "Serial" : "Film"}
            {data.year ? ` · ${data.year}` : ""}
          </p>
        </div>
      </div>
    </Link>
  );
}
