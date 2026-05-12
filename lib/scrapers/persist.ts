import { prisma } from "@/lib/prisma";
import { SCRAPER_CONFIG, type Platform } from "@/lib/scrapers/config";
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

async function ensureUniqueSlug(base: string): Promise<string> {
  let slug = base || `title-${Date.now()}`;
  let i = 1;
  while (await prisma.streamingTitle.findUnique({ where: { slug } })) {
    i++;
    slug = `${base}-${i}`.slice(0, 80);
    if (i > 50) {
      slug = `${base}-${Date.now()}`.slice(0, 80);
      break;
    }
  }
  return slug;
}

/**
 * Canonical StreamingTitle tap və ya yarat.
 *
 * Match prioriteti:
 *   1. IMDb ID (`externalId`) — platform-lar arası yeganə etibarlı açar.
 *   2. (title, year) — IMDb yoxdursa best-effort.
 *
 * Heç biri uyğun gəlmirsə yeni title yaradılır.
 */
async function findOrCreateTitle(
  scraped: ScrapedTitle,
  platform: Platform
): Promise<{ id: string; created: boolean }> {
  if (scraped.imdbId) {
    const byImdb = await prisma.streamingTitle.findFirst({
      where: { externalId: scraped.imdbId },
      select: { id: true },
    });
    if (byImdb) return { id: byImdb.id, created: false };
  }

  if (scraped.year) {
    const byTitleYear = await prisma.streamingTitle.findFirst({
      where: { title: scraped.title, year: scraped.year },
      select: { id: true },
    });
    if (byTitleYear) return { id: byTitleYear.id, created: false };
  }

  const slug = await ensureUniqueSlug(slugify(scraped.title));
  const created = await prisma.streamingTitle.create({
    data: {
      slug,
      title: scraped.title,
      kind: scraped.kind,
      service: SERVICE_MAP[platform],
      posterUrl: scraped.posterUrl ?? null,
      year: scraped.year ?? null,
      genres: scraped.genres ?? [],
      description: scraped.description ?? null,
      externalId: scraped.imdbId ?? null,
      azAvailable: true,
      isActive: true,
    },
    select: { id: true },
  });
  return { id: created.id, created: true };
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

/**
 * Bir platform-un scrape nəticəsini DB ilə sinxronlaşdırır.
 *
 *  - Yeni başlıq → ContentAvailability yarat + ADDED change.
 *  - Mövcud + dəyişib → languages yenilə + UPDATED change.
 *  - Mövcud + dəyişməyib → unchanged++, lastSeenAt yenilə.
 *  - DB-də olub scrape-də olmayan → isAvailable=false + REMOVED change.
 */
export async function persistPlatformScrape(
  platform: Platform,
  scraped: ScrapedTitle[]
): Promise<PersistDiff> {
  const diff: PersistDiff = {
    added: 0,
    removed: 0,
    updated: 0,
    unchanged: 0,
    changes: [],
  };
  const country = SCRAPER_CONFIG.country;
  const now = new Date();

  const existing = await prisma.contentAvailability.findMany({
    where: { platform, country },
    include: { languages: true },
  });
  const existingByExt = new Map(existing.map((e) => [e.platformExternalId, e]));
  const scrapedIds = new Set(scraped.map((s) => s.platformExternalId));

  for (const item of scraped) {
    const prior = existingByExt.get(item.platformExternalId);
    if (!prior) {
      const { id: titleId } = await findOrCreateTitle(item, platform);
      const created = await prisma.contentAvailability.create({
        data: {
          titleId,
          platform,
          platformExternalId: item.platformExternalId,
          country,
          isAvailable: true,
          firstSeenAt: now,
          lastSeenAt: now,
          deepLinkUrl: item.deepLinkUrl ?? null,
          languages: {
            create: [
              ...item.audioLanguages.map((code) => ({ code, kind: "AUDIO" })),
              ...item.subtitleLanguages.map((code) => ({ code, kind: "SUBTITLE" })),
            ],
          },
        },
        select: { id: true, titleId: true },
      });
      diff.added++;
      diff.changes.push({
        changeType: "ADDED",
        titleId: created.titleId,
        payload: {
          platformExternalId: item.platformExternalId,
          title: item.title,
          audioLanguages: item.audioLanguages,
          subtitleLanguages: item.subtitleLanguages,
        },
      });
      continue;
    }

    const priorAudio = prior.languages.filter((l) => l.kind === "AUDIO").map((l) => l.code);
    const priorSub = prior.languages.filter((l) => l.kind === "SUBTITLE").map((l) => l.code);
    const audioChanged = !langsEqual(priorAudio, item.audioLanguages);
    const subChanged = !langsEqual(priorSub, item.subtitleLanguages);
    const cameBack = !prior.isAvailable;

    if (audioChanged || subChanged || cameBack) {
      await prisma.contentAvailability.update({
        where: { id: prior.id },
        data: {
          isAvailable: true,
          lastSeenAt: now,
          removedAt: null,
          deepLinkUrl: item.deepLinkUrl ?? prior.deepLinkUrl,
          languages: {
            deleteMany: {},
            create: [
              ...item.audioLanguages.map((code) => ({ code, kind: "AUDIO" })),
              ...item.subtitleLanguages.map((code) => ({ code, kind: "SUBTITLE" })),
            ],
          },
        },
      });
      diff.updated++;
      diff.changes.push({
        changeType: "UPDATED",
        titleId: prior.titleId,
        payload: {
          platformExternalId: item.platformExternalId,
          audio: { before: priorAudio, after: item.audioLanguages },
          subtitle: { before: priorSub, after: item.subtitleLanguages },
          cameBack,
        },
      });
    } else {
      await prisma.contentAvailability.update({
        where: { id: prior.id },
        data: { lastSeenAt: now },
      });
      diff.unchanged++;
    }
  }

  for (const prior of existing) {
    if (scrapedIds.has(prior.platformExternalId)) continue;
    if (!prior.isAvailable) continue;
    await prisma.contentAvailability.update({
      where: { id: prior.id },
      data: { isAvailable: false, removedAt: now },
    });
    diff.removed++;
    diff.changes.push({
      changeType: "REMOVED",
      titleId: prior.titleId,
      payload: { platformExternalId: prior.platformExternalId },
    });
  }

  return diff;
}
