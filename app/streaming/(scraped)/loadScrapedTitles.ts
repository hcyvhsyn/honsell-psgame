import { prisma } from "@/lib/prisma";
import type { ScrapedCardData } from "@/components/ScrapedTitleCard";

/**
 * Bütün scrape-mənbəli StreamingTitle-ları (kind=MOVIE|SERIES) yığır və UI
 * kartı üçün denormalize edir. Yalnız ən az bir aktiv `ContentAvailability`-si
 * olan başlıqlar qaytarılır — manuel admin tərəfindən əlavə edilən, lakin heç
 * bir platformda scrape olunmayan title-lar bu siyahıya düşmür.
 *
 * Dil siyahısı bütün availability-lərdən birləşdirilir (deduped, sıralı tr/ru/en).
 */
export async function loadScrapedTitles(
  kind: "MOVIE" | "SERIES"
): Promise<ScrapedCardData[]> {
  const rows = await prisma.streamingTitle.findMany({
    where: {
      kind,
      isActive: true,
      azAvailable: true,
      availabilities: { some: { isAvailable: true } },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      kind: true,
      year: true,
      posterUrl: true,
      availabilities: {
        where: { isAvailable: true },
        select: {
          platform: true,
          deepLinkUrl: true,
          languages: { select: { code: true, kind: true } },
        },
      },
    },
    orderBy: [{ year: "desc" }, { title: "asc" }],
    take: 1000,
  });

  return rows.map((r) => {
    const audio = new Set<string>();
    const sub = new Set<string>();
    const platforms: ScrapedCardData["platforms"] = [];
    for (const av of r.availabilities) {
      if (!isKnownPlatform(av.platform)) continue;
      platforms.push({ platform: av.platform, deepLinkUrl: av.deepLinkUrl });
      for (const l of av.languages) {
        if (l.kind === "AUDIO") audio.add(l.code);
        else if (l.kind === "SUBTITLE") sub.add(l.code);
      }
    }
    return {
      id: r.id,
      slug: r.slug,
      title: r.title,
      kind: r.kind === "SERIES" ? "SERIES" : "MOVIE",
      year: r.year,
      posterUrl: r.posterUrl,
      platforms,
      audioLanguages: sortLangs([...audio]),
      subtitleLanguages: sortLangs([...sub]),
    };
  });
}

function isKnownPlatform(
  p: string
): p is "NETFLIX" | "HBOMAX" | "PRIME" | "GAIN" {
  return p === "NETFLIX" || p === "HBOMAX" || p === "PRIME" || p === "GAIN";
}

const LANG_ORDER = ["tr", "ru", "en"];
function sortLangs(arr: string[]): string[] {
  return arr.sort((a, b) => LANG_ORDER.indexOf(a) - LANG_ORDER.indexOf(b));
}
