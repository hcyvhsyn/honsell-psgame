/**
 * HBO Max kollektor datasının PROD-a idxalı (server tərəfi).
 *
 * Kollektor Mac-də işləyir (AZ IP + HBO profili + lokal DB). Prod DB internetə açıq deyil,
 * ona görə data HTTPS ilə gəlir: `npm run hbomax:publish` → POST /api/hbomax/import
 * (`HBOMAX_IMPORT_TOKEN`). Bu modul paketi prod DB-yə yazır; proyeksiya sonra prod-un öz
 * kataloquna qarşı işləyir (StreamingTitle uyğunlaşması prod ID-ləri ilə).
 *
 * Mənbə yeganə yazıcıdır: başlığın sezon/epizod/validasiya/dil sətirləri hər idxalda
 * SİLİNİB yenidən yazılır (mənbə ID-ləri ilə — idempotent). Toxunulmayan yeganə sahələr
 * prod-un öz proyeksiya bağlantısıdır: `ProviderTitle.streamingTitleId` + `linkKind`.
 *
 * Yalnız REGION treklər gəlir — GLOBAL metadata trekləri vitrində işlənmir.
 */
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const HBOMAX_IMPORT_VERSION = 1;
export const IMPORT_MAX_TITLES = 40;
export const IMPORT_MAX_ROWS = 60_000;

type Iso = string;

export interface ImportTitle {
  title: {
    id: string;
    providerId: string;
    kind: string;
    title: string;
    originalTitle: string | null;
    description: string | null;
    year: number | null;
    genres: unknown;
    posterUrl: string | null;
    backdropUrl: string | null;
    providerUrl: string;
    lastMetadataSyncAt: Iso | null;
  };
  regions: Array<{ id: string; region: string; firstSeenAt: Iso; lastSeenAt: Iso; isCurrentlyAvailable: boolean; consecutiveMissingSyncs: number; missingSince: Iso | null }>;
  seasons: Array<{ id: string; providerId: string; seasonNumber: number; expectedEpisodes: number | null }>;
  episodes: Array<{
    id: string;
    seasonId: string;
    providerId: string;
    seasonNumber: number;
    episodeNumber: number;
    name: string | null;
    providerUrl: string;
    metadataEditId: string | null;
    globalTracksHash: string | null;
    lastMetadataSyncAt: Iso | null;
    firstSeenAt: Iso;
    lastSeenAt: Iso;
    isCurrentlyListed: boolean;
  }>;
  states: Array<{
    id: string;
    episodeId: string;
    region: string;
    status: string;
    priority: number;
    validatedEditId: string | null;
    validatedGlobalHash: string | null;
    lastRegionValidationAt: Iso | null;
    verifiedAt: Iso | null;
    attempts: number;
  }>;
  tracks: Array<{
    id: string;
    episodeId: string;
    region: string | null;
    regionStateId: string | null;
    kind: string;
    type: string;
    code: string | null;
    locale: string | null;
    name: string;
    rawLabel: string;
    forced: boolean;
    position: number;
    observedAt: Iso;
  }>;
  languages: Array<{
    id: string;
    region: string;
    kind: string;
    trackGroup: string;
    code: string;
    locale: string;
    displayName: string;
    episodesAvailable: number;
    episodesVerified: number;
    episodesTotal: number;
    status: string;
    computedAt: Iso;
  }>;
}

export interface ImportBatch {
  version: number;
  titles: ImportTitle[];
}

/** Token yoxlaması — sabit vaxtlı müqayisə. Token təyin olunmayıbsa endpoint bağlıdır. */
export function importTokenValid(header: string | null): boolean {
  const expected = process.env.HBOMAX_IMPORT_TOKEN?.trim();
  if (!expected || expected.length < 32 || !header?.startsWith("Bearer ")) return false;
  const got = Buffer.from(header.slice(7).trim());
  const want = Buffer.from(expected);
  return got.length === want.length && timingSafeEqual(got, want);
}

const d = (v: Iso | null | undefined) => (v ? new Date(v) : null);
const req = (v: Iso) => new Date(v);

export class ImportValidationError extends Error {}

