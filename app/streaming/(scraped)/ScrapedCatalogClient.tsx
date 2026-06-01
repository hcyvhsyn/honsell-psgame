"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Check, ChevronDown, Film, Search, SlidersHorizontal, Tv, X } from "lucide-react";
import ScrapedTitleCard, { type ScrapedCardData } from "@/components/ScrapedTitleCard";
import ScrapedTrailerModal from "@/components/ScrapedTrailerModal";

type Platform = ScrapedCardData["platforms"][number]["platform"];
type LangFilter = "tr-dub" | "ru-dub" | "en-dub" | "tr-sub" | "ru-sub" | "en-sub";

const PLATFORM_OPTIONS: Array<{
  value: Platform;
  label: string;
  logo: string;
  logoClassName: string;
  activeClassName: string;
}> = [
  {
    value: "NETFLIX",
    label: "Netflix",
    logo: "/netflix-logo.png",
    logoClassName: "h-5 w-28",
    activeClassName:
      "border-red-400/55 bg-red-50 shadow-[0_18px_42px_-30px_rgba(220,38,38,0.8)] dark:border-red-400/45 dark:bg-red-500/10",
  },
  {
    value: "HBOMAX",
    label: "HBO Max",
    logo: "/hbomax.png",
    logoClassName: "h-8 w-28 scale-[1.65]",
    activeClassName:
      "border-violet-400/55 bg-violet-50 shadow-[0_18px_42px_-30px_rgba(124,58,237,0.8)] dark:border-violet-400/45 dark:bg-violet-500/10",
  },
  {
    value: "PRIME",
    label: "Prime Video",
    logo: "/prime.webp",
    logoClassName: "h-6 w-32",
    activeClassName:
      "border-sky-400/60 bg-sky-50 shadow-[0_18px_42px_-30px_rgba(14,165,233,0.85)] dark:border-sky-300/45 dark:bg-sky-500/10",
  },
  {
    value: "GAIN",
    label: "Gain",
    logo: "/gain.png",
    logoClassName: "h-9 w-24 scale-[1.35]",
    activeClassName:
      "border-rose-400/55 bg-rose-50 shadow-[0_18px_42px_-30px_rgba(244,63,94,0.75)] dark:border-rose-300/45 dark:bg-rose-500/10",
  },
];

const LANG_GROUPS: Array<{
  title: string;
  eyebrow: string;
  tone: "dub" | "sub";
  options: Array<{ value: LangFilter; code: "TR" | "RU" | "EN"; label: string }>;
}> = [
  {
    title: "Dublaj",
    eyebrow: "Audio",
    tone: "dub",
    options: [
      { value: "tr-dub", code: "TR", label: "Türkçe" },
      { value: "ru-dub", code: "RU", label: "Русский" },
      { value: "en-dub", code: "EN", label: "English" },
    ],
  },
  {
    title: "Subtitle",
    eyebrow: "Altyazı",
    tone: "sub",
    options: [
      { value: "tr-sub", code: "TR", label: "Türkçe" },
      { value: "ru-sub", code: "RU", label: "Русский" },
      { value: "en-sub", code: "EN", label: "English" },
    ],
  },
];

const SORT_OPTIONS = [
  { value: "popularity-desc", label: "Ən çox baxılan" },
  { value: "rating-desc", label: "Ən yüksək reytinq" },
  { value: "year-desc", label: "Yeni → Köhnə" },
  { value: "year-asc", label: "Köhnə → Yeni" },
  { value: "title-asc", label: "Ad: A → Z" },
] as const;

type SortKey = (typeof SORT_OPTIONS)[number]["value"];

type KindFilter = "ALL" | "MOVIE" | "SERIES";
const KIND_OPTIONS: Array<{ value: KindFilter; label: string }> = [
  { value: "ALL", label: "Hamısı" },
  { value: "MOVIE", label: "Filmlər" },
  { value: "SERIES", label: "Seriallar" },
];

const PAGE_SIZE = 60;

