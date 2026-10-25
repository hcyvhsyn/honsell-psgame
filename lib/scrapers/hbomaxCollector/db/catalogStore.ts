/**
 * Stage 1 (metadata) DB yazısı: başlıq, regional görünmə, sezon, epizod, GLOBAL
 * treklər və validasiya növbəsi qərarları. REGION treklərinə HEÇ VAXT toxunmur.
 */
import { prisma } from "@/lib/prisma";
import type { LanguageTrack } from "@/lib/scrapers/hbomaxCollector/models";
import { titleKindOf, type JsonSeriesResult } from "@/lib/scrapers/hbomaxCollector/parsers/jsonMetadata";
import { decideQueueAction } from "@/lib/scrapers/hbomaxCollector/queue/rules";
import { globalTracksHash } from "@/lib/scrapers/hbomaxCollector/utils/trackIdentity";

export const PLATFORM = "HBOMAX";

export type LinkKind = "MATCHED_IMDB" | "MATCHED_TITLE" | "CREATED";

/** Validasiyada P0 verən bağlantı — başlıq Honsell kataloqunda proyeksiyadan ƏVVƏL var idi. */
export function isPriorityLink(linkKind: string | null | undefined): boolean {
  return linkKind === "MATCHED_IMDB" || linkKind === "MATCHED_TITLE";
}

export function trackRows(kind: "AUDIO" | "SUBTITLE", tracks: LanguageTrack[]) {
  return tracks.map((t, position) => ({
    kind,
    type: t.type,
    code: t.code ?? null,
    locale: t.locale ?? null,
    name: t.name,
    rawLabel: t.rawLabel,
    forced: t.forced ?? false,
    position,
  }));
}

export interface DiscoveredShow {
  providerId: string;
  name: string;
  providerUrl: string;
  /** `show.attributes.showType` — kind (SERIES/MOVIE) buradan. */
  showType?: string;
}

/**
 * Kəşf mərhələsində görünən şoular — detal sorğusu sonra uğursuz olsa belə
 * "görünüb" sayılır (görünmə ≠ detalın çəkilməsi). Yeni şou minimal sətirlə yaranır.
 * Qaytarır: bu run-da İLK dəfə yaranmış providerId-lər.
 */
export async function markShowsSeen(region: string, shows: DiscoveredShow[], now: Date): Promise<Set<string>> {
  const created = new Set<string>();
  for (const s of shows) {
    const existing = await prisma.providerTitle.findUnique({
      where: { platform_providerId: { platform: PLATFORM, providerId: s.providerId } },
      select: { id: true },
    });
    const titleId =
      existing?.id ??
      (
        await prisma.providerTitle.create({
          data: { platform: PLATFORM, providerId: s.providerId, kind: titleKindOf(s.showType), title: s.name || s.providerId, providerUrl: s.providerUrl },
          select: { id: true },
        })
      ).id;
    if (!existing) created.add(s.providerId);
    await prisma.providerTitleRegion.upsert({
      where: { titleId_region: { titleId, region } },
      create: { titleId, region, firstSeenAt: now, lastSeenAt: now },
      update: { lastSeenAt: now, consecutiveMissingSyncs: 0, isCurrentlyAvailable: true, missingSince: null },
    });
  }
  return created;
}

/**
 * Yalnız UĞURLU TAM sync-dən sonra çağırılmalıdır. Görünməyənlərin sayğacı artır;
 * 3-də `isCurrentlyAvailable=false` + `missingSince` (əgər boşdursa). Heç nə silinmir.
 */
export async function applyMissingSyncs(region: string, seenProviderIds: Set<string>, now: Date, threshold = 3) {
  const seenTitles = await prisma.providerTitle.findMany({
    where: { platform: PLATFORM, providerId: { in: [...seenProviderIds] } },
    select: { id: true },
  });
  const seenIds = seenTitles.map((t) => t.id);
  const incremented = await prisma.providerTitleRegion.updateMany({
    where: { region, titleId: { notIn: seenIds }, title: { platform: PLATFORM } },
    data: { consecutiveMissingSyncs: { increment: 1 } },
  });
  const deactivated = await prisma.providerTitleRegion.updateMany({
    where: { region, isCurrentlyAvailable: true, consecutiveMissingSyncs: { gte: threshold }, title: { platform: PLATFORM } },
    data: { isCurrentlyAvailable: false },
  });
  await prisma.providerTitleRegion.updateMany({
    where: { region, missingSince: null, consecutiveMissingSyncs: { gte: threshold }, title: { platform: PLATFORM } },
    data: { missingSince: now },
  });
  return { incremented: incremented.count, deactivated: deactivated.count };
}

export interface PersistShowResult {
  titleId: string;
  episodesCreated: number;
  episodesUpdated: number;
  globalTrackSetsReplaced: number;
  episodesUnlisted: number;
  queueCreated: number;
  queueStaled: number;
}

/**
 * Bir şounun detalını yazır. `complete=false` (hansısa sezon tam yüklənməyib) olduqda
 * siyahıda olmayan epizodlar "unlisted" edilmir — natamam cavab silinmə sayılmasın.
 */