/** Struktur yoxlaması — token arxasındadır, amma pozuq paket DB-ni yarımçıq qoymasın. */
export function validateBatch(body: unknown): ImportBatch {
  const b = body as Partial<ImportBatch> | null;
  if (!b || b.version !== HBOMAX_IMPORT_VERSION) throw new ImportValidationError(`version must be ${HBOMAX_IMPORT_VERSION}`);
  if (!Array.isArray(b.titles) || b.titles.length === 0 || b.titles.length > IMPORT_MAX_TITLES) throw new ImportValidationError(`titles: 1–${IMPORT_MAX_TITLES}`);
  let rows = 0;
  for (const t of b.titles) {
    if (!t?.title || typeof t.title.providerId !== "string" || typeof t.title.id !== "string" || typeof t.title.title !== "string") {
      throw new ImportValidationError("title.id/providerId/title required");
    }
    for (const k of ["regions", "seasons", "episodes", "states", "tracks", "languages"] as const) {
      if (!Array.isArray(t[k])) throw new ImportValidationError(`${t.title.providerId}: ${k} must be an array`);
      rows += t[k].length;
    }
    if (t.title.kind !== "SERIES" && t.title.kind !== "MOVIE") throw new ImportValidationError(`${t.title.providerId}: bad kind`);
  }
  if (rows > IMPORT_MAX_ROWS) throw new ImportValidationError(`too many rows (${rows} > ${IMPORT_MAX_ROWS})`);
  return b as ImportBatch;
}

export async function importBatch(batch: ImportBatch): Promise<{ titles: number; episodes: number; tracks: number }> {
  let episodes = 0;
  let tracks = 0;
  for (const t of batch.titles) {
    await prisma.$transaction(
      async (tx) => {
        const meta = {
          kind: t.title.kind,
          title: t.title.title,
          originalTitle: t.title.originalTitle,
          description: t.title.description,
          year: t.title.year,
          genres: (t.title.genres ?? undefined) as never,
          posterUrl: t.title.posterUrl,
          backdropUrl: t.title.backdropUrl,
          providerUrl: t.title.providerUrl,
          lastMetadataSyncAt: d(t.title.lastMetadataSyncAt),
        };
        // streamingTitleId/linkKind prod-un öz proyeksiyasınındır — update-də toxunulmur.
        const row = await tx.providerTitle.upsert({
          where: { platform_providerId: { platform: "HBOMAX", providerId: t.title.providerId } },
          create: { id: t.title.id, platform: "HBOMAX", providerId: t.title.providerId, ...meta },
          update: meta,
          select: { id: true },
        });
        const titleId = row.id;

        await tx.providerSeason.deleteMany({ where: { titleId } }); // cascade: epizod → state → trek
        await tx.providerEpisode.deleteMany({ where: { titleId } });
        await tx.providerTitleLanguage.deleteMany({ where: { titleId } });
        await tx.providerTitleRegion.deleteMany({ where: { titleId } });

        await tx.providerTitleRegion.createMany({
          data: t.regions.map((r) => ({
            id: r.id,
            titleId,
            region: r.region,
            firstSeenAt: req(r.firstSeenAt),
            lastSeenAt: req(r.lastSeenAt),
            isCurrentlyAvailable: r.isCurrentlyAvailable,
            consecutiveMissingSyncs: r.consecutiveMissingSyncs,
            missingSince: d(r.missingSince),
          })),
        });
        await tx.providerSeason.createMany({
          data: t.seasons.map((s) => ({ id: s.id, titleId, providerId: s.providerId, seasonNumber: s.seasonNumber, expectedEpisodes: s.expectedEpisodes })),
        });
        await tx.providerEpisode.createMany({
          data: t.episodes.map((e) => ({
            id: e.id,
            titleId,
            seasonId: e.seasonId,
            providerId: e.providerId,
            seasonNumber: e.seasonNumber,
            episodeNumber: e.episodeNumber,
            name: e.name,
            providerUrl: e.providerUrl,
            metadataEditId: e.metadataEditId,
            globalTracksHash: e.globalTracksHash,
            lastMetadataSyncAt: d(e.lastMetadataSyncAt),
            firstSeenAt: req(e.firstSeenAt),
            lastSeenAt: req(e.lastSeenAt),
            isCurrentlyListed: e.isCurrentlyListed,
          })),
        });
        await tx.episodeRegionState.createMany({
          data: t.states.map((s) => ({
            id: s.id,
            episodeId: s.episodeId,
            region: s.region,
            status: s.status,
            priority: s.priority,
            validatedEditId: s.validatedEditId,
            validatedGlobalHash: s.validatedGlobalHash,
            lastRegionValidationAt: d(s.lastRegionValidationAt),
            verifiedAt: d(s.verifiedAt),
            attempts: s.attempts,
          })),
        });
        if (t.tracks.length) {
          await tx.episodeTrack.createMany({
            data: t.tracks.map((k) => ({
              id: k.id,
              episodeId: k.episodeId,
              scope: "REGION",
              region: k.region,
              regionStateId: k.regionStateId,
              kind: k.kind,
              type: k.type,
              code: k.code,
              locale: k.locale,
              name: k.name,
              rawLabel: k.rawLabel,
              forced: k.forced,
              position: k.position,
              observedAt: req(k.observedAt),
            })),
          });
        }
        await tx.providerTitleLanguage.createMany({
          data: t.languages.map((l) => ({
            id: l.id,
            titleId,
            region: l.region,
            kind: l.kind,
            trackGroup: l.trackGroup,
            code: l.code,
            locale: l.locale,
            displayName: l.displayName,
            episodesAvailable: l.episodesAvailable,
            episodesVerified: l.episodesVerified,
            episodesTotal: l.episodesTotal,
            status: l.status,
            computedAt: req(l.computedAt),
          })),
        });
      },
      { timeout: 120_000, maxWait: 20_000 }
    );
    episodes += t.episodes.length;
    tracks += t.tracks.length;
  }
  return { titles: batch.titles.length, episodes, tracks };
}

