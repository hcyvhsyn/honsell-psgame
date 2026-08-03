import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Filtr panelinin seçim siyahıları — janrlar, PEGI reytinqləri, nəşriyyatçılar,
 * çıxış ili aralığı.
 *
 * NİYƏ DİNAMİK: bu dəyərlər PS Store detal səhifəsindən gəlir
 * (scripts/enrichGameMetadata.ts) və kataloq böyüdükcə dəyişir. Sərt kodlanmış
 * siyahı iki cür sınır: (a) enricher hələ işləməyibsə istifadəçiyə heç bir
 * nəticə verməyən filtrlər göstərilir, (b) yeni janr/nəşriyyatçı gələndə siyahı
 * köhnə qalır. Ona görə siyahı DB-dəki REAL dəyərlərdən qurulur və boş gələn
 * bölmə UI-da ümumiyyətlə render olunmur.
 *
 * Sayğaclarla birlikdə qaytarılır ki, istifadəçi "PEGI 18 (1 240)" görsün və
 * boş nəticəyə aparan seçim etməsin.
 */
export const dynamic = "force-dynamic";

/** Nəşriyyatçı siyahısı uzun quyruqludur — dropdown-da yalnız ən böyükləri. */
const PUBLISHER_LIMIT = 60;
/** Bir dəfə görünən janr/nəşriyyatçı filtr kimi dəyər qatmır. */
const MIN_COUNT = 3;

type FacetOption = { value: string; count: number };

async function loadFacets(store: string) {
  const [genreRows, ratingRows, publisherRows, yearRow] = await Promise.all([
    prisma.$queryRaw<Array<{ value: string; count: number }>>`
      SELECT unnest(g."genres") AS value, COUNT(*)::int AS count
      FROM "Game" g
      WHERE g."isActive" = true AND g."store" = ${store}
      GROUP BY 1
      HAVING COUNT(*) >= ${MIN_COUNT}
      ORDER BY 2 DESC
    `,
    prisma.$queryRaw<Array<{ value: string; count: number }>>`
      SELECT g."contentRating" AS value, COUNT(*)::int AS count
      FROM "Game" g
      WHERE g."isActive" = true AND g."store" = ${store}
        AND g."contentRating" IS NOT NULL
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    prisma.$queryRaw<Array<{ value: string; count: number }>>`
      SELECT g."publisherName" AS value, COUNT(*)::int AS count
      FROM "Game" g
      WHERE g."isActive" = true AND g."store" = ${store}
        AND g."publisherName" IS NOT NULL
      GROUP BY 1
      HAVING COUNT(*) >= ${MIN_COUNT}
      ORDER BY 2 DESC
      LIMIT ${PUBLISHER_LIMIT}
    `,
    prisma.$queryRaw<Array<{ min: number | null; max: number | null }>>`
      SELECT EXTRACT(YEAR FROM MIN(g."releaseDate"))::int AS min,
             EXTRACT(YEAR FROM MAX(g."releaseDate"))::int AS max
      FROM "Game" g
      WHERE g."isActive" = true AND g."store" = ${store}
        AND g."releaseDate" IS NOT NULL
    `,
  ]);

  const genres: FacetOption[] = genreRows.map((r) => ({
    value: r.value,
    count: Number(r.count),
  }));
  const contentRatings: FacetOption[] = ratingRows.map((r) => ({
    value: r.value,
    count: Number(r.count),
  }));
  const publishers: FacetOption[] = publisherRows.map((r) => ({
    value: r.value,
    count: Number(r.count),
  }));

  const yearMin = yearRow?.[0]?.min ?? null;
  const yearMax = yearRow?.[0]?.max ?? null;

  return {
    genres,
    contentRatings,
    publishers,
    // Gələcək çıxış tarixli oyunlar (ön-sifariş) üst həddi bir neçə il irəli
    // ata bilər — istifadəçiyə göstərilən aralığı cari ildən uzağa buraxmırıq.
    releaseYears:
      yearMin != null && yearMax != null
        ? { min: yearMin, max: Math.max(yearMin, yearMax) }
        : null,
  };
}

const getCachedFacets = (store: string) =>
  unstable_cache(() => loadFacets(store), ["game-filter-facets", store], {
    // Kataloq scrape-dən sonra `revalidateGames()` "games" tag-ını təmizləyir,
    // ona görə yeni janr/nəşriyyatçı növbəti sorğuda görünür.
    revalidate: 600,
    tags: ["games"],
  })();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const store = url.searchParams.get("store") === "EPIC" ? "EPIC" : "PS";

  try {
    const facets = await getCachedFacets(store);
    return NextResponse.json(facets, {
      headers: { "Cache-Control": "public, max-age=0, s-maxage=600" },
    });
  } catch (e) {
    // Filtr siyahıları kataloqun işləməsi üçün kritik deyil — sorğu sınsa
    // GameBrowser sadəcə əlavə filtrləri gizlədir, kataloq işləməyə davam edir.
    console.error("games/facets: failed", e);
    return NextResponse.json({
      genres: [],
      contentRatings: [],
      publishers: [],
      releaseYears: null,
    });
  }
}
