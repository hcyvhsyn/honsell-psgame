/**
 * Dil panelləri — detal səhifəsi (server) və info modalı (client) ORTAQ işlədir.
 * Hook və server importu YOXDUR — hər iki tərəfdə render olunur.
 */
import { CheckCircle2, Info } from "lucide-react";
import { PartialMark } from "@/components/streaming/LanguageSlots";
import { formatAzDate } from "@/lib/streamingLanguages";
import {
  KIND_NAME_AZ,
  LANG_NAME_AZ,
  LANG_SHORT,
  MAIN_LANGS,
  seasonCellState,
  seasonDifferences,
  type LangKey,
  type LangKind,
  type LanguageSlot,
  type MainLang,
  type SeasonRow,
} from "@/lib/streamingLanguageStates";
import type { OtherLanguageRow, StreamingTitleDetail } from "@/lib/streamingTitleDetail";

export const GROUP_LABEL: Record<OtherLanguageRow["group"], string> = {
  main: "Dublyaj (digər dillər)",
  audio_description: "Səsli təsvir (görmə məhdudiyyətli tamaşaçılar üçün)",
  subtitle: "Altyazı (digər dillər)",
  closed_caption: "CC altyazı (eşitmə məhdudiyyətli tamaşaçılar üçün)",
  forced: "Məcburi altyazı (yalnız xarici dildə danışılan hissələr)",
};

export const KIND_TEXT: Record<LangKind, string> = {
  dub: "text-indigo-700 dark:text-indigo-300",
  sub: "text-emerald-700 dark:text-emerald-300",
};

export const keyKind = (k: LangKey): LangKind => (k.endsWith("dub") ? "dub" : "sub");
export const keyLang = (k: LangKey): MainLang => k.slice(0, 2) as MainLang;
/** "TR dublyaj", "RU altyazı" */
export const keyLabel = (k: LangKey) => `${LANG_SHORT[keyLang(k)]} ${keyKind(k) === "dub" ? "dublyaj" : "altyazı"}`;

export const MATRIX_COLS: Array<{ key: LangKey; label: string }> = [
  ...MAIN_LANGS.map((c) => ({ key: `${c}-dub` as LangKey, label: LANG_SHORT[c] })),
  ...MAIN_LANGS.map((c) => ({ key: `${c}-sub` as LangKey, label: LANG_SHORT[c] })),
];

function slotText(s: LanguageSlot): string {
  if (s.state === "none") return "Yoxdur";
  if (s.state === "partial") return `Bəzi epizodlarda · ${s.available}/${s.total}`;
  return s.total && s.total > 1 ? `Bütün epizodlarda · ${s.total}/${s.total}` : "Var";
}

