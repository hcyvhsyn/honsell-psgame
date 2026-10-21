import { prisma } from "@/lib/prisma";
import { buildSearchText } from "@/lib/imdbDatasets";
import type { ScrapedCardData, ScrapedCardPlatform } from "@/components/ScrapedTitleCard";
import { loadHboCoverage, mergeLanguages } from "@/lib/hbomaxStorefront";

/**
 * Bütün scrape-mənbəli StreamingTitle-ları yığır və UI kartı üçün denormalize
 * edir. Yalnız ən az bir aktiv `ContentAvailability`-si olan başlıqlar
 * qaytarılır — manuel admin tərəfindən əlavə edilən, lakin heç bir platformda
 * scrape olunmayan title-lar bu siyahıya düşmür.
 *
 * `kind` ötürülməzsə həm film, həm serial qaytarılır (birləşik katalog üçün) —
 * hər kartda `kind` sahəsi olduğu üçün client tərəf daxildən filtrləyə bilir.
 *
 * Dil siyahısı bütün availability-lərdən birləşdirilir (deduped, sıralı tr/ru/en).
 *
 * Hər kart `searchText` daşıyır — türkcə/rusca/orijinal adları da içinə alan
 * kiçik hərfli sətir. Client filtri məhz onun üzərində işləyir ki, istifadəçi
 * "Yüzüklerin Efendisi" və ya "Властелин колец" yazanda da filmi tapsın
 * (kataloqdakı əsas ad ingiliscədir).
 */
export async function loadScrapedTitles(
  kind?: "MOVIE" | "SERIES"
): Promise<ScrapedCardData[]> {
  const rows = await prisma.streamingTitle.findMany({
    where: {
      ...(kind ? { kind } : {}),
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
      tmdbRating: true,
      tmdbVoteCount: true,
      tmdbPopularity: true,
      imdbRating: true,
      imdbVotes: true,
      names: { select: { name: true } },
      availabilities: {
        where: { isAvailable: true },
        select: {
          id: true,
          platform: true,
          deepLinkUrl: true,
          languages: { select: { code: true, kind: true } },
        },
      },
    },
    orderBy: [{ year: "desc" }, { title: "asc" }],
    // EU Prime kataloqu tək kind üçün ~3600 başlığa çatır — tam göstərmək üçün
    // limit yüksəkdir. Client tərəf onsuz da 60-lıq "daha çox göstər" ilə
    // səhifələyir, ona görə ilkin render yüngül qalır (yalnız RSC payload böyüyür).
    take: 8000,
  });
  const hboCoverage = await loadHboCoverage();

  return rows.map((r) => {
    const known = r.availabilities.filter(
      (av): av is typeof av & { platform: ScrapedCardPlatform["platform"] } => isKnownPlatform(av.platform)
    );
    const platforms: ScrapedCardData["platforms"] = known.map((av) => ({ platform: av.platform, deepLinkUrl: av.deepLinkUrl }));
    const langs = mergeLanguages(known, hboCoverage);
    return {
      id: r.id,
      slug: r.slug,
      title: r.title,
      kind: r.kind === "SERIES" ? "SERIES" : "MOVIE",
      year: r.year,
      posterUrl: r.posterUrl,
      platforms,
      audioLanguages: sortLangs(langs.audio),
      subtitleLanguages: sortLangs(langs.sub),
      languageCoverage: langs.coverage,
      rating: r.tmdbRating,
      voteCount: r.tmdbVoteCount,
      popularity: r.tmdbPopularity,
      imdbRating: r.imdbRating,
      imdbVotes: r.imdbVotes,
      searchText: buildSearchText(r.title, r.names),
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
