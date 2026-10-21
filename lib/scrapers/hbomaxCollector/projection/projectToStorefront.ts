/**
 * Phase 3 — HBO Max AZ kataloqunun vitrinə proyeksiyası.
 *
 *   ProviderTitle (AZ-da görünən) → StreamingTitle (uyğunlaşdır və ya yarat)
 *                                 → ContentAvailability(platform=HBOMAX, country=AZ, platformExternalId=show.id)
 *                                 → ContentLanguage (YALNIZ FULL/PARTIAL, coverage + epizod sayları)
 *
 * Uyğunlaşdırma (dublikat olmasın — eyni serial Prime-da da ola bilər):
 *   1. artıq bağlıdırsa (`streamingTitleId`) — toxunulmur;
 *   2. TMDB → IMDb ID → `StreamingTitle.externalId`            → MATCHED_IMDB
 *   3. ad (normallaşdırılmış) + il + eyni kind (SERIES/MOVIE), TƏK namizəd → MATCHED_TITLE
 *   4. yoxdursa yeni StreamingTitle (service=HBO_MAX)          → CREATED
 * MATCHED_* başlıqların gözləyən validasiyaları P0-a qaldırılır.
 *
 * AZ-da görünməyən (isCurrentlyAvailable=false) başlığın availability-si `isAvailable=false`
 * olur — silinmir. Mövcud JustWatch/Prime sətirlərinə toxunulmur.
 *
 * ⚠️ HBOMAX platformasını yalnız bu proyeksiya idarə edir: JustWatch HBO scraper-i
 * orchestrator-dan çıxarılıb (persist.ts öz siyahısında olmayan HBOMAX sətirlərini
 * deaktiv edərdi).
 */
import { prisma } from "@/lib/prisma";
import { assertCollectorDbSelected } from "@/lib/scrapers/hbomaxCollector/errors";
import { hboLog } from "@/lib/scrapers/hbomaxCollector/log";
import { PLATFORM, isPriorityLink, type LinkKind } from "@/lib/scrapers/hbomaxCollector/db/catalogStore";
import { PRIORITY } from "@/lib/scrapers/hbomaxCollector/queue/rules";
import { imdbIdForTitle, normalizeTitle } from "@/lib/scrapers/hbomaxCollector/projection/imdbMatch";
import { STOREFRONT_SOURCE, toStorefrontLanguages } from "@/lib/scrapers/hbomaxCollector/projection/storefrontLanguages";

export interface ProjectionOptions {
  region: string;
  dryRun?: boolean;
  /** Yalnız bu ProviderTitle (id və ya HBO show id). */
  title?: string;
  /** TMDB sorğusu etmə (yalnız ad/il uyğunlaşması). */
  skipTmdb?: boolean;
}

export interface ProjectionSummary {
  titles: number;
  linked: Record<LinkKind | "ALREADY", number>;
  availabilityActive: number;
  availabilityRemoved: number;
  titlesWithLanguages: number;
  languageRows: number;
  priorityRaised: number;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || "hbo-title";
  for (let i = 1; i < 50; i++) {
    const slug = i === 1 ? root : `${root}-${i}`;
    if (!(await prisma.streamingTitle.findUnique({ where: { slug }, select: { id: true } }))) return slug;
  }
  return `${root}-${Date.now()}`;
}

type TitleRow = {
  id: string;
  kind: string;
  providerId: string;
  title: string;
  year: number | null;
  description: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  genres: unknown;
  streamingTitleId: string | null;
};

