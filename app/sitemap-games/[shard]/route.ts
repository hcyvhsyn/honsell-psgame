/**
 * Oyun kataloqunun bir shard-ı — `/sitemap-games/0.xml`, `/sitemap-games/1.xml` …
 *
 * Yalnız slug-u olan aktiv oyunlar daxil edilir: slug-suz sətir productId
 * URL-ində 308 verir və yönləndirilən URL sitemap-a qoyulmamalıdır.
 *
 * Hər sətir `<image:image>` ilə kaper şəklini də daşıyır — oyun kaperləri
 * Google Images-dən ayrıca trafik gətirir və bu, mövcud datadan pulsuz gəlir.
 */
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";
import { GAMES_PER_SHARD, SITEMAP_GAME_WHERE } from "@/lib/sitemapShards";
import { buildUrlSet, xmlResponse, type UrlEntry } from "@/lib/sitemapXml";

export const revalidate = 3600;

export async function GET(
  _req: Request,
  { params }: { params: { shard: string } }
) {
  // Route seqmenti "0.xml" formasındadır.
  const index = Number(params.shard.replace(/\.xml$/, ""));
  if (!Number.isInteger(index) || index < 0) {
    return new Response("Not found", { status: 404 });
  }

  let games: {
    slug: string | null;
    updatedAt: Date;
    imageUrl: string | null;
    title: string;
  }[] = [];
  try {
    games = await prisma.game.findMany({
      where: SITEMAP_GAME_WHERE,
      select: { slug: true, updatedAt: true, imageUrl: true, title: true },
      // Sabit sıralama vacibdir: shard sərhədləri hər sorğuda eyni qalmalıdır,
      // yoxsa oyunlar shard-lar arasında sürüşür və Google eyni URL-i dəfələrlə
      // fərqli fayllarda görür.
      orderBy: { id: "asc" },
      skip: index * GAMES_PER_SHARD,
      take: GAMES_PER_SHARD,
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }

  if (games.length === 0) {
    return new Response("Not found", { status: 404 });
  }

  const entries: UrlEntry[] = games.map((g) => ({
    loc: `${SITE_URL}/oyunlar/${g.slug}`,
    lastModified: g.updatedAt,
    changeFrequency: "weekly",
    priority: 0.6,
    images: g.imageUrl ? [{ loc: g.imageUrl, title: g.title }] : undefined,
  }));

  return xmlResponse(buildUrlSet(entries));
}
