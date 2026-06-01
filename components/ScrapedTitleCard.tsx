"use client";

import Link from "next/link";
import { Film, Tv as TvIcon, Star } from "lucide-react";

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
  /** TMDB reytinqi (0-10). Sıralama + kartda ulduz rozetkası. */
  rating: number | null;
  /** TMDB səs sayı — reytinq tie-breaker (kartda göstərilmir). */
  voteCount: number | null;
  /** TMDB populyarlıq skoru — "ən çox baxılan" sıralaması (kartda göstərilmir). */
  popularity: number | null;
};

const PLATFORM_META: Record<
  ScrapedCardPlatform["platform"],
  { label: string; short: string; className: string; logo?: string; logoClassName?: string }
> = {
  NETFLIX: {
    label: "Netflix",
    short: "N",
    className: "border-red-300/35 bg-red-600/95 shadow-red-950/30",
  },
  HBOMAX: {
    label: "HBO Max",
    short: "HBO",
    className: "border-violet-300/35 bg-violet-600/95 shadow-violet-950/30",
  },
  PRIME: {
    label: "Prime Video",
    short: "Prime",
    className: "border-sky-200/60 bg-white/95 shadow-sky-950/25",
    logo: "/prime.webp",
    logoClassName: "h-4 w-[72px]",
  },
  GAIN: {
    label: "Gain",
    short: "Gain",
    className: "border-rose-200/40 bg-rose-500/95 shadow-rose-950/30",
  },
};

const LANGUAGE_LABEL: Record<string, string> = {
  az: "AZ",
  en: "EN",
  ru: "RU",
  tr: "TR",
};

function languageLabel(code: string) {
  return LANGUAGE_LABEL[code.toLowerCase()] ?? code.toUpperCase();
}

export default function ScrapedTitleCard({
  data,
  onPlay,
}: {
  data: ScrapedCardData;
  /** Verilərsə kart kliki bu callback-i çağırır (fragman modalı) — detay
   *  səhifəsinə yönləndirmir. Verilməzsə köhnə davranış: detay link. */
  onPlay?: (data: ScrapedCardData) => void;
}) {
  const Kind = data.kind === "SERIES" ? TvIcon : Film;
  const dubs = data.audioLanguages.slice(0, 3);
  const subs = data.subtitleLanguages.slice(0, 3);
  const platformOverflow = Math.max(data.platforms.length - 3, 0);
  const visiblePlatforms = data.platforms.slice(0, 3);

  const wrapClassName =
    "group relative block w-full overflow-hidden rounded-lg border border-white/[0.12] bg-[#080b10] text-left shadow-[0_18px_42px_rgba(0,0,0,0.28)] transition duration-300 hover:-translate-y-1 hover:border-sky-300/45 hover:shadow-[0_24px_60px_rgba(14,165,233,0.18)]";

  const inner = (
      <div className="relative aspect-[2/3] w-full overflow-hidden">
        {data.posterUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={data.posterUrl}
            alt={data.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.32),transparent_35%),linear-gradient(135deg,#18181b,#050505)]">
            <Kind className="h-12 w-12 text-white/20" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08)_0%,rgba(0,0,0,0.08)_34%,rgba(0,0,0,0.58)_66%,rgba(0,0,0,0.94)_100%)]" />
        <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/[0.08]" />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          {visiblePlatforms.length > 0 ? (
            <div className="flex min-w-0 flex-wrap gap-1.5">
              {visiblePlatforms.map((p) => {
                const meta = PLATFORM_META[p.platform];

                return (
                  <span
                    key={p.platform}
                    className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2 text-[10px] font-extrabold uppercase text-[#ffffff] shadow-lg backdrop-blur-md ${meta.className}`}
                    title={meta.label}
                  >
                    {meta.logo ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={meta.logo}
                        alt=""
                        aria-hidden="true"
                        className={`${meta.logoClassName ?? "h-4 w-4"} object-contain`}
                      />
                    ) : (
                      meta.short
                    )}
                  </span>
                );
              })}
              {platformOverflow > 0 ? (
                <span className="inline-flex h-7 items-center rounded-full border border-white/20 bg-black/55 px-2 text-[10px] font-extrabold text-[#ffffff] shadow-lg backdrop-blur-md">
                  +{platformOverflow}
                </span>
              ) : null}
            </div>
          ) : (
            <span />
          )}

          <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-white/20 bg-black/55 px-2.5 text-[10px] font-extrabold uppercase text-[#ffffff] shadow-lg backdrop-blur-md">
            <Kind className="h-3.5 w-3.5 text-[#ffffff]" />
            {data.kind === "SERIES" ? "Serial" : "Film"}
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold text-white/[0.72]">
            {data.rating != null ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-amber-400/95 px-1.5 py-0.5 text-[10px] font-black text-[#211a02]"
                title={`TMDB reytinqi${data.voteCount ? ` · ${data.voteCount.toLocaleString("az")} səs` : ""}`}
              >
                <Star className="h-3 w-3 fill-current" />
                {data.rating.toFixed(1)}
              </span>
            ) : null}
            {data.year ? <span>{data.year}</span> : null}
            {data.year && (dubs.length > 0 || subs.length > 0) ? (
              <span className="h-1 w-1 rounded-full bg-white/35" />
            ) : null}
            {dubs.length > 0 || subs.length > 0 ? (
              <span>Dublaj / Subtitle</span>
            ) : null}
          </div>

          <p className="line-clamp-2 text-[20px] font-black leading-[1.05] text-[#ffffff] drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]">
            {data.title}
          </p>

          <div className="mt-3 space-y-2">
            {dubs.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex h-6 items-center rounded-full bg-indigo-400 px-2 text-[10px] font-black uppercase text-[#101027]">
                  Dub
                </span>
                {dubs.map((c) => (
                  <span
                    key={`d-${c}`}
                    className="inline-flex h-6 items-center rounded-full border border-indigo-200/35 bg-indigo-500/25 px-2 text-[10px] font-extrabold uppercase text-[#ffffff] backdrop-blur-md"
                    title={`Dublyaj: ${languageLabel(c)}`}
                  >
                    {languageLabel(c)}
                  </span>
                ))}
              </div>
            ) : null}

            {subs.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex h-6 items-center rounded-full bg-emerald-300 px-2 text-[10px] font-black uppercase text-[#09231a]">
                  Sub
                </span>
                {subs.map((c) => (
                  <span
                    key={`s-${c}`}
                    className="inline-flex h-6 items-center rounded-full border border-emerald-100/35 bg-emerald-500/25 px-2 text-[10px] font-extrabold uppercase text-[#ffffff] backdrop-blur-md"
                    title={`Subtitr: ${languageLabel(c)}`}
                  >
                    {languageLabel(c)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
  );

  if (onPlay) {
    return (
      <button type="button" onClick={() => onPlay(data)} className={wrapClassName} aria-label={`${data.title} — fragman`}>
        {inner}
      </button>
    );
  }
  return (
    <Link href={`/streaming/${data.slug}`} className={wrapClassName}>
      {inner}
    </Link>
  );
}
