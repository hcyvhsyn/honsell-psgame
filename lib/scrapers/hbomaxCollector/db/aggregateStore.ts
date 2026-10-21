/**
 * ProviderTitleLanguage yenidən hesablanması — `computeTitleLanguages` (saf) üzərində.
 * Hər validasiya edilmiş şoudan sonra və `hbomax:status -- --recompute` ilə çağırılır.
 */
import { prisma } from "@/lib/prisma";
import { computeTitleLanguages, type AggTrack } from "@/lib/scrapers/hbomaxCollector/aggregate/titleLanguages";
import type { LanguageTrackType } from "@/lib/scrapers/hbomaxCollector/models";
import { fingerprintMatches } from "@/lib/scrapers/hbomaxCollector/queue/rules";

type TrackRow = { scope: string; region: string | null; kind: string; type: string; code: string | null; locale: string | null; name: string; forced: boolean };

const toAgg = (t: TrackRow): AggTrack => ({
  kind: t.kind as AggTrack["kind"],
  type: t.type as LanguageTrackType,
  forced: t.forced,
  code: t.code ?? undefined,
  locale: t.locale ?? undefined,
  name: t.name,
});

export async function recomputeTitleLanguages(titleId: string, region: string) {
  const episodes = await prisma.providerEpisode.findMany({
    where: { titleId },
    select: {
      isCurrentlyListed: true,
      metadataEditId: true,
      globalTracksHash: true,
      tracks: { select: { scope: true, region: true, kind: true, type: true, code: true, locale: true, name: true, forced: true } },
      regionStates: { where: { region }, select: { verifiedAt: true, validatedEditId: true, validatedGlobalHash: true } },
    },
  });

  const { rows, skippedWithoutCode } = computeTitleLanguages(
    episodes.map((e) => {
      const st = e.regionStates[0];
      const verified = !!st?.verifiedAt && fingerprintMatches(st, { editId: e.metadataEditId, globalHash: e.globalTracksHash });
      return {
        isCurrentlyListed: e.isCurrentlyListed,
        verified,
        globalTracks: e.tracks.filter((t) => t.scope === "GLOBAL").map(toAgg),
        regionTracks: verified ? e.tracks.filter((t) => t.scope === "REGION" && t.region === region).map(toAgg) : [],
      };
    })
  );

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.providerTitleLanguage.deleteMany({ where: { titleId, region } });
    if (rows.length) await tx.providerTitleLanguage.createMany({ data: rows.map((r) => ({ ...r, titleId, region, computedAt: now })) });
  });
  return { rows: rows.length, skippedWithoutCode };
}
