/**
 * Vitrin dil vəziyyətləri — SAF və client-safe (kart + detal səhifəsi eyni qaydanı işlədir).
 * Testlər: `npm run test:hbomax-queue`.
 *
 * Əsas 3 dil (tr/ru/en) kartda HƏMİŞƏ eyni sırada göstərilir; hər slot üç vəziyyətdən biridir:
 *   full    — dil var (HBO-da: AZ player-də bütün epizodlarda təsdiqlənib)
 *   partial — yalnız bəzi epizodlarda (yalnız HBO Max AZ coverage-i olanda mümkündür)
 *   none    — yoxdur
 *
 * "Dublyaj" = audio treki (orijinal və ya dublyaj); audio description sayılmır.
 * "Altyazı" = adi altyazı + CC; "forced" (yalnız xarici danışıq hissələri) sayılmır.
 */

export const MAIN_LANGS = ["tr", "ru", "en"] as const;
export type MainLang = (typeof MAIN_LANGS)[number];
export type LangKind = "dub" | "sub";
export type LangState = "full" | "partial" | "none";

export const LANG_NAME_AZ: Record<MainLang, string> = { tr: "Türk", ru: "Rus", en: "İngilis" };
export const LANG_SHORT: Record<MainLang, string> = { tr: "TR", ru: "RU", en: "EN" };
export const KIND_NAME_AZ: Record<LangKind, string> = { dub: "Dublyaj", sub: "Altyazı" };

export interface CoverageInfo {
  coverage: "FULL" | "PARTIAL";
  available: number;
  total: number;
}

export interface LanguageSlot {
  code: MainLang;
  kind: LangKind;
  state: LangState;
  /** Yalnız HBO AZ coverage-i olanda. */
  available?: number;
  total?: number;
}

/** Kart/detal xülasəsi: birləşik dil siyahıları + (varsa) HBO AZ coverage xəritəsi. */
export function languageSlots(input: {
  audioLanguages: string[];
  subtitleLanguages: string[];
  languageCoverage?: Record<string, CoverageInfo>;
}): Record<LangKind, LanguageSlot[]> {
  const build = (kind: LangKind, pool: string[]) =>
    MAIN_LANGS.map((code): LanguageSlot => {
      if (!pool.includes(code)) return { code, kind, state: "none" };
      const cov = input.languageCoverage?.[`${code}-${kind}`];
      if (cov?.coverage === "PARTIAL") return { code, kind, state: "partial", available: cov.available, total: cov.total };
      return cov ? { code, kind, state: "full", available: cov.available, total: cov.total } : { code, kind, state: "full" };
    });
  return { dub: build("dub", input.audioLanguages), sub: build("sub", input.subtitleLanguages) };
}

export function slotTooltip(s: LanguageSlot): string {
  const what = `${LANG_NAME_AZ[s.code]} ${s.kind === "dub" ? "dublyaj" : "altyazı"}`;
  if (s.state === "none") return `${what}: yoxdur`;
  if (s.state === "partial") return `${what}: bəzi epizodlarda (${s.total} epizoddan ${s.available}-də)`;
  // total=1 → film (1 "epizod") — "bütün 1 epizodda" mənasızdır.
  return s.total && s.total > 1 ? `${what}: bütün ${s.total} epizodda` : `${what}: var`;
}

// ── Detal: sezon × dil matrisi (HBO Max AZ region treklərindən) ─────────────

export interface EpisodeTrackLite {
  kind: string; // AUDIO | SUBTITLE
  type: string;
  forced: boolean;
  code: string | null;
}

export interface EpisodeInput {
  seasonNumber: number;
  episodeNumber: number;
  name: string | null;
  /** AZ player-də təsdiqlənib (barmaq izi hazırkı metadata ilə eynidir). */
  verified: boolean;
  regionTracks: EpisodeTrackLite[];
}

export type LangKey = `${MainLang}-${LangKind}`;
export const LANG_KEYS: LangKey[] = MAIN_LANGS.flatMap((c) => [`${c}-dub`, `${c}-sub`] as LangKey[]);