export function SummaryTable({ slots }: { slots: Record<LangKind, LanguageSlot[]> }) {
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="text-xs uppercase tracking-wide text-zinc-500">
          <th className="py-2 pr-4 font-bold">Dil</th>
          <th className={`py-2 pr-4 font-bold ${KIND_TEXT.dub}`}>Dublyaj</th>
          <th className={`py-2 font-bold ${KIND_TEXT.sub}`}>Altyazı</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
        {MAIN_LANGS.map((code, i) => (
          <tr key={code}>
            <td className="py-2.5 pr-4 font-bold text-white">
              {LANG_SHORT[code]} <span className="font-medium text-zinc-400">· {LANG_NAME_AZ[code]}</span>
            </td>
            {(["dub", "sub"] as const).map((kind) => {
              const s = slots[kind][i];
              return (
                <td key={kind} className={`py-2.5 pr-4 ${s.state === "none" ? "text-zinc-500" : "text-zinc-100"}`}>
                  <span className="inline-flex items-center gap-1.5">
                    {s.state === "full" ? <CheckCircle2 className={`h-4 w-4 ${KIND_TEXT[kind]}`} /> : null}
                    {s.state === "partial" ? <PartialMark kind={kind} className="h-3 w-3" /> : null}
                    {slotText(s)}
                  </span>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MatrixCell({ row, k }: { row: SeasonRow; k: LangKey }) {
  const state = seasonCellState(row, k);
  const kind = keyKind(k);
  const n = row.available[k];
  if (state === "full")
    return (
      <span className={`inline-flex items-center gap-1 font-bold ${KIND_TEXT[kind]}`} title={`Bütün ${row.total} epizodda`}>
        <CheckCircle2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Tam</span>
      </span>
    );
  if (state === "partial")
    return (
      <span className="inline-flex items-center gap-1 font-bold text-zinc-100" title={`${row.total} epizoddan ${n}-də`}>
        <PartialMark kind={kind} /> {n}/{row.total}
      </span>
    );
  if (state === "unverified") return <span className="text-zinc-500" title="Bu sezon hələ tam yoxlanmayıb">yoxlanılır</span>;
  return <span className="text-zinc-600" title="Bu sezonda yoxdur">—</span>;
}

export function SeasonMatrix({ seasons }: { seasons: SeasonRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-white/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-50 text-xs uppercase tracking-wide dark:bg-white/[0.03]">
          <tr>
            <th rowSpan={2} className="px-1.5 sm:px-3 py-2 font-bold text-zinc-400">Sezon</th>
            <th colSpan={3} className={`border-l border-zinc-200 px-1.5 sm:px-3 pt-2 font-bold dark:border-white/10 ${KIND_TEXT.dub}`}>{KIND_NAME_AZ.dub}</th>
            <th colSpan={3} className={`border-l border-zinc-200 px-1.5 sm:px-3 pt-2 font-bold dark:border-white/10 ${KIND_TEXT.sub}`}>{KIND_NAME_AZ.sub}</th>
          </tr>
          <tr>
            {MATRIX_COLS.map((c, i) => (
              <th key={c.key} className={`px-1.5 sm:px-3 pb-2 font-bold text-zinc-400 ${i === 0 || i === 3 ? "border-l border-zinc-200 dark:border-white/10" : ""}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
          {seasons.map((row) => (
            <tr key={row.seasonNumber}>
              <td className="px-1.5 sm:px-3 py-3 font-bold text-white">
                Sezon {row.seasonNumber}
                <span className="block text-xs font-medium text-zinc-500">{row.total} epizod</span>
              </td>
              {MATRIX_COLS.map((c, i) => (
                <td key={c.key} className={`px-1.5 sm:px-3 py-3 ${i === 0 || i === 3 ? "border-l border-zinc-200 dark:border-white/10" : ""}`}>
                  <MatrixCell row={row} k={c.key} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function stateText(p: { state: string; available: number; total: number }) {
  if (p.state === "full") return "tam";
  if (p.state === "partial") return `${p.available}/${p.total}`;
  if (p.state === "unverified") return "yoxlanılır";
  return "yoxdur";
}

/** "Sezonlar arası fərqlər" — yalnız sezondan sezona dəyişən dillər. */
export function SeasonChanges({ seasons }: { seasons: SeasonRow[] }) {
  const diffs = seasonDifferences(seasons);
  if (!diffs.length) {
    return seasons.length > 1 ? (
      <p className="rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-400 dark:border-white/10 dark:bg-white/[0.02]">
        Bütün sezonlarda dil vəziyyəti eynidir.
      </p>
    ) : null;
  }
  return (
    <ul className="space-y-1.5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-400/25 dark:bg-amber-400/[0.06]">
      {diffs.map((d) => (
        <li key={d.key} className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`font-black ${KIND_TEXT[keyKind(d.key)]}`}>{keyLabel(d.key)}</span>
          {d.perSeason.map((p) => (
            <span
              key={p.seasonNumber}
              className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${
                p.state === "none"
                  ? "bg-zinc-200 text-zinc-500 line-through dark:bg-white/5 dark:text-zinc-500"
                  : p.state === "full"
                    ? "bg-zinc-900/5 text-zinc-100 dark:bg-white/10"
                    : "bg-zinc-900/5 text-zinc-300 dark:bg-white/5"
              }`}
            >
              S{p.seasonNumber}: {stateText(p)}
            </span>
          ))}
        </li>
      ))}
    </ul>
  );
}

export function OtherLanguages({ rows }: { rows: OtherLanguageRow[] }) {
  const groups = new Map<string, OtherLanguageRow[]>();
  for (const r of rows) {
    const key = `${r.kind}|${r.group}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {[...groups.entries()].map(([key, list]) => (
        <div key={key} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.02]">
          <h3 className="mb-2 text-xs font-black uppercase tracking-wide text-zinc-400">{GROUP_LABEL[list[0].group]}</h3>
          <ul className="flex flex-wrap gap-1.5">
            {list.map((r) => (
              <li
                key={`${key}-${r.name}`}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${r.status === "FULL" ? "border-zinc-300 bg-zinc-100 text-zinc-900 dark:border-white/15 dark:bg-white/10 dark:text-white" : "border-dashed border-zinc-400 text-zinc-700 dark:border-white/25 dark:text-zinc-200"}`}
                title={r.status === "FULL" ? `Bütün ${r.total} epizodda` : `${r.total} epizoddan ${r.available}-də`}
              >
                {r.status === "PARTIAL" ? <PartialMark kind={r.kind === "AUDIO" ? "dub" : "sub"} /> : null}
                {r.name}
                {r.status === "PARTIAL" ? <span className="text-zinc-400">{r.available}/{r.total}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function VerificationNote({ hbo, kind = "SERIES" }: { hbo: NonNullable<StreamingTitleDetail["hbo"]>; kind?: StreamingTitleDetail["kind"] }) {
  const done = hbo.episodesVerified >= hbo.episodesTotal;
  return (
    <p className="flex items-start gap-2 text-xs text-zinc-500">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        {kind === "MOVIE"
          ? done
            ? "Film HBO Max-ın Azərbaycan kataloqunda player-də yoxlanılıb"
            : "Film HBO Max-ın Azərbaycan kataloqunda hələ yoxlanılır"
          : `HBO Max-ın Azərbaycan kataloqunda hər epizod player-də ayrıca yoxlanılıb (${hbo.episodesVerified}/${hbo.episodesTotal} epizod${done ? "" : " — qalanları yoxlanılır"})`}
        {hbo.lastVerifiedAt ? ` · son yoxlama: ${formatAzDate(hbo.lastVerifiedAt)}` : ""}.
      </span>
    </p>
  );
}
