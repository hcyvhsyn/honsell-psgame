"use client";

/**
 * Ətraflı görünüş: "hansı epizodda hansı dilin dublyajı / altyazısı var?"
 *   - sezon seçimi (və ya hamısı)
 *   - dil süzgəci (məs. "TR dublyaj") → olan epizodlar vurğulanır, istəsən yalnız onlar
 *   - sətrə toxunanda həmin epizodun AZ player-dəki BÜTÜN dilləri
 * Data yalnız təsdiqlənmiş epizodların region treklərindəndir.
 */
import { Fragment, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown } from "lucide-react";
import { KIND_TEXT, MATRIX_COLS, keyKind, keyLabel } from "@/components/streaming/TitleLanguagePanels";
import {
  KIND_NAME_AZ,
  LANG_NAME_AZ,
  MAIN_LANGS,
  episodeTrackKey,
  type MainLang,
  type EpisodeTrackChip,
  type EpisodeTracks,
  type LangKey,
  type SeasonRow,
} from "@/lib/streamingLanguageStates";

type Episode = SeasonRow["episodes"][number] & { seasonNumber: number };

const TRACK_GROUPS: Array<{ label: string; pick: (t: EpisodeTracks) => EpisodeTrackChip[]; kind: "dub" | "sub" | "other" }> = [
  { label: "Dublyaj / səs", kind: "dub", pick: (t) => t.audio.filter((a) => a.type !== "audio_description") },
  { label: "Altyazı", kind: "sub", pick: (t) => t.subtitles.filter((s) => s.type === "subtitle" || s.type === "unknown") },
  { label: "CC altyazı", kind: "other", pick: (t) => t.subtitles.filter((s) => s.type === "closed_caption") },
  { label: "Məcburi altyazı", kind: "other", pick: (t) => t.subtitles.filter((s) => s.type === "forced") },
  { label: "Səsli təsvir", kind: "other", pick: (t) => t.audio.filter((a) => a.type === "audio_description") },
];

const TYPE_NOTE: Record<string, string> = { original: "orijinal", voice_over: "səsləndirmə" };

const isMain = (code: string | null): code is MainLang => !!code && (MAIN_LANGS as readonly string[]).includes(code);
/** Əsas 3 dil öndə (TR, RU, EN sırası ilə), qalanları player-in öz sırasında. */
const mainFirst = (list: EpisodeTrackChip[]) => {
  const rank = (t: EpisodeTrackChip) => (isMain(t.code) ? MAIN_LANGS.indexOf(t.code) : MAIN_LANGS.length);
  return list.map((t, i) => ({ t, i })).sort((a, b) => rank(a.t) - rank(b.t) || a.i - b.i).map((x) => x.t);
};

