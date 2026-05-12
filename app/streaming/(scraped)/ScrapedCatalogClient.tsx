"use client";

import { useMemo, useState } from "react";
import { Search, Film, Tv, X } from "lucide-react";
import ScrapedTitleCard, { type ScrapedCardData } from "@/components/ScrapedTitleCard";

type Platform = ScrapedCardData["platforms"][number]["platform"];
type LangFilter = "tr-dub" | "ru-dub" | "en-dub" | "tr-sub" | "ru-sub" | "en-sub";

const PLATFORM_OPTIONS: Array<{ value: Platform; label: string }> = [
  { value: "NETFLIX", label: "Netflix" },
  { value: "HBOMAX", label: "HBO Max" },
  { value: "PRIME", label: "Prime Video" },
  { value: "GAIN", label: "Gain" },
];

const LANG_OPTIONS: Array<{ value: LangFilter; label: string; cls: string }> = [
  { value: "tr-dub", label: "TR dublyaj", cls: "bg-indigo-500/20 text-indigo-200 border-indigo-500/40" },
  { value: "ru-dub", label: "RU dublyaj", cls: "bg-indigo-500/20 text-indigo-200 border-indigo-500/40" },
  { value: "en-dub", label: "EN dublyaj", cls: "bg-indigo-500/20 text-indigo-200 border-indigo-500/40" },
  { value: "tr-sub", label: "TR subtitr", cls: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40" },
  { value: "ru-sub", label: "RU subtitr", cls: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40" },
  { value: "en-sub", label: "EN subtitr", cls: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40" },
];

const SORT_OPTIONS = [
  { value: "year-desc", label: "Yeni → Köhnə" },
  { value: "year-asc", label: "Köhnə → Yeni" },
  { value: "title-asc", label: "Ad: A → Z" },
] as const;

type SortKey = (typeof SORT_OPTIONS)[number]["value"];

const PAGE_SIZE = 60;

interface Props {
  kind: "MOVIE" | "SERIES";
  titles: ScrapedCardData[];
}

export default function ScrapedCatalogClient({ kind, titles }: Props) {
  const [query, setQuery] = useState("");
  const [platforms, setPlatforms] = useState<Set<Platform>>(new Set());
  const [langs, setLangs] = useState<Set<LangFilter>>(new Set());
  const [sort, setSort] = useState<SortKey>("year-desc");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out: ScrapedCardData[] = [];
    for (const t of titles) {
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
      const ay = a.year ?? 0;
      const by = b.year ?? 0;
      if (sort === "year-asc") return ay - by || a.title.localeCompare(b.title);
      return by - ay || a.title.localeCompare(b.title);
    });

    return out;
  }, [titles, query, platforms, langs, sort]);

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
    setPlatforms(new Set());
    setLangs(new Set());
    setVisibleCount(PAGE_SIZE);
  }

  const hasAnyFilter = query.length > 0 || platforms.size > 0 || langs.size > 0;
  const Empty = kind === "SERIES" ? Tv : Film;

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="space-y-4 rounded-2xl border border-white/10 bg-zinc-900/50 p-4 sm:p-5">
        {/* Search + sort row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              placeholder={kind === "MOVIE" ? "Film adı axtar…" : "Serial adı axtar…"}
              className="w-full rounded-lg border border-white/10 bg-zinc-950/50 py-2 pl-9 pr-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-indigo-500/60"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/60"
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {hasAnyFilter && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" /> Filtrləri sıfırla
            </button>
          )}
        </div>

        {/* Platform pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Platforma</span>
          {PLATFORM_OPTIONS.map((p) => {
            const active = platforms.has(p.value);
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => togglePlatform(p.value)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  active
                    ? "border-indigo-500 bg-indigo-500/30 text-white"
                    : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Language pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Dil</span>
          {LANG_OPTIONS.map((l) => {
            const active = langs.has(l.value);
            return (
              <button
                key={l.value}
                type="button"
                onClick={() => toggleLang(l.value)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  active ? l.cls : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                }`}
              >
                {l.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Result count */}
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>
          {filtered.length} nəticə{hasAnyFilter ? " (filtrlənmiş)" : ""}
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
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {visible.map((t) => (
              <li key={t.id}>
                <ScrapedTitleCard data={t} />
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
    </div>
  );
}
