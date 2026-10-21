/**
 * Şou səviyyəsində regional dil mövcudluğu — SAF, `npm run test:hbomax-queue`.
 *
 * Mənbə YALNIZ REGION treklərdir. GLOBAL treklər yalnız "dil universumu"nu
 * genişləndirir: German yalnız qlobalda varsa və bütün epizodlar təsdiqlənibsə,
 * nəticə NONE olur ("AZ-da yoxdur" — bu da məlumatdır).
 *
 * Bir epizod "təsdiqlənmiş" sayılır: `verifiedAt` var VƏ təsdiq anındakı barmaq izi
 * (edit.id + qlobal hash) hazırkı metadata ilə eynidir. TTL-ə görə STALE olmuş, amma
 * barmaq izi dəyişməmiş epizod təsdiqli qalır — yenidən yoxlanana qədər son real
 * müşahidədir. Barmaq izi dəyişibsə köhnə regional treklər sayılmır.
 *
 *   FULL       — verified = total, available = total
 *   PARTIAL    — verified = total, 0 < available < total
 *   NONE       — verified = total, available = 0
 *   UNVERIFIED — verified < total (saylar saxlanılır; vitrin "var" demir)
 */
import type { LanguageTrack } from "@/lib/scrapers/hbomaxCollector/models";
import { trackGroup, trackIdentityKey, type TrackGroup, type TrackKind } from "@/lib/scrapers/hbomaxCollector/utils/trackIdentity";

export type AvailabilityStatus = "FULL" | "PARTIAL" | "NONE" | "UNVERIFIED";

export interface AggTrack extends Pick<LanguageTrack, "type" | "forced" | "code" | "locale" | "name"> {
  kind: TrackKind;
}

export interface AggEpisode {
  isCurrentlyListed: boolean;
  /** Təsdiqli epizod (yuxarıdakı tərif) — çağıran hesablayır. */
  verified: boolean;
  globalTracks: AggTrack[];
  regionTracks: AggTrack[];
}

export interface TitleLanguageRow {
  kind: TrackKind;
  trackGroup: TrackGroup;
  code: string;
  locale: string;
  displayName: string;
  episodesAvailable: number;
  episodesVerified: number;
  episodesTotal: number;
  status: AvailabilityStatus;
}

export function statusFor(available: number, verified: number, total: number): AvailabilityStatus {
  if (verified < total) return "UNVERIFIED";
  if (available === total) return "FULL";
  if (available === 0) return "NONE";
  return "PARTIAL";
}

export function computeTitleLanguages(episodes: AggEpisode[]): { rows: TitleLanguageRow[]; skippedWithoutCode: number } {
  const listed = episodes.filter((e) => e.isCurrentlyListed);
  const total = listed.length;
  const verified = listed.filter((e) => e.verified);
  // Göstərmə adı: AZ-da görünən (region) ad üstündür, yoxdursa qlobal ad.
  const universe = new Map<string, { track: AggTrack; regionName?: string; globalName?: string }>();
  let skippedWithoutCode = 0;

  for (const ep of listed) {
    for (const [list, fromRegion] of [[ep.regionTracks, true], [ep.globalTracks, false]] as const) {
      for (const t of list) {
        if (!t.code) {
          skippedWithoutCode++;
          continue;
        }
        const key = trackIdentityKey(t.kind, t);
        const entry = universe.get(key) ?? { track: t };
        if (fromRegion) entry.regionName ??= t.name;
        else entry.globalName ??= t.name;
        universe.set(key, entry);
      }
    }
  }

  const rows: TitleLanguageRow[] = [];
  for (const [key, { track, regionName, globalName }] of universe) {
    const available = verified.filter((ep) => ep.regionTracks.some((t) => t.code && trackIdentityKey(t.kind, t) === key)).length;
    rows.push({
      kind: track.kind,
      trackGroup: trackGroup(track),
      code: track.code!,
      locale: track.locale ?? "",
      displayName: regionName ?? globalName ?? track.name,
      episodesAvailable: available,
      episodesVerified: verified.length,
      episodesTotal: total,
      status: statusFor(available, verified.length, total),
    });
  }
  rows.sort((a, b) => a.kind.localeCompare(b.kind) || a.trackGroup.localeCompare(b.trackGroup) || a.code.localeCompare(b.code) || a.locale.localeCompare(b.locale));
  return { rows, skippedWithoutCode };
}