interface Props {
  /** Həm film, həm serial başlıqları — kind daxili filtrlə seçilir. */
  titles: ScrapedCardData[];
  /** Səhifə ilk açılanda seçili kind filtri (köhnə filmler/seriallar
   *  linklərindən gələn ?kind üçün). Default "ALL". */
  initialKind?: KindFilter;
}

export default function ScrapedCatalogClient({ titles, initialKind = "ALL" }: Props) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>(initialKind);
  const [platforms, setPlatforms] = useState<Set<Platform>>(new Set());
  const [langs, setLangs] = useState<Set<LangFilter>>(new Set());
  const [sort, setSort] = useState<SortKey>("popularity-desc");
  const [sortOpen, setSortOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [trailerOf, setTrailerOf] = useState<ScrapedCardData | null>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sortOpen) return;

    function onPointerDown(event: MouseEvent) {
      if (!sortRef.current?.contains(event.target as Node)) setSortOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSortOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [sortOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out: ScrapedCardData[] = [];
    for (const t of titles) {
      if (kind !== "ALL" && t.kind !== kind) continue;

      if (q && !t.title.toLowerCase().includes(q)) continue;

      if (platforms.size > 0) {
        const has = t.platforms.some((p) => platforms.has(p.platform));
        if (!has) continue;
      }

      if (langs.size > 0) {
        let ok = true;
        for (const l of langs) {
          const [code, type] = l.split("-") as ["tr" | "ru" | "en", "dub" | "sub"];
          const pool = type === "dub" ? t.audioLanguages : t.subtitleLanguages;
          if (!pool.includes(code)) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
      }

      out.push(t);
    }

    out.sort((a, b) => {
      if (sort === "title-asc") return a.title.localeCompare(b.title, "az");
      if (sort === "popularity-desc") {
        return (b.popularity ?? 0) - (a.popularity ?? 0) || a.title.localeCompare(b.title);
      }
      if (sort === "rating-desc") {
        // Reytinq azalan; bərabərdə çox səsli üstün (az-səsli "10.0" noise-u aşağı).
        return (
          (b.rating ?? 0) - (a.rating ?? 0) ||
          (b.voteCount ?? 0) - (a.voteCount ?? 0) ||
          a.title.localeCompare(b.title)
        );
      }
      const ay = a.year ?? 0;
      const by = b.year ?? 0;
      if (sort === "year-asc") return ay - by || a.title.localeCompare(b.title);
      return by - ay || a.title.localeCompare(b.title);
    });

    return out;
  }, [titles, kind, query, platforms, langs, sort]);

  const filterBase = useMemo(() => {
    const q = query.trim().toLowerCase();
    return titles.filter((t) => {
      if (kind !== "ALL" && t.kind !== kind) return false;
      if (q && !t.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [titles, kind, query]);

  const platformCounts = useMemo(() => {
    const counts = new Map<Platform, number>();
    for (const option of PLATFORM_OPTIONS) counts.set(option.value, 0);

    for (const title of filterBase) {
      const uniquePlatforms = new Set(title.platforms.map((p) => p.platform));
      for (const platform of uniquePlatforms) {
        counts.set(platform, (counts.get(platform) ?? 0) + 1);
      }
    }

    return counts;
  }, [filterBase]);

  const languageCounts = useMemo(() => {
    const counts = new Map<LangFilter, number>();
    for (const group of LANG_GROUPS) {
      for (const option of group.options) counts.set(option.value, 0);
    }

    for (const title of filterBase) {
      const audio = new Set(title.audioLanguages.map((l) => l.toLowerCase()));
      const subtitles = new Set(title.subtitleLanguages.map((l) => l.toLowerCase()));

      for (const group of LANG_GROUPS) {
        for (const option of group.options) {
          const [code, type] = option.value.split("-") as ["tr" | "ru" | "en", "dub" | "sub"];
          const pool = type === "dub" ? audio : subtitles;
          if (pool.has(code)) counts.set(option.value, (counts.get(option.value) ?? 0) + 1);
        }
      }
    }

    return counts;
  }, [filterBase]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visible.length < filtered.length;

  function togglePlatform(p: Platform) {
    setVisibleCount(PAGE_SIZE);
    setPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  function toggleLang(l: LangFilter) {
    setVisibleCount(PAGE_SIZE);
    setLangs((prev) => {
      const next = new Set(prev);
      if (next.has(l)) next.delete(l);
      else next.add(l);
      return next;
    });
  }

  function clearAll() {
    setQuery("");
    setKind("ALL");
    setPlatforms(new Set());
    setLangs(new Set());
    setSort("year-desc");
    setVisibleCount(PAGE_SIZE);
  }

  const hasContentFilter =
    kind !== "ALL" || query.trim().length > 0 || platforms.size > 0 || langs.size > 0;
  const hasAnyPanelChange = hasContentFilter || sort !== "year-desc";
  const activeFilterCount =
    (kind !== "ALL" ? 1 : 0) +
    (query.trim().length > 0 ? 1 : 0) +
    platforms.size +
    langs.size +
    (sort !== "year-desc" ? 1 : 0);
  const Empty = kind === "SERIES" ? Tv : Film;
  const selectedSort = SORT_OPTIONS.find((option) => option.value === sort) ?? SORT_OPTIONS[0];

  return (
    <div className="space-y-6">
      <div className="sticky top-[116px] z-40 md:top-[94px] xl:top-[156px]">
        <div className="rounded-lg border border-white/[0.09] bg-[#07080d]/90 p-2 shadow-[0_24px_80px_-36px_rgba(0,0,0,0.95)] backdrop-blur-2xl">
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_220px_150px_auto]">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-zinc-500" />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setVisibleCount(PAGE_SIZE);
                }}
                placeholder={
                  kind === "MOVIE"
                    ? "Film adı axtar..."
                    : kind === "SERIES"
                      ? "Serial adı axtar..."
                      : "Film və ya serial axtar..."
                }
                className="h-12 w-full rounded-lg border border-white/[0.08] bg-black/35 pl-10 pr-11 text-sm font-bold text-[#ffffff] outline-none transition placeholder:text-zinc-600 focus:border-indigo-400/60 focus:bg-black/50 focus:ring-4 focus:ring-indigo-500/10"
              />
              {query ? (
                <button
                  type="button"
                  aria-label="Axtarışı təmizlə"
                  onClick={() => {
                    setQuery("");
                    setVisibleCount(PAGE_SIZE);
                  }}
                  className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-zinc-500 transition hover:bg-white/[0.08] hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <div ref={sortRef} className="relative">
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={sortOpen}
                onClick={() => setSortOpen((open) => !open)}
                className="flex h-12 w-full items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-black/35 px-4 text-left text-sm font-black text-[#ffffff] outline-none transition hover:border-white/[0.16] hover:bg-black/50 focus-visible:border-indigo-400/60 focus-visible:ring-4 focus-visible:ring-indigo-500/10"
              >
                <span className="truncate">{selectedSort.label}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-zinc-400 transition ${
                    sortOpen ? "rotate-180 text-indigo-200" : ""
                  }`}
                />
              </button>

              {sortOpen ? (
                <div
                  role="listbox"
                  className="absolute right-0 top-[calc(100%+8px)] z-50 w-full min-w-[220px] overflow-hidden rounded-lg border border-white/[0.1] bg-[#0b0c12] p-1 shadow-[0_22px_60px_-24px_rgba(0,0,0,0.95)]"
                >
                  {SORT_OPTIONS.map((option) => {
                    const active = sort === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => {
                          setSort(option.value);
                          setSortOpen(false);
                          setVisibleCount(PAGE_SIZE);
                        }}
                        className={`flex h-10 w-full items-center justify-between gap-3 rounded-md px-3 text-left text-sm font-bold transition ${
                          active
                            ? "bg-indigo-500 text-[#ffffff]"
                            : "text-zinc-300 hover:bg-white/[0.06] hover:text-white"
                        }`}
                      >
                        <span>{option.label}</span>
                        {active ? <Check className="h-4 w-4" /> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              aria-expanded={filtersOpen}
              aria-controls="scraped-filter-panel"
              onClick={() => setFiltersOpen((open) => !open)}
              className={`flex h-12 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/10 ${
                filtersOpen
                  ? "border-indigo-300/55 bg-indigo-500 text-[#ffffff]"
                  : "border-white/[0.08] bg-white/[0.05] text-zinc-200 hover:border-white/[0.16] hover:bg-white/[0.08]"
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>Filtrlər</span>
              {activeFilterCount > 0 ? (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-white px-1.5 text-[11px] font-black text-indigo-600">
                  {activeFilterCount}
                </span>
              ) : null}
              <ChevronDown className={`h-4 w-4 transition ${filtersOpen ? "rotate-180" : ""}`} />
            </button>

            {hasAnyPanelChange ? (
              <button
                type="button"
                onClick={clearAll}
                className="flex h-12 items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 text-sm font-black text-zinc-300 transition hover:border-rose-400/30 hover:bg-rose-500/10 hover:text-rose-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-500/10"
              >
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">Sıfırla</span>
              </button>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1 text-xs font-bold text-zinc-500">
            <span>
              {filtered.length} nəticə · cəmi {titles.length}
            </span>
            {hasContentFilter ? (
              <span className="text-indigo-200">Filter tətbiq olunub</span>
            ) : (
              <span>Hamısı göstərilir</span>
            )}
          </div>

          {filtersOpen ? (
            <div
              id="scraped-filter-panel"
              className="mt-3 max-h-[calc(100vh-190px)] overflow-y-auto rounded-lg border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.025))] p-3 shadow-inner"
            >
              <div className="grid gap-3 lg:grid-cols-[0.78fr_1.22fr]">
                <section className="rounded-lg border border-white/[0.08] bg-black/20 p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">
                      Göstər
                    </h2>
                  </div>

                  <div className="grid grid-cols-3 gap-1 rounded-lg border border-white/[0.08] bg-black/30 p-1">
                    {KIND_OPTIONS.map((k) => {
                      const active = kind === k.value;
                      const Icon = k.value === "SERIES" ? Tv : k.value === "MOVIE" ? Film : null;
                      return (
                        <button
                          key={k.value}
                          type="button"
                          aria-pressed={active}
                          onClick={() => {
                            setKind(k.value);
                            setVisibleCount(PAGE_SIZE);
                          }}
                          className={`inline-flex h-10 items-center justify-center gap-2 rounded-md px-2 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 ${
                            active
                              ? "bg-indigo-500 text-[#ffffff] shadow-[0_10px_24px_-14px_rgba(79,70,229,0.9)]"
                              : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                          }`}
                        >
                          {Icon ? <Icon className="h-4 w-4" /> : null}
                          <span>{k.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section aria-labelledby="platform-filter-title" className="rounded-lg border border-white/[0.08] bg-black/20 p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h2
                      id="platform-filter-title"
                      className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500"
                    >
                      Platforma
                    </h2>
                    {platforms.size > 0 ? (
                      <span className="text-xs font-bold text-zinc-400">{platforms.size} seçili</span>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    {PLATFORM_OPTIONS.map((p) => {
                      const active = platforms.has(p.value);
                      const count = platformCounts.get(p.value) ?? 0;

                      return (
                        <button
                          key={p.value}
                          type="button"
                          aria-pressed={active}
                          onClick={() => togglePlatform(p.value)}
                          className={`group relative min-h-[70px] overflow-hidden rounded-lg border p-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 ${
                            active
                              ? p.activeClassName
                              : "border-white/[0.08] bg-white/[0.035] hover:border-white/[0.14] hover:bg-white/[0.06]"
                          }`}
                        >
                          <span
                            className={`absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full border transition ${
                              active
                                ? "border-indigo-300 bg-indigo-500 text-[#ffffff]"
                                : "border-white/15 bg-black/30 text-transparent"
                            }`}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </span>
                          <span className="flex h-9 max-w-[140px] items-center overflow-hidden rounded-md bg-white px-2.5 ring-1 ring-inset ring-white/[0.08]">
                            <Image
                              src={p.logo}
                              alt={p.label}
                              width={160}
                              height={48}
                              className={`${p.logoClassName} object-contain`}
                            />
                          </span>
                          <span className="mt-2 flex items-center justify-between gap-2">
                            <span className="truncate text-xs font-black text-zinc-200">{p.label}</span>
                            <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[11px] font-black text-zinc-300">
                              {count}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>

              <section aria-labelledby="language-filter-title" className="mt-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2
                    id="language-filter-title"
                    className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500"
                  >
                    Dil seçimi
                  </h2>
                  {langs.size > 0 ? (
                    <span className="text-xs font-bold text-zinc-400">{langs.size} seçili</span>
                  ) : null}
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  {LANG_GROUPS.map((group) => {
                    const isDub = group.tone === "dub";
                    return (
                      <div
                        key={group.title}
                        className={`rounded-lg border p-3 ${
                          isDub
                            ? "border-indigo-400/15 bg-indigo-500/[0.045]"
                            : "border-emerald-300/15 bg-emerald-500/[0.045]"
                        }`}
                      >
                        <div className="mb-3">
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">
                            {group.eyebrow}
                          </p>
                          <h3 className="text-sm font-black text-[#ffffff]">{group.title}</h3>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          {group.options.map((option) => {
                            const active = langs.has(option.value);
                            const count = languageCounts.get(option.value) ?? 0;

                            return (
                              <button
                                key={option.value}
                                type="button"
                                aria-pressed={active}
                                onClick={() => toggleLang(option.value)}
                                className={`relative h-12 rounded-md border px-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 ${
                                  active
                                    ? isDub
                                      ? "border-indigo-500 bg-indigo-500 text-[#ffffff] shadow-[0_14px_28px_-18px_rgba(79,70,229,0.85)] focus-visible:ring-indigo-400/50"
                                      : "border-emerald-400 bg-emerald-400 text-[#052e20] shadow-[0_14px_28px_-18px_rgba(16,185,129,0.8)] focus-visible:ring-emerald-400/50"
                                    : "border-white/[0.08] bg-black/20 text-zinc-300 hover:border-white/[0.14] hover:bg-white/[0.05] focus-visible:ring-indigo-400/40"
                                }`}
                              >
                                <span className="flex items-center justify-between gap-1">
                                  <span className="text-sm font-black">{option.code}</span>
                                  <span
                                    className={`text-[10px] font-black ${
                                      active
                                        ? isDub
                                          ? "text-indigo-100"
                                          : "text-emerald-950"
                                        : "text-zinc-500"
                                    }`}
                                  >
                                    {count}
                                  </span>
                                </span>
                                <span className="mt-0.5 block truncate text-[11px] font-bold opacity-80">
                                  {option.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </div>

      {/* Result count */}
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>
          {filtered.length} nəticə{hasContentFilter ? " (filtrlənmiş)" : ""}
        </span>
        <span>Cəmi {titles.length}</span>
      </div>

      {/* Grid */}
      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
          <Empty className="mx-auto h-10 w-10 text-zinc-600" />
          <p className="mt-3 text-sm text-zinc-400">
            {titles.length === 0
              ? "Hələ scrape edilən başlıq yoxdur. /api/scrape-i tetiklə."
              : "Bu filtrlərə uyğun nəticə tapılmadı."}
          </p>
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {visible.map((t) => (
              <li key={t.id}>
                <ScrapedTitleCard data={t} onPlay={setTrailerOf} />
              </li>
            ))}
          </ul>
          {hasMore && (
            <div className="flex justify-center pt-4">
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="rounded-full border border-white/10 bg-white/5 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Daha çox göstər ({filtered.length - visible.length})
              </button>
            </div>
          )}
        </>
      )}

      <ScrapedTrailerModal data={trailerOf} onClose={() => setTrailerOf(null)} />
    </div>
  );
}