// ── Proyeksiya (prod prosesində, fonda) ─────────────────────────────────────

interface ProjectionJobState {
  running: boolean;
  startedAt?: string;
  finishedAt?: string;
  summary?: unknown;
  error?: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __hboProjectionJob: ProjectionJobState | undefined;
}

export function projectionJob(): ProjectionJobState {
  return globalThis.__hboProjectionJob ?? { running: false };
}

/** Proyeksiyanı fonda başladır (`next start` uzunömürlü prosesdir). Gedirsə təkrar başlatmır. */
export function startProjection(region: string): ProjectionJobState {
  const cur = projectionJob();
  if (cur.running) return cur;
  const state: ProjectionJobState = { running: true, startedAt: new Date().toISOString() };
  globalThis.__hboProjectionJob = state;
  void (async () => {
    try {
      const { projectHboToStorefront } = await import("@/lib/scrapers/hbomaxCollector/projection/projectToStorefront");
      state.summary = await projectHboToStorefront({ region, appDb: true });
      try {
        const { revalidateStreaming } = await import("@/lib/revalidate");
        revalidateStreaming();
      } catch {
        /* sorğu kontekstindən kənar — kataloq onsuz da `revalidate = 600` ilə yenilənir */
      }
    } catch (err) {
      state.error = err instanceof Error ? err.message.slice(0, 500) : String(err);
    } finally {
      state.running = false;
      state.finishedAt = new Date().toISOString();
    }
  })();
  return state;
}

/** Prod admin səhifəsi üçün: Mac-dən gələn datanın xülasəsi. */
export async function prodImportStats(region: string) {
  const [byKind, verified, total, storefront, last] = await Promise.all([
    prisma.providerTitle.groupBy({ by: ["kind"], where: { platform: "HBOMAX", regions: { some: { region, isCurrentlyAvailable: true } } }, _count: true }),
    prisma.episodeRegionState.count({ where: { region, status: "VERIFIED" } }),
    prisma.episodeRegionState.count({ where: { region } }),
    prisma.contentAvailability.count({ where: { platform: "HBOMAX", country: region, isAvailable: true } }),
    prisma.providerTitle.findFirst({ where: { platform: "HBOMAX" }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
  ]);
  const count = (k: string) => byKind.find((r) => r.kind === k)?._count ?? 0;
  return {
    series: count("SERIES"),
    movies: count("MOVIE"),
    verified,
    total,
    storefront,
    lastImportAt: last?.updatedAt.toISOString() ?? null,
    projection: projectionJob(),
  };
}