export function trackLangKey(t: EpisodeTrackLite): LangKey | null {
  if (!t.code || !(MAIN_LANGS as readonly string[]).includes(t.code)) return null;
  if (t.kind === "AUDIO") return t.type === "audio_description" ? null : (`${t.code}-dub` as LangKey);
  if (t.kind === "SUBTITLE") return t.forced ? null : (`${t.code}-sub` as LangKey);
  return null;
}

export interface SeasonRow {
  seasonNumber: number;
  total: number;
  verified: number;
  /** Təsdiqlənmiş epizodlar arasında dilin olduğu epizod sayı. */
  available: Record<LangKey, number>;
  episodes: Array<{ episodeNumber: number; name: string | null; verified: boolean; has: Record<LangKey, boolean> }>;
}

const emptyCounts = (): Record<LangKey, number> => Object.fromEntries(LANG_KEYS.map((k) => [k, 0])) as Record<LangKey, number>;

export function seasonLanguageMatrix(episodes: EpisodeInput[]): SeasonRow[] {
  const bySeason = new Map<number, SeasonRow>();
  for (const ep of [...episodes].sort((a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber)) {
    const row = bySeason.get(ep.seasonNumber) ?? { seasonNumber: ep.seasonNumber, total: 0, verified: 0, available: emptyCounts(), episodes: [] };
    row.total++;
    const keys = new Set(ep.verified ? ep.regionTracks.map(trackLangKey).filter((k): k is LangKey => !!k) : []);
    if (ep.verified) row.verified++;
    for (const k of keys) row.available[k]++;
    row.episodes.push({
      episodeNumber: ep.episodeNumber,
      name: ep.name,
      verified: ep.verified,
      has: Object.fromEntries(LANG_KEYS.map((k) => [k, keys.has(k)])) as Record<LangKey, boolean>,
    });
    bySeason.set(ep.seasonNumber, row);
  }
  return [...bySeason.values()];
}

/** Sezon xanası: təsdiq tam deyilsə "unverified" — qismən təsdiqi "yoxdur" kimi göstərmə. */
export function seasonCellState(row: SeasonRow, key: LangKey): LangState | "unverified" {
  if (row.verified < row.total) return row.available[key] > 0 ? "partial" : "unverified";
  if (row.available[key] === row.total) return "full";
  return row.available[key] === 0 ? "none" : "partial";
}

// ── Ətraflı görünüş: epizodun bütün trekləri + sezonlar arası fərqlər ─────────

/** Epizodun AZ player-də görünən BÜTÜN trekləri. */
export interface EpisodeTrackChip {
  name: string;
  code: string | null;
  /** AUDIO: original | dub | voice_over | audio_description …; SUBTITLE: subtitle | closed_caption | forced */
  type: string;
}

export interface EpisodeTracks {
  audio: EpisodeTrackChip[];
  subtitles: EpisodeTrackChip[];
}

/** `episodeTracks` açarı. */
export const episodeTrackKey = (season: number, episode: number) => `${season}x${episode}`;

export interface SeasonDifference {
  key: LangKey;
  perSeason: Array<{ seasonNumber: number; state: LangState | "unverified"; available: number; total: number }>;
}

/**
 * Sezondan sezona VƏZİYYƏTİ dəyişən dillər (məs. RU altyazı: S1 tam, S3 yoxdur).
 * Tək sezonda və ya hamısı eyni olanda boş. Yoxlanmamış sezon fərq sayılmır.
 */
export function seasonDifferences(seasons: SeasonRow[]): SeasonDifference[] {
  if (seasons.length < 2) return [];
  const out: SeasonDifference[] = [];
  for (const key of LANG_KEYS) {
    const perSeason = seasons.map((r) => ({ seasonNumber: r.seasonNumber, state: seasonCellState(r, key), available: r.available[key], total: r.total }));
    const known = new Set(perSeason.filter((p) => p.state !== "unverified").map((p) => p.state));
    if (known.size > 1) out.push({ key, perSeason });
  }
  return out;
}
