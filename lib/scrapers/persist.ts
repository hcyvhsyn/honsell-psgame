import { prisma } from "@/lib/prisma";
import { type Platform } from "@/lib/scrapers/config";
import type { ScrapedTitle } from "@/lib/scrapers/types";

/**
 * Platform → mövcud `StreamingTitle.service` enum-una map.
 * `service` alanı admin UI tərəfindən hələ də canonical "birincil platform"
 * kimi istifadə olunur — buna görə scrape edərkən düzgün dəyəri yazırıq.
 *
 * Diqqət: "PRIME" hazırda `STREAMING_SERVICES`-də yoxdur — bu ilk Prime
 * scrape-də yeni title yaradılarkən admin UI-da görünməyəcək, lakin DB-də
 * mövcud olacaq. Admin UI-nu Prime ilə tamamlamaq ayrı task-dır.
 */
const SERVICE_MAP: Record<Platform, string> = {
  NETFLIX: "NETFLIX",
  HBOMAX: "HBO_MAX",
  PRIME: "PRIME",
  GAIN: "GAIN",
};

export interface PersistDiff {
  added: number;
  removed: number;
  updated: number;
  unchanged: number;
  changes: Array<{
    changeType: "ADDED" | "REMOVED" | "UPDATED";
    titleId: string | null;
    payload: Record<string, unknown>;
  }>;
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

function sortedLangs(arr: readonly string[]): string[] {
  return [...arr].sort();
}

function langsEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = sortedLangs(a);
  const sb = sortedLangs(b);
  for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return false;
  return true;
}

/** Verilmiş işləri `size` ölçülü paketlərlə paralel icra edir — remote DB
 *  latency-sini gizlədir, lakin connection pool-u boğmamaq üçün məhdud. */
async function runChunked<T>(
  items: T[],
  size: number,
  fn: (t: T) => Promise<unknown>
): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

function langRows(item: ScrapedTitle, availabilityId: string) {
  return [
    ...item.audioLanguages.map((code) => ({ availabilityId, code, kind: "AUDIO" })),
    ...item.subtitleLanguages.map((code) => ({ availabilityId, code, kind: "SUBTITLE" })),
  ];
}

/** Preload-dan gələn title-ın media/reytinq sahələri. */
type TitleMediaRow = {
  posterUrl: string | null;
  backdropUrl: string | null;
  description: string | null;
  tmdbRating: number | null;
  tmdbVoteCount: number | null;
  tmdbPopularity: number | null;
};

/**
 * Mövcud title üçün yenilənəcək sahələri hesablayır:
 *  - poster/backdrop/description: yalnız null olduqda doldurulur (admin
 *    manual dəyişikliyini üstələmir).
 *  - reytinq/səs/populyarlıq: dəyər dəyişibsə təzələnir (vaxtla dəyişən metrik).
 * Heç nə dəyişmirsə boş obyekt qaytarır.
 */
function computeTitleBackfill(t: TitleMediaRow, item: ScrapedTitle): Record<string, string | number> {
  const data: Record<string, string | number> = {};
  if (!t.posterUrl && item.posterUrl) data.posterUrl = item.posterUrl;
  if (!t.backdropUrl && item.backdropUrl) data.backdropUrl = item.backdropUrl;
  if (!t.description && item.description) data.description = item.description;
  if (item.rating != null && item.rating !== t.tmdbRating) data.tmdbRating = item.rating;
  if (item.voteCount != null && item.voteCount !== t.tmdbVoteCount) data.tmdbVoteCount = item.voteCount;
  if (item.popularity != null && item.popularity !== t.tmdbPopularity) data.tmdbPopularity = item.popularity;
  return data;
}

/**
 * Bir platform-un scrape nəticəsini DB ilə sinxronlaşdırır — BULK rejimdə.
 *
 * Performans: hər başlıq üçün ayrıca sorğu yerinə ölkə başına bir neçə toplu
 * sorğu (preload + `createManyAndReturn` + `createMany` + `updateMany`). Remote
 * Supabase latency-si min başlıqda saatları dəqiqələrə endirir.
 *
 *  - Yeni başlıq → StreamingTitle (lazımsa) + ContentAvailability + dillər (ADDED).
 *  - Mövcud + dil dəyişib/qayıdıb → availability + dillər yenilənir (UPDATED).
 *  - Mövcud + dəyişməyib → tək `updateMany` ilə lastSeenAt (unchanged).
 *  - DB-də olub scrape-də olmayan → isAvailable=false (REMOVED).
 *
 * Canonical title match: IMDb ID (`externalId`) üzrə. IMDb-siz başlıqlar
 * (~%1-2) hər dəfə yeni title yaradır — köhnə (title, year) fallback-ı bulk
 * rejimdə per-row sorğu tələb etdiyi üçün atılıb.
 */