export async function persistShow(input: {
  region: string;
  show: JsonSeriesResult;
  providerUrl: string;
  complete: boolean;
  titleIsNew: boolean;
  now: Date;
  revalidateAfterDays: number;
}): Promise<PersistShowResult> {
  const { region, show, now } = input;
  if (!show.providerId || !show.title) throw new Error("persistShow: show without providerId/title");
  const providerId = show.providerId;

  return prisma.$transaction(
    async (tx) => {
      const title = await tx.providerTitle.upsert({
        where: { platform_providerId: { platform: PLATFORM, providerId } },
        create: {
          platform: PLATFORM,
          providerId,
          kind: show.kind,
          title: show.title!,
          originalTitle: show.originalTitle,
          description: show.description,
          year: show.year,
          genres: show.genres,
          posterUrl: show.posterUrl,
          backdropUrl: show.backdropUrl,
          providerUrl: input.providerUrl,
          lastMetadataSyncAt: now,
        },
        update: {
          kind: show.kind,
          title: show.title!,
          originalTitle: show.originalTitle ?? null,
          description: show.description ?? null,
          year: show.year ?? null,
          genres: show.genres,
          posterUrl: show.posterUrl ?? null,
          backdropUrl: show.backdropUrl ?? null,
          providerUrl: input.providerUrl,
          lastMetadataSyncAt: now,
        },
        select: { id: true, streamingTitleId: true, linkKind: true },
      });
      // P0 yalnız Honsell-də ARTIQ olan başlığa uyğunlaşanda — proyeksiyanın özü yaratdığı
      // başlıq (CREATED) P0 deyil, yoxsa hər şey P0 olar və prioritet mənasını itirər.
      const titleLinked = isPriorityLink(title.linkKind);

      const seasonIdByProvider = new Map<string, string>();
      for (const si of show.seasonInfo) {
        const s = await tx.providerSeason.upsert({
          where: { titleId_providerId: { titleId: title.id, providerId: si.providerId } },
          create: { titleId: title.id, providerId: si.providerId, seasonNumber: si.seasonNumber, expectedEpisodes: si.expectedEpisodes },
          update: { seasonNumber: si.seasonNumber, expectedEpisodes: si.expectedEpisodes ?? null },
          select: { id: true },
        });
        seasonIdByProvider.set(si.providerId, s.id);
      }

      const existing = await tx.providerEpisode.findMany({
        where: { titleId: title.id },
        select: {
          id: true,
          providerId: true,
          globalTracksHash: true,
          regionStates: {
            where: { region },
            select: { id: true, status: true, validatedEditId: true, validatedGlobalHash: true, verifiedAt: true, attempts: true },
          },
        },
      });
      const byProvider = new Map(existing.map((e) => [e.providerId, e]));
      const result: PersistShowResult = {
        titleId: title.id,
        episodesCreated: 0,
        episodesUpdated: 0,
        globalTrackSetsReplaced: 0,
        episodesUnlisted: 0,
        queueCreated: 0,
        queueStaled: 0,
      };
      const seenEpisodeIds: string[] = [];

      for (const season of show.seasons) {
        const seasonId = season.providerId && seasonIdByProvider.get(season.providerId);
        if (!seasonId) continue;
        for (const ep of season.episodes) {
          if (!ep.providerId) continue;
          const hash = globalTracksHash(ep.audioTracks, ep.subtitleTracks);
          const prev = byProvider.get(ep.providerId);
          const data = {
            seasonId,
            seasonNumber: ep.seasonNumber,
            episodeNumber: ep.episodeNumber,
            name: ep.title ?? null,
            providerUrl: ep.providerUrl ?? `${new URL(input.providerUrl).origin}/video/watch/${ep.providerId}`,
            metadataEditId: ep.metadataEditId ?? null,
            globalTracksHash: hash,
            lastMetadataSyncAt: now,
            lastSeenAt: now,
            isCurrentlyListed: true,
          };
          const row = prev
            ? await tx.providerEpisode.update({ where: { id: prev.id }, data, select: { id: true } })
            : await tx.providerEpisode.create({ data: { ...data, titleId: title.id, providerId: ep.providerId, firstSeenAt: now }, select: { id: true } });
          if (prev) result.episodesUpdated++;
          else result.episodesCreated++;
          seenEpisodeIds.push(row.id);

          // GLOBAL dəsti yalnız dəyişəndə əvəz olunur. REGION dəstinə toxunulmur.
          if (!prev || prev.globalTracksHash !== hash) {
            await tx.episodeTrack.deleteMany({ where: { episodeId: row.id, scope: "GLOBAL" } });
            await tx.episodeTrack.createMany({
              data: [...trackRows("AUDIO", ep.audioTracks), ...trackRows("SUBTITLE", ep.subtitleTracks)].map((t) => ({
                ...t,
                episodeId: row.id,
                scope: "GLOBAL",
                region: null,
                observedAt: now,
              })),
            });
            result.globalTrackSetsReplaced++;
          }

          const state = prev?.regionStates[0] ?? null;
          const decision = decideQueueAction(
            state && { ...state, status: state.status as never },
            { editId: ep.metadataEditId ?? null, globalHash: hash },
            { now, revalidateAfterDays: input.revalidateAfterDays, titleLinked, titleIsNew: input.titleIsNew, isFeature: show.kind === "MOVIE" }
          );
          if (decision.action === "create") {
            await tx.episodeRegionState.create({ data: { episodeId: row.id, region, status: decision.status, priority: decision.priority } });
            result.queueCreated++;
          } else if (decision.action === "update" && state) {
            await tx.episodeRegionState.update({
              where: { id: state.id },
              data: { status: decision.status, priority: decision.priority, attempts: 0, nextAttemptAt: null },
            });
            result.queueStaled++;
          }
        }
      }

      if (input.complete) {
        const unlisted = await tx.providerEpisode.updateMany({
          where: { titleId: title.id, isCurrentlyListed: true, id: { notIn: seenEpisodeIds } },
          data: { isCurrentlyListed: false },
        });
        result.episodesUnlisted = unlisted.count;
      }
      return result;
    },
    { timeout: 120_000, maxWait: 20_000 }
  );
}
