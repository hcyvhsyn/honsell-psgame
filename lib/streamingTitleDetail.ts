/**
 * Film/serial detal səhifəsinin datası (server).
 *
 * - Xülasə (TR/RU/EN × dublyaj/altyazı) kartla EYNİ qaydadır (`mergeLanguages` + `languageSlots`).
 * - HBO Max AZ hissəsi (sezon × dil, epizod siyahısı, digər dillər) YALNIZ AZ player-də
 *   təsdiqlənmiş epizodların REGION treklərindən qurulur; qlobal metadata göstərilmir.
 *   `HBOMAX_STOREFRONT_COVERAGE=1` olmadan bu hissə ümumiyyətlə sorğulanmır
 *   (Provider* cədvəlləri pending miqrasiyadadır).
 */
import { prisma } from "@/lib/prisma";
import { HBOMAX_COVERAGE_ENABLED, loadHboCoverage, mergeLanguages } from "@/lib/hbomaxStorefront";
import {
  MAIN_LANGS,
  episodeTrackKey,
  seasonLanguageMatrix,
  type EpisodeTrackChip,
  type EpisodeTracks,
  type SeasonRow,
} from "@/lib/streamingLanguageStates";

const REGION = "AZ";

export interface OtherLanguageRow {
  kind: "AUDIO" | "SUBTITLE";
  group: "main" | "audio_description" | "subtitle" | "closed_caption" | "forced";
  name: string;
  status: "FULL" | "PARTIAL";
  available: number;
  total: number;
}

export interface StreamingTitleDetail {
  id: string;
  slug: string;
  title: string;
  kind: "MOVIE" | "SERIES";
  year: number | null;
  description: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  genres: string[];
  platforms: Array<{ platform: string; deepLinkUrl: string | null }>;
  audioLanguages: string[];
  subtitleLanguages: string[];
  languageCoverage?: Record<string, { coverage: "FULL" | "PARTIAL"; available: number; total: number }>;
  hbo?: {
    seasons: SeasonRow[];
    episodesTotal: number;
    episodesVerified: number;
    lastVerifiedAt: string | null;
    otherLanguages: OtherLanguageRow[];
    /** Yalnız təsdiqlənmiş epizodlar. */
    episodeTracks: Record<string, EpisodeTracks>;
  };
}

const isMainStorefrontRow = (r: { kind: string; trackGroup: string; code: string }) =>
  (MAIN_LANGS as readonly string[]).includes(r.code) &&
  ((r.kind === "AUDIO" && r.trackGroup === "main") || (r.kind === "SUBTITLE" && (r.trackGroup === "subtitle" || r.trackGroup === "closed_caption")));

async function loadHboDetail(streamingTitleId: string): Promise<StreamingTitleDetail["hbo"]> {
  const pt = await prisma.providerTitle.findFirst({
    where: { streamingTitleId, platform: "HBOMAX" },
    select: {
      episodes: {
        where: { isCurrentlyListed: true },
        select: {
          seasonNumber: true,
          episodeNumber: true,
          name: true,
          metadataEditId: true,
          globalTracksHash: true,
          tracks: { where: { scope: "REGION", region: REGION }, select: { kind: true, type: true, forced: true, code: true, name: true, position: true }, orderBy: { position: "asc" } },
          regionStates: { where: { region: REGION }, select: { verifiedAt: true, validatedEditId: true, validatedGlobalHash: true } },
        },
      },
      languages: {
        where: { region: REGION, status: { in: ["FULL", "PARTIAL"] } },
        select: { kind: true, trackGroup: true, code: true, displayName: true, status: true, episodesAvailable: true, episodesTotal: true },
      },
    },
  });
  if (!pt || !pt.episodes.length) return undefined;

  let lastVerified: Date | null = null;
  const episodeTracks: Record<string, EpisodeTracks> = {};
  const episodes = pt.episodes.map((e) => {
    const st = e.regionStates[0];
    // Təsdiq yalnız barmaq izi (edit.id + qlobal hash) hazırkı metadata ilə eynidirsə keçərlidir.
    const verified = !!st?.verifiedAt && st.validatedEditId === e.metadataEditId && st.validatedGlobalHash === e.globalTracksHash;
    if (verified && (!lastVerified || st!.verifiedAt! > lastVerified)) lastVerified = st!.verifiedAt;
    if (verified) {
      const chip = (t: (typeof e.tracks)[number]): EpisodeTrackChip => ({
        name: t.name,
        code: t.code,
        type: t.kind === "SUBTITLE" && t.forced ? "forced" : t.type,
      });
      episodeTracks[episodeTrackKey(e.seasonNumber, e.episodeNumber)] = {
        audio: e.tracks.filter((t) => t.kind === "AUDIO").map(chip),
        subtitles: e.tracks.filter((t) => t.kind === "SUBTITLE").map(chip),
      };
    }
    return { seasonNumber: e.seasonNumber, episodeNumber: e.episodeNumber, name: e.name, verified, regionTracks: e.tracks };
  });

  const otherLanguages = pt.languages
    .filter((l) => !isMainStorefrontRow(l))
    .map((l): OtherLanguageRow => ({
      kind: l.kind as OtherLanguageRow["kind"],
      group: l.trackGroup as OtherLanguageRow["group"],
      name: l.displayName,
      status: l.status as OtherLanguageRow["status"],
      available: l.episodesAvailable,
      total: l.episodesTotal,
    }))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.group.localeCompare(b.group) || b.available - a.available || a.name.localeCompare(b.name));

  return {
    seasons: seasonLanguageMatrix(episodes),
    episodesTotal: episodes.length,
    episodesVerified: episodes.filter((e) => e.verified).length,
    lastVerifiedAt: (lastVerified as Date | null)?.toISOString() ?? null,
    otherLanguages,
    episodeTracks,
  };
}

export async function loadStreamingTitleDetail(slug: string, kind: "MOVIE" | "SERIES"): Promise<StreamingTitleDetail | null> {
  const t = await prisma.streamingTitle.findFirst({
    where: { slug, kind, isActive: true, azAvailable: true },
    select: {
      id: true,
      slug: true,
      title: true,
      kind: true,
      year: true,
      description: true,
      posterUrl: true,
      backdropUrl: true,
      genres: true,
      availabilities: {
        where: { isAvailable: true },
        select: { id: true, platform: true, deepLinkUrl: true, languages: { select: { code: true, kind: true } } },
      },
    },
  });
  if (!t) return null;

  const coverage = await loadHboCoverage(t.availabilities.map((a) => a.id));
  const langs = mergeLanguages(t.availabilities, coverage);
  const hasHbo = t.availabilities.some((a) => a.platform === "HBOMAX");

  return {
    id: t.id,
    slug: t.slug,
    title: t.title,
    kind: t.kind === "SERIES" ? "SERIES" : "MOVIE",
    year: t.year,
    description: t.description,
    posterUrl: t.posterUrl,
    backdropUrl: t.backdropUrl,
    genres: Array.isArray(t.genres) ? t.genres.filter((g): g is string => typeof g === "string") : [],
    platforms: t.availabilities.map((a) => ({ platform: a.platform, deepLinkUrl: a.deepLinkUrl })),
    audioLanguages: langs.audio,
    subtitleLanguages: langs.sub,
    languageCoverage: langs.coverage,
    hbo: HBOMAX_COVERAGE_ENABLED && hasHbo ? await loadHboDetail(t.id) : undefined,
  };
}