export async function persistPlatformScrape(
  platform: Platform,
  country: string,
  scraped: ScrapedTitle[]
): Promise<PersistDiff> {
  const diff: PersistDiff = { added: 0, removed: 0, updated: 0, unchanged: 0, changes: [] };
  const now = new Date();
  const service = SERVICE_MAP[platform];

  // ── 1. Bu (platform, country) üçün mövcud availability-ləri yüklə ──────────
  const existing = await prisma.contentAvailability.findMany({
    where: { platform, country },
    include: { languages: true },
  });
  const existingByExt = new Map(existing.map((e) => [e.platformExternalId, e]));
  const scrapedIds = new Set(scraped.map((s) => s.platformExternalId));

  // ── 2. Scrape-dəki bütün IMDb ID-lər üçün mövcud canonical title-ları yüklə ─
  const imdbIds = [...new Set(scraped.map((s) => s.imdbId).filter((x): x is string => !!x))];
  const existingTitles = imdbIds.length
    ? await prisma.streamingTitle.findMany({
        where: { externalId: { in: imdbIds } },
        select: {
          id: true,
          externalId: true,
          posterUrl: true,
          backdropUrl: true,
          description: true,
          tmdbRating: true,
          tmdbVoteCount: true,
          tmdbPopularity: true,
        },
      })
    : [];
  const titleByImdb = new Map(existingTitles.map((t) => [t.externalId as string, t]));

  // ── 3. Slug unikallığı üçün mövcud slug-ları yaddaşa yüklə ─────────────────
  const slugRows = await prisma.streamingTitle.findMany({ select: { slug: true } });
  const usedSlugs = new Set(slugRows.map((r) => r.slug));
  function uniqueSlug(base: string, fallbackKey: string): string {
    let slug = base || `title-${fallbackKey}`.slice(0, 80);
    let i = 1;
    while (usedSlugs.has(slug)) {
      i++;
      slug = `${base}-${i}`.slice(0, 80);
    }
    usedSlugs.add(slug);
    return slug;
  }

  // ── 4. Yeni availability (prior yoxdur) vs mövcud olanları ayır ────────────
  const toCreate = scraped.filter((s) => !existingByExt.has(s.platformExternalId));
  const toExisting = scraped.filter((s) => existingByExt.has(s.platformExternalId));

  // ── 5. toCreate üçün titleId həll et: mövcud IMDb → reuse, yoxsa yeni title ─
  // resolution key: "existing:<id>" | "new:<imdb|noimdb:extId>"
  const itemKey = new Map<string, string>();
  const newTitles: Array<{ scraped: ScrapedTitle; slug: string; tempKey: string }> = [];
  const newKeySeen = new Set<string>();
  const backfillTargets: Array<{ id: string; data: Record<string, string | number> }> = [];
  const backfilledIds = new Set<string>(); // eyni title-ı iki dəfə update etməmək üçün

  for (const item of toCreate) {
    if (item.imdbId && titleByImdb.has(item.imdbId)) {
      const t = titleByImdb.get(item.imdbId)!;
      itemKey.set(item.platformExternalId, `existing:${t.id}`);
      const data = computeTitleBackfill(t, item);
      if (Object.keys(data).length > 0) {
        backfilledIds.add(t.id);
        backfillTargets.push({ id: t.id, data });
      }
      continue;
    }
    const tempKey = item.imdbId ?? `noimdb:${item.platformExternalId}`;
    if (!newKeySeen.has(tempKey)) {
      newKeySeen.add(tempKey);
      newTitles.push({ scraped: item, slug: uniqueSlug(slugify(item.title), tempKey), tempKey });
    }
    itemKey.set(item.platformExternalId, `new:${tempKey}`);
  }

  // ── 6. Yeni title-ları toplu yarat (slug üzrə id-yə map) ───────────────────
  const keyToTitleId = new Map<string, string>();
  if (newTitles.length > 0) {
    const created = await prisma.streamingTitle.createManyAndReturn({
      data: newTitles.map((n) => ({
        slug: n.slug,
        title: n.scraped.title,
        kind: n.scraped.kind,
        service,
        posterUrl: n.scraped.posterUrl ?? null,
        backdropUrl: n.scraped.backdropUrl ?? null,
        year: n.scraped.year ?? null,
        genres: n.scraped.genres ?? [],
        description: n.scraped.description ?? null,
        externalId: n.scraped.imdbId ?? null,
        tmdbRating: n.scraped.rating ?? null,
        tmdbVoteCount: n.scraped.voteCount ?? null,
        tmdbPopularity: n.scraped.popularity ?? null,
        azAvailable: true,
        isActive: true,
      })),
      select: { id: true, slug: true },
    });
    const slugToId = new Map(created.map((c) => [c.slug, c.id]));
    for (const n of newTitles) {
      const id = slugToId.get(n.slug);
      if (id) keyToTitleId.set(n.tempKey, id);
    }
  }

  function resolveTitleId(item: ScrapedTitle): string | null {
    const key = itemKey.get(item.platformExternalId);
    if (!key) return null;
    if (key.startsWith("existing:")) return key.slice("existing:".length);
    if (key.startsWith("new:")) return keyToTitleId.get(key.slice("new:".length)) ?? null;
    return null;
  }

  // ── 7. Availability-ləri toplu yarat, sonra dilləri toplu yarat ────────────
  const availInput = toCreate
    .map((item) => ({ item, titleId: resolveTitleId(item) }))
    .filter((x): x is { item: ScrapedTitle; titleId: string } => !!x.titleId);

  if (availInput.length > 0) {
    const createdAvail = await prisma.contentAvailability.createManyAndReturn({
      data: availInput.map(({ item, titleId }) => ({
        titleId,
        platform,
        platformExternalId: item.platformExternalId,
        country,
        isAvailable: true,
        firstSeenAt: now,
        lastSeenAt: now,
        deepLinkUrl: item.deepLinkUrl ?? null,
      })),
      select: { id: true, platformExternalId: true, titleId: true },
    });

    const availByExt = new Map(createdAvail.map((a) => [a.platformExternalId, a]));
    const langData = availInput.flatMap(({ item }) => {
      const a = availByExt.get(item.platformExternalId);
      return a ? langRows(item, a.id) : [];
    });
    if (langData.length > 0) {
      await prisma.contentLanguage.createMany({ data: langData, skipDuplicates: true });
    }

    diff.added = createdAvail.length;
    for (const a of createdAvail) {
      diff.changes.push({
        changeType: "ADDED",
        titleId: a.titleId,
        payload: { platformExternalId: a.platformExternalId },
      });
    }
  }

  // ── 9. Mövcud availability-lər: dəyişən vs dəyişməyən + title backfill ─────
  const unchangedIds: string[] = [];
  const changedItems: Array<{ item: ScrapedTitle; priorId: string; priorDeep: string | null }> = [];
  for (const item of toExisting) {
    const prior = existingByExt.get(item.platformExternalId)!;

    // Mövcud availability-li başlığın da title media/reytinqini backfill et
    // (ilk dəfə reytinq sütunları boş yaranmış ola bilər).
    if (item.imdbId) {
      const t = titleByImdb.get(item.imdbId);
      if (t && !backfilledIds.has(t.id)) {
        const data = computeTitleBackfill(t, item);
        if (Object.keys(data).length > 0) {
          backfilledIds.add(t.id);
          backfillTargets.push({ id: t.id, data });
        }
      }
    }

    const priorAudio = prior.languages.filter((l) => l.kind === "AUDIO").map((l) => l.code);
    const priorSub = prior.languages.filter((l) => l.kind === "SUBTITLE").map((l) => l.code);
    const changed =
      !langsEqual(priorAudio, item.audioLanguages) ||
      !langsEqual(priorSub, item.subtitleLanguages) ||
      !prior.isAvailable;
    if (changed) {
      changedItems.push({ item, priorId: prior.id, priorDeep: prior.deepLinkUrl });
      diff.changes.push({
        changeType: "UPDATED",
        titleId: prior.titleId,
        payload: { platformExternalId: item.platformExternalId },
      });
    } else {
      unchangedIds.push(prior.id);
    }
  }
  diff.updated = changedItems.length;
  diff.unchanged = unchangedIds.length;

  // ── 8. Title media/reytinq backfill-lərini toplu tətbiq et (həm yeni, həm
  //       mövcud availability-li başlıqlar üçün toplanıb) ────────────────────
  await runChunked(backfillTargets, 25, (t) =>
    prisma.streamingTitle.update({ where: { id: t.id }, data: t.data })
  );

  // Dəyişməyənlər → tək updateMany ilə lastSeenAt.
  if (unchangedIds.length > 0) {
    await prisma.contentAvailability.updateMany({
      where: { id: { in: unchangedIds } },
      data: { lastSeenAt: now },
    });
  }

  // Dəyişənlər → availability + dilləri yenilə (paralel paketlərlə).
  await runChunked(changedItems, 20, async ({ item, priorId, priorDeep }) => {
    await prisma.contentAvailability.update({
      where: { id: priorId },
      data: {
        isAvailable: true,
        lastSeenAt: now,
        removedAt: null,
        deepLinkUrl: item.deepLinkUrl ?? priorDeep,
        languages: {
          deleteMany: {},
          create: [
            ...item.audioLanguages.map((code) => ({ code, kind: "AUDIO" })),
            ...item.subtitleLanguages.map((code) => ({ code, kind: "SUBTITLE" })),
          ],
        },
      },
    });
  });

  // ── 10. DB-də olub scrape-də olmayan → isAvailable=false (toplu) ───────────
  const removedRows = existing.filter(
    (p) => p.isAvailable && !scrapedIds.has(p.platformExternalId)
  );
  if (removedRows.length > 0) {
    await prisma.contentAvailability.updateMany({
      where: { id: { in: removedRows.map((r) => r.id) } },
      data: { isAvailable: false, removedAt: now },
    });
    diff.removed = removedRows.length;
    for (const r of removedRows) {
      diff.changes.push({
        changeType: "REMOVED",
        titleId: r.titleId,
        payload: { platformExternalId: r.platformExternalId },
      });
    }
  }

  return diff;
}