function TrackList({ tracks }: { tracks: EpisodeTracks | undefined }) {
  if (!tracks) return <p className="text-xs text-zinc-500">Bu epizod hələ yoxlanılır.</p>;
  return (
    <dl className="grid gap-2 sm:grid-cols-[8.5rem_1fr]">
      {TRACK_GROUPS.map((g) => {
        const list = mainFirst(g.pick(tracks));
        if (!list.length && g.kind === "other") return null;
        return (
          <Fragment key={g.label}>
            <dt className={`text-xs font-black uppercase tracking-wide ${g.kind === "other" ? "text-zinc-400" : KIND_TEXT[g.kind]}`}>{g.label}</dt>
            <dd className="flex flex-wrap gap-1">
              {list.length ? (
                list.map((t, i) => (
                  <span
                    key={`${t.name}-${i}`}
                    className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                      isMain(t.code) && g.kind !== "other"
                        ? g.kind === "dub"
                          ? "border-indigo-600 bg-indigo-600 text-[#ffffff]"
                          : "border-emerald-600 bg-emerald-600 text-[#ffffff]"
                        : "border-zinc-300 bg-white text-zinc-900 dark:border-white/15 dark:bg-white/10 dark:text-white"
                    }`}
                  >
                    {isMain(t.code) ? LANG_NAME_AZ[t.code] : t.name}
                    {TYPE_NOTE[t.type] ? <span className={`ml-1 font-medium ${isMain(t.code) && g.kind !== "other" ? "text-[#ffffff]/75" : "text-zinc-400"}`}>· {TYPE_NOTE[t.type]}</span> : null}
                  </span>
                ))
              ) : (
                <span className="text-xs text-zinc-500">yoxdur</span>
              )}
            </dd>
          </Fragment>
        );
      })}
    </dl>
  );
}

function Cell({ ep, k, focus }: { ep: Episode; k: LangKey; focus: LangKey | null }) {
  const ring = focus === k ? "rounded-md bg-amber-100 dark:bg-amber-400/10" : "";
  if (!ep.verified) return <span className={`inline-block px-1 text-zinc-500 ${ring}`}>…</span>;
  return ep.has[k] ? (
    <span className={`inline-flex px-1 ${ring}`}>
      <CheckCircle2 className={`h-4 w-4 ${KIND_TEXT[keyKind(k)]}`} aria-label="var" />
    </span>
  ) : (
    <span className={`inline-block px-1 text-zinc-600 ${ring}`} aria-label="yoxdur">—</span>
  );
}

export default function EpisodeLanguageExplorer({
  seasons,
  episodeTracks,
}: {
  seasons: SeasonRow[];
  episodeTracks: Record<string, EpisodeTracks>;
}) {
  const [season, setSeason] = useState<number | "all">(seasons[0]?.seasonNumber ?? "all");
  const [focus, setFocus] = useState<LangKey | null>(null);
  const [onlyMatching, setOnlyMatching] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const episodes = useMemo<Episode[]>(
    () =>
      seasons
        .filter((s) => season === "all" || s.seasonNumber === season)
        .flatMap((s) => s.episodes.map((e) => ({ ...e, seasonNumber: s.seasonNumber }))),
    [seasons, season]
  );
  const verified = episodes.filter((e) => e.verified);
  const matching = focus ? verified.filter((e) => e.has[focus]) : verified;
  const shown = focus && onlyMatching ? matching : episodes;
  const scopeLabel = season === "all" ? "Bütün sezonlarda" : `Sezon ${season}-də`;

  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs font-bold transition ${
      active
        ? "border-violet-600 bg-violet-600 text-[#ffffff]"
        : "border-zinc-300 text-zinc-300 hover:border-violet-400 dark:border-white/15"
    }`;

  return (
    <div className="space-y-4">
      {seasons.length > 1 ? (
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Sezon">
          {seasons.map((s) => (
            <button key={s.seasonNumber} type="button" role="tab" aria-selected={season === s.seasonNumber} onClick={() => setSeason(s.seasonNumber)} className={pill(season === s.seasonNumber)}>
              Sezon {s.seasonNumber}
            </button>
          ))}
          <button type="button" role="tab" aria-selected={season === "all"} onClick={() => setSeason("all")} className={pill(season === "all")}>
            Hamısı
          </button>
        </div>
      ) : null}

      <div>
        <p className="mb-1.5 text-xs font-bold text-zinc-400">Hansı dili axtarırsan?</p>
        <div className="flex flex-wrap gap-1.5">
          {MATRIX_COLS.map((c) => (
            <button
              key={c.key}
              type="button"
              aria-pressed={focus === c.key}
              onClick={() => setFocus(focus === c.key ? null : c.key)}
              className={`rounded-full border px-2.5 py-1 text-xs font-bold transition ${
                focus === c.key
                  ? keyKind(c.key) === "dub"
                    ? "border-indigo-600 bg-indigo-600 text-[#ffffff]"
                    : "border-emerald-600 bg-emerald-600 text-[#ffffff]"
                  : `border-zinc-300 dark:border-white/15 ${KIND_TEXT[keyKind(c.key)]}`
              }`}
            >
              {keyLabel(c.key)}
            </button>
          ))}
        </div>
        {focus ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm dark:bg-amber-400/[0.06]">
            <span className="text-zinc-100">
              {scopeLabel} <b>{keyLabel(focus)}</b>:{" "}
              {matching.length === 0 ? (
                <b>heç bir epizodda yoxdur</b>
              ) : matching.length === verified.length ? (
                <b>bütün {verified.length} epizodda var</b>
              ) : (
                <>
                  <b>{verified.length} epizoddan {matching.length}-də</b> var
                </>
              )}
              {verified.length < episodes.length ? <span className="text-zinc-500"> ({episodes.length - verified.length} epizod yoxlanılır)</span> : null}
            </span>
            {matching.length > 0 && matching.length < verified.length ? (
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-zinc-300">
                <input type="checkbox" checked={onlyMatching} onChange={(e) => setOnlyMatching(e.target.checked)} className="accent-violet-600" />
                yalnız olanları göstər
              </label>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide dark:bg-white/[0.03]">
            <tr>
              <th rowSpan={2} className="px-2 py-2 font-bold text-zinc-400 sm:px-3">Epizod</th>
              <th colSpan={3} className={`border-l border-zinc-200 px-1.5 pt-2 sm:px-2 font-bold dark:border-white/10 ${KIND_TEXT.dub}`}>{KIND_NAME_AZ.dub}</th>
              <th colSpan={3} className={`border-l border-zinc-200 px-1.5 pt-2 font-bold dark:border-white/10 sm:px-2 ${KIND_TEXT.sub}`}>{KIND_NAME_AZ.sub}</th>
              <th rowSpan={2} className="w-6 sm:w-8" aria-label="Bütün dillər" />
            </tr>
            <tr>
              {MATRIX_COLS.map((c, i) => (
                <th key={c.key} className={`px-1.5 pb-2 font-bold sm:px-2 text-zinc-400 ${i === 0 || i === 3 ? "border-l border-zinc-200 dark:border-white/10" : ""}`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
            {shown.map((ep, idx) => {
              const id = episodeTrackKey(ep.seasonNumber, ep.episodeNumber);
              const isOpen = open === id;
              const dim = focus && ep.verified && !ep.has[focus] ? "opacity-40" : "";
              const newSeason = season === "all" && (idx === 0 || shown[idx - 1].seasonNumber !== ep.seasonNumber);
              return (
                <Fragment key={id}>
                  {newSeason ? (
                    <tr className="bg-zinc-50 dark:bg-white/[0.03]">
                      <td colSpan={8} className="px-3 py-1.5 text-xs font-black uppercase tracking-wide text-zinc-400">Sezon {ep.seasonNumber}</td>
                    </tr>
                  ) : null}
                  <tr
                    className={`cursor-pointer transition hover:bg-zinc-50 dark:hover:bg-white/[0.03] ${dim}`}
                    onClick={() => setOpen(isOpen ? null : id)}
                    aria-expanded={isOpen}
                  >
                    <td className="max-w-[7rem] px-2 py-2 text-zinc-200 sm:max-w-[14rem] sm:px-3">
                      <span className="font-bold">
                        {season === "all" ? `S${ep.seasonNumber}·` : ""}E{ep.episodeNumber}
                      </span>{" "}
                      <span className="line-clamp-1 text-zinc-400">{ep.name ?? ""}</span>
                    </td>
                    {MATRIX_COLS.map((c, i) => (
                      <td key={c.key} className={`px-1 py-2 sm:px-2 ${i === 0 || i === 3 ? "border-l border-zinc-200 dark:border-white/10" : ""}`}>
                        <Cell ep={ep} k={c.key} focus={focus} />
                      </td>
                    ))}
                    <td className="px-1 py-2 text-zinc-400 sm:px-2">
                      <ChevronDown className={`h-4 w-4 transition ${isOpen ? "rotate-180" : ""}`} />
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr className="bg-zinc-50 dark:bg-white/[0.03]">
                      <td colSpan={8} className="px-2 py-3 sm:px-3">
                        <p className="mb-2 text-xs font-bold text-zinc-400">
                          Sezon {ep.seasonNumber}, epizod {ep.episodeNumber} — AZ player-də olan bütün dillər
                        </p>
                        <TrackList tracks={episodeTracks[id]} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">Sətrə toxun — həmin epizodun bütün dublyaj və altyazı dilləri açılır.</p>
    </div>
  );
}
