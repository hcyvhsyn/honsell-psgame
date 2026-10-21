/**
 * Metadata treklərinin player UI-dakı görünən treklərlə müqayisəsi — SAF.
 *
 * Məqsəd (Phase 1 validasiyası): `edit.attributes.audioTracks/subtitles` AZ hesabına
 * həqiqətən əlçatan treklərdirmi, yoxsa qlobal aktivlər siyahısıdır?
 *
 * Müqayisə açarı etiketin özü deyil, normallaşdırılmış forma: `qrup|locale||kod||ad`.
 * Qrup audio üçün main/ad, altyazı üçün sub/cc/forced-dir — "English - Original"
 * (metadata) ilə "English" (UI) eyni trek sayılır, "English - Audio Description" yox.
 * Xam etiketlər hər iki tərəfdə olduğu kimi qaytarılır.
 */
import type { LanguageTrack } from "@/lib/scrapers/hbomaxCollector/models";
import { trackGroup } from "@/lib/scrapers/hbomaxCollector/utils/trackIdentity";

export interface TrackComparison {
  metadataAudio: LanguageTrack[];
  uiAudio: LanguageTrack[];
  audioMatch: boolean;

  metadataSubtitles: LanguageTrack[];
  uiSubtitles: LanguageTrack[];
  subtitleMatch: boolean;

  metadataOnlyAudio: LanguageTrack[];
  uiOnlyAudio: LanguageTrack[];

  metadataOnlySubtitles: LanguageTrack[];
  uiOnlySubtitles: LanguageTrack[];

  /** Locale/etiket fərqli, amma eyni qrup+dil koduna görə TƏK namizədlə cütlənənlər
   *  (məs. metadata "Romanian (Moldova)" ↔ UI "Romanian"). Only-siyahılara düşmür. */
  labelVariants: Array<{ kind: "audio" | "subtitle"; metadata: LanguageTrack; ui: LanguageTrack }>;
}

export function trackKey(t: LanguageTrack): string {
  return `${trackGroup(t)}|${(t.locale ?? t.code ?? t.name).toLowerCase()}`;
}

function diff(a: LanguageTrack[], b: LanguageTrack[]): LanguageTrack[] {
  const keys = new Set(b.map(trackKey));
  return a.filter((t) => !keys.has(trackKey(t)));
}

/** Qalan uyğunsuzluqlar arasında `qrup|kod` üzrə hər tərəfdə TƏK olanları cütləyir. */
function pairVariants(metaOnly: LanguageTrack[], uiOnly: LanguageTrack[]) {
  const loose = (t: LanguageTrack) => (t.code ? `${trackGroup(t)}|${t.code}` : undefined);
  const count = (list: LanguageTrack[], k: string) => list.filter((t) => loose(t) === k).length;
  const pairs: Array<{ metadata: LanguageTrack; ui: LanguageTrack }> = [];
  for (const m of metaOnly) {
    const k = loose(m);
    if (!k || count(metaOnly, k) !== 1 || count(uiOnly, k) !== 1) continue;
    pairs.push({ metadata: m, ui: uiOnly.find((u) => loose(u) === k)! });
  }
  const paired = new Set(pairs.flatMap((p) => [p.metadata, p.ui]));
  return { pairs, metaOnly: metaOnly.filter((t) => !paired.has(t)), uiOnly: uiOnly.filter((t) => !paired.has(t)) };
}

export function compareTracks(
  metadata: { audio: LanguageTrack[]; subtitles: LanguageTrack[] },
  ui: { audio: LanguageTrack[]; subtitles: LanguageTrack[] }
): TrackComparison {
  const audio = pairVariants(diff(metadata.audio, ui.audio), diff(ui.audio, metadata.audio));
  const subs = pairVariants(diff(metadata.subtitles, ui.subtitles), diff(ui.subtitles, metadata.subtitles));
  const metadataOnlyAudio = audio.metaOnly;
  const uiOnlyAudio = audio.uiOnly;
  const metadataOnlySubtitles = subs.metaOnly;
  const uiOnlySubtitles = subs.uiOnly;
  return {
    metadataAudio: metadata.audio,
    uiAudio: ui.audio,
    audioMatch: !metadataOnlyAudio.length && !uiOnlyAudio.length,
    metadataSubtitles: metadata.subtitles,
    uiSubtitles: ui.subtitles,
    subtitleMatch: !metadataOnlySubtitles.length && !uiOnlySubtitles.length,
    metadataOnlyAudio,
    uiOnlyAudio,
    metadataOnlySubtitles,
    uiOnlySubtitles,
    labelVariants: [
      ...audio.pairs.map((p) => ({ kind: "audio" as const, ...p })),
      ...subs.pairs.map((p) => ({ kind: "subtitle" as const, ...p })),
    ],
  };
}
