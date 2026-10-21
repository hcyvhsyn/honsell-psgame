/**
 * Trek kimliyi və barmaq izi — SAF.
 *
 * Kimlik `kind | qrup | code | locale`-dir, yalnız `code` DEYİL: bunlar ayrı qalır —
 * Spanish (Spain) es-ES ↔ Spanish (Latin America) es-419, Portuguese pt ↔ pt-BR,
 * English ↔ English - Audio Description. `rawLabel` kimliyə daxil deyil (provayder
 * etiketi dəyişsə də eyni trek sayılır), amma həmişə saxlanılır.
 */
import { createHash } from "node:crypto";
import type { LanguageTrack } from "@/lib/scrapers/hbomaxCollector/models";

export type TrackKind = "AUDIO" | "SUBTITLE";
export type TrackGroup = "main" | "audio_description" | "subtitle" | "closed_caption" | "forced";

/** Audio-da original/dub/voice_over/unknown "main" qrupudur — UI orijinallığı göstərməyə bilər. */
export function trackGroup(t: Pick<LanguageTrack, "type" | "forced">): TrackGroup {
  switch (t.type) {
    case "audio_description":
      return "audio_description";
    case "closed_caption":
      return "closed_caption";
    case "subtitle":
      return t.forced ? "forced" : "subtitle";
    default:
      return "main";
  }
}

/** Kod yoxdursa ad işlədilir (`name:<ad>`) — tanınmayan dil başqası ilə birləşməsin. */
export function trackIdentityKey(kind: TrackKind, t: Pick<LanguageTrack, "type" | "forced" | "code" | "locale" | "name">): string {
  const lang = t.code ?? `name:${t.name.toLowerCase()}`;
  return `${kind}|${trackGroup(t)}|${lang}|${t.locale ?? ""}`;
}

/** GLOBAL treklərin barmaq izi: sıralanmış rawLabel-lər. Sıra dəyişikliyi hash-i dəyişmir. */
export function globalTracksHash(audio: Array<Pick<LanguageTrack, "rawLabel">>, subtitles: Array<Pick<LanguageTrack, "rawLabel">>): string {
  const payload = JSON.stringify([audio.map((t) => t.rawLabel).sort(), subtitles.map((t) => t.rawLabel).sort()]);
  return createHash("sha1").update(payload).digest("hex");
}
