"use client";

import { useState } from "react";
import Link from "next/link";
import { Film, Info, Tv as TvIcon, Star } from "lucide-react";
import TitleInfoModal from "@/components/streaming/TitleInfoModal";
import { LanguageRows } from "@/components/streaming/LanguageSlots";
import { languageSlots, type CoverageInfo } from "@/lib/streamingLanguageStates";

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

export type LanguageCoverage = CoverageInfo;

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
  /** Yalnız HBO Max AZ player-də TƏSDİQLƏNMİŞ və başqa platformada olmayan dillər:
   *  açar `${code}-dub` / `${code}-sub`. PARTIAL = şounun yalnız bəzi epizodlarında. */
  languageCoverage?: Record<string, LanguageCoverage>;
  /** TMDB reytinqi (0-10) — IMDb xalı yoxdursa fallback. */
  rating: number | null;
  /** TMDB səs sayı — reytinq tie-breaker (kartda göstərilmir). */
  voteCount: number | null;
  /** TMDB populyarlıq skoru — "ən çox baxılan" sıralaması (kartda göstərilmir). */
  popularity: number | null;
  /** IMDb-nin rəsmi datasetindən gələn həqiqi reytinq (0-10). Rozetkada və
   *  sıralamada TMDB-dən ÜSTÜNDÜR. */
  imdbRating: number | null;
  /** IMDb səs sayı — tie-breaker (kartda göstərilmir). */
  imdbVotes: number | null;
  /** Bütün dil variantlarını (tr/ru/en/orijinal) birləşdirən kiçik hərfli
   *  axtarış sətri. Kartda göstərilmir — yalnız kataloq filtri işlədir. */
  searchText: string;
};

/**
 * Kartda göstəriləcək reytinq: IMDb varsa o, yoxsa TMDB.
 *
 * İki mənbəni cəmləmirik/ortalamırıq — fərqli auditoriyaların səsidir və
 * qarışdırılmış rəqəm heç birini təmsil etmir. Hansının göstərildiyi rozetkanın
 * etiketindən bilinir ki, istifadəçi IMDb-də yoxlayanda eyni rəqəmi görsün.
 */
export function displayRating(data: {
  imdbRating: number | null;
  imdbVotes: number | null;
  rating: number | null;
  voteCount: number | null;
}): { value: number; votes: number | null; source: "IMDb" | "TMDB" } | null {
  if (data.imdbRating != null) {
    return { value: data.imdbRating, votes: data.imdbVotes, source: "IMDb" };
  }
  if (data.rating != null) {
    return { value: data.rating, votes: data.voteCount, source: "TMDB" };
  }
  return null;
}

/** Səs sayı bu həddən aşağı olan başlıq xam reytinqi ilə sıralanmır. IMDb-də
 *  hədd yüksəkdir, çünki onun səs bazası TMDB-dən qat-qat böyükdür. */
const VOTE_FLOOR = { IMDb: 1000, TMDB: 300 } as const;
/** Kataloqun təxmini orta reytinqi — az səsli başlıq bura doğru çəkilir. */
const MEAN_RATING = 6.8;

/**
 * "Ən yüksək reytinq" sıralaması üçün çəkili bal (IMDb Top-250 formulu):
 *   (v / (v + m)) * R + (m / (v + m)) * C
 *
 * Xam reytinqlə sıralamaq OLMAZ — kataloqda 8 səsli "10.0" başlıqlar var və
 * onlar siyahının başını tutub Prime-ın tanınmış filmlərini aşağı atırdı.
 * Formul az səsli başlığı ortaya (`MEAN_RATING`) doğru çəkir; səs sayı artdıqca
 * xam reytinqə yaxınlaşır.
 */
export function ratingRankScore(data: Parameters<typeof displayRating>[0]): number {
  const shown = displayRating(data);
  if (!shown) return -1; // reytinqsiz başlıqlar həmişə sonda
  const m = VOTE_FLOOR[shown.source];
  const v = shown.votes ?? 0;
  return (v / (v + m)) * shown.value + (m / (v + m)) * MEAN_RATING;
}

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
  const shownRating = displayRating(data);
  const hasLangs = data.audioLanguages.length > 0 || data.subtitleLanguages.length > 0;
  const slots = languageSlots(data);
  const detailHref = titleDetailHref(data);
  const [infoOpen, setInfoOpen] = useState(false);
  // HBO Max-da olub dil məlumatı hələ AZ player-də yoxlanmayan başlıq — çip yox, qeyd var.
  const awaitingCheck = !hasLangs && data.platforms.some((p) => p.platform === "HBOMAX");
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
            {shownRating ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-amber-400/95 px-1.5 py-0.5 text-[10px] font-black text-[#211a02]"
                title={`${shownRating.source} reytinqi${
                  shownRating.votes ? ` · ${shownRating.votes.toLocaleString("az")} səs` : ""
                }`}
              >
                {shownRating.source === "IMDb" ? (
                  <span className="text-[9px] font-black tracking-tight">IMDb</span>
                ) : (
                  <Star className="h-3 w-3 fill-current" />
                )}
                {shownRating.value.toFixed(1)}
              </span>
            ) : null}
            {data.year ? <span>{data.year}</span> : null}
          </div>

          <p className="line-clamp-2 text-[20px] font-black leading-[1.05] text-[#ffffff] drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]">
            {data.title}
          </p>

          {hasLangs ? (
            <div className="mt-3">
              <LanguageRows slots={slots} />
            </div>
          ) : awaitingCheck ? (
            <p className="mt-3 text-[11px] font-semibold text-white/55">Dillər Azərbaycan üçün yoxlanılır</p>
          ) : null}
        </div>
      </div>
  );

  const main = onPlay ? (
    <button type="button" onClick={() => onPlay(data)} className="block w-full text-left" aria-label={`${data.title} — fragman`}>
      {inner}
    </button>
  ) : (
    <Link href={detailHref} className="block">
      {inner}
    </Link>
  );

  // Məlumat düyməsi əsas düymənin QARDAŞIDIR (button içində button etibarlı HTML deyil).
  // Modal yalnız açılanda mount olunur — kataloqda ~2000 kart var.
  return (
    <div className={wrapClassName}>
      {main}
      <button
        type="button"
        onClick={() => setInfoOpen(true)}
        className="absolute right-3 top-12 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-black/60 text-[#ffffff] shadow-lg backdrop-blur-md transition hover:border-sky-300/70 hover:bg-sky-500/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300"
        aria-label={`${data.title} — dublyaj və altyazı haqqında ətraflı`}
        aria-haspopup="dialog"
        title="Dublyaj və altyazı: sezon və epizodlar üzrə"
      >
        <Info className="h-4 w-4" />
      </button>
      {infoOpen ? (
        <TitleInfoModal
          open
          onClose={() => setInfoOpen(false)}
          slug={data.slug}
          kind={data.kind === "SERIES" ? "SERIES" : "MOVIE"}
          title={data.title}
          detailHref={detailHref}
        />
      ) : null}
    </div>
  );
}

/** Detal səhifəsi: /streaming/seriallar/<slug> və ya /streaming/filmler/<slug>. */
export function titleDetailHref(data: Pick<ScrapedCardData, "kind" | "slug">): string {
  return `/streaming/${data.kind === "SERIES" ? "seriallar" : "filmler"}/${data.slug}`;
}