async function resolveStreamingTitle(t: TitleRow, opts: ProjectionOptions): Promise<{ id: string | null; kind: LinkKind }> {
  const kind = t.kind === "MOVIE" ? "MOVIE" : "SERIES";
  const imdb = opts.skipTmdb ? null : await imdbIdForTitle(kind, t.title, t.year).catch((err: unknown) => {
    hboLog.warn(`TMDB lookup failed for ${t.title}: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
    return null;
  });
  if (imdb) {
    const st = await prisma.streamingTitle.findFirst({ where: { externalId: imdb }, select: { id: true } });
    if (st) return { id: st.id, kind: "MATCHED_IMDB" };
  }
  if (t.year) {
    const candidates = await prisma.streamingTitle.findMany({
      where: { kind, year: t.year, title: { equals: t.title, mode: "insensitive" } },
      select: { id: true, title: true },
    });
    const exact = candidates.filter((c) => normalizeTitle(c.title) === normalizeTitle(t.title));
    if (exact.length === 1) return { id: exact[0].id, kind: "MATCHED_TITLE" };
  }
  if (opts.dryRun) return { id: null, kind: "CREATED" };
  const created = await prisma.streamingTitle.create({
    data: {
      slug: await uniqueSlug(`${t.title}${t.year ? `-${t.year}` : ""}`),
      title: t.title,
      kind,
      service: "HBO_MAX",
      year: t.year,
      description: t.description,
      posterUrl: t.posterUrl,
      backdropUrl: t.backdropUrl,
      genres: Array.isArray(t.genres) ? t.genres : undefined,
      externalId: imdb,
      azAvailable: true,
      isActive: true,
    },
    select: { id: true },
  });
  return { id: created.id, kind: "CREATED" };
}

export async function projectHboToStorefront(opts: ProjectionOptions): Promise<ProjectionSummary> {
  assertCollectorDbSelected();
  const { region } = opts;
  const summary: ProjectionSummary = {
    titles: 0,
    linked: { ALREADY: 0, MATCHED_IMDB: 0, MATCHED_TITLE: 0, CREATED: 0 },
    availabilityActive: 0,
    availabilityRemoved: 0,
    titlesWithLanguages: 0,
    languageRows: 0,
    priorityRaised: 0,
  };

  const titles = await prisma.providerTitle.findMany({
    where: {
      platform: PLATFORM,
      regions: { some: { region } },
      // Yalnız detalı çəkilmiş başlıqlar — kəşfin minimal sətri (poster/il yoxdur) vitrinə düşməsin.
      // Sync gedərkən proyeksiya təhlükəsiz təkrarlana bilər.
      lastMetadataSyncAt: { not: null },
      ...(opts.title ? { OR: [{ id: opts.title }, { providerId: opts.title }] } : {}),
    },
    select: {
      id: true,
      kind: true,
      providerId: true,
      title: true,
      year: true,
      description: true,
      posterUrl: true,
      backdropUrl: true,
      genres: true,
      providerUrl: true,
      streamingTitleId: true,
      linkKind: true,
      regions: { where: { region }, select: { isCurrentlyAvailable: true, firstSeenAt: true, lastSeenAt: true } },
      languages: { where: { region }, select: { kind: true, trackGroup: true, code: true, status: true, episodesAvailable: true, episodesTotal: true, computedAt: true } },
    },
    orderBy: { title: "asc" },
  });

  for (const t of titles) {
    summary.titles++;
    const presence = t.regions[0];
    const now = new Date();

    if (!presence?.isCurrentlyAvailable) {
      if (!opts.dryRun) {
        const r = await prisma.contentAvailability.updateMany({
          where: { platform: PLATFORM, platformExternalId: t.providerId, country: region, isAvailable: true },
          data: { isAvailable: false, removedAt: now },
        });
        summary.availabilityRemoved += r.count;
      }
      continue;
    }

    let streamingTitleId = t.streamingTitleId;
    let linkKind = t.linkKind as LinkKind | null;
    if (streamingTitleId) {
      summary.linked.ALREADY++;
    } else {
      const res = await resolveStreamingTitle(t, opts);
      summary.linked[res.kind]++;
      if (!res.id) {
        summary.availabilityActive++; // dry-run: yaradılacaq başlıq da aktiv availability alacaq
        continue;
      }
      streamingTitleId = res.id;
      linkKind = res.kind;
      await prisma.providerTitle.update({ where: { id: t.id }, data: { streamingTitleId, linkKind } });
      if (isPriorityLink(linkKind)) {
        const raised = await prisma.episodeRegionState.updateMany({
          where: { region, priority: { gt: PRIORITY.LINKED }, status: { in: ["PENDING", "STALE", "FAILED"] }, episode: { titleId: t.id } },
          data: { priority: PRIORITY.LINKED },
        });
        summary.priorityRaised += raised.count;
      }
    }

    const languages = toStorefrontLanguages(t.languages);
    if (opts.dryRun) {
      summary.availabilityActive++;
      if (languages.length) summary.titlesWithLanguages++;
      summary.languageRows += languages.length;
      continue;
    }

    const verifiedAt = t.languages.reduce<Date | null>((max, l) => (!max || l.computedAt > max ? l.computedAt : max), null);
    await prisma.$transaction(async (tx) => {
      const av = await tx.contentAvailability.upsert({
        where: { platform_platformExternalId_country: { platform: PLATFORM, platformExternalId: t.providerId, country: region } },
        create: {
          titleId: streamingTitleId!,
          platform: PLATFORM,
          platformExternalId: t.providerId,
          country: region,
          isAvailable: true,
          firstSeenAt: presence.firstSeenAt,
          lastSeenAt: presence.lastSeenAt,
          deepLinkUrl: t.providerUrl,
        },
        update: { titleId: streamingTitleId!, isAvailable: true, removedAt: null, lastSeenAt: presence.lastSeenAt, deepLinkUrl: t.providerUrl },
        select: { id: true },
      });
      await tx.contentLanguage.deleteMany({ where: { availabilityId: av.id } });
      if (languages.length) {
        await tx.contentLanguage.createMany({
          data: languages.map((l) => ({ availabilityId: av.id, ...l, source: STOREFRONT_SOURCE, verifiedAt })),
        });
      }
    });
    summary.availabilityActive++;
    if (languages.length) summary.titlesWithLanguages++;
    summary.languageRows += languages.length;
  }
  return summary;
}
