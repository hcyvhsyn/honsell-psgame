/**
 * ProviderTitleLanguage (AZ, region-playable aqreqasiyası) → vitrinin ContentLanguage
 * sətirləri — SAF, `npm run test:hbomax-queue`.
 *
 * Qaydalar:
 * - YALNIZ `FULL` və `PARTIAL`. `NONE` (AZ-da yoxdur) və `UNVERIFIED` (hələ yoxlanmayıb)
 *   heç vaxt vitrinə düşmür — qlobal metadata AZ mövcudluğu deyil.
 * - Vitrin yalnız tr/ru/en göstərir (`lib/streamingLanguages.ts`).
 * - AUDIO: yalnız `main` qrupu (original/dub). Audio description ayrıca xidmətdir, "dublyaj" deyil.
 * - SUBTITLE: `subtitle` + `closed_caption` (CC də oxunaqlı altyazıdır); `forced` deyil —
 *   yalnız xarici dildə danışılan hissələri göstərir.
 * - Eyni dilin bir neçə locale-i (en-US / en-GB) bir sətrə birləşir: FULL > PARTIAL,
 *   bərabərdə daha çox epizod.
 */
import type { LanguageCode } from "@/lib/streamingLanguages";

export type Coverage = "FULL" | "PARTIAL";
export const STOREFRONT_SOURCE = "HBOMAX_AZ_PLAYER";
const STOREFRONT_CODES: ReadonlySet<string> = new Set<LanguageCode>(["tr", "ru", "en"]);

export interface TitleLanguageInput {
  kind: string;
  trackGroup: string;
  code: string;
  status: string;
  episodesAvailable: number;
  episodesTotal: number;
}

export interface StorefrontLanguageRow {
  code: LanguageCode;
  kind: "AUDIO" | "SUBTITLE";
  coverage: Coverage;
  episodesAvailable: number;
  episodesTotal: number;
}

function eligible(r: TitleLanguageInput): boolean {
  if (r.status !== "FULL" && r.status !== "PARTIAL") return false;
  if (!STOREFRONT_CODES.has(r.code)) return false;
  if (r.kind === "AUDIO") return r.trackGroup === "main";
  if (r.kind === "SUBTITLE") return r.trackGroup === "subtitle" || r.trackGroup === "closed_caption";
  return false;
}

function better(a: StorefrontLanguageRow, b: StorefrontLanguageRow): StorefrontLanguageRow {
  if (a.coverage !== b.coverage) return a.coverage === "FULL" ? a : b;
  return b.episodesAvailable > a.episodesAvailable ? b : a;
}

export function toStorefrontLanguages(rows: TitleLanguageInput[]): StorefrontLanguageRow[] {
  const out = new Map<string, StorefrontLanguageRow>();
  for (const r of rows) {
    if (!eligible(r)) continue;
    const row: StorefrontLanguageRow = {
      code: r.code as LanguageCode,
      kind: r.kind as "AUDIO" | "SUBTITLE",
      coverage: r.status as Coverage,
      episodesAvailable: r.episodesAvailable,
      episodesTotal: r.episodesTotal,
    };
    const key = `${row.kind}|${row.code}`;
    const prev = out.get(key);
    out.set(key, prev ? better(prev, row) : row);
  }
  return [...out.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.code.localeCompare(b.code));
}
