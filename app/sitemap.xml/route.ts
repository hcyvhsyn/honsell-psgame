/**
 * Sitemap indeksi — robots.txt-in göstərdiyi giriş nöqtəsi.
 *
 * Kataloq `GAMES_PER_SHARD` ölçüsündə hissələrə bölünür; əvvəlki tək fayllı
 * sitemap `take: 5000` ilə kəsilirdi və ondan sonrakı oyunlar Google-a heç vaxt
 * çatmırdı.
 */
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";
import { GAMES_PER_SHARD, SITEMAP_GAME_WHERE } from "@/lib/sitemapShards";
import { buildSitemapIndex, xmlResponse } from "@/lib/sitemapXml";

export const revalidate = 3600;

export async function GET() {
  const now = new Date();

  let gameCount = 0;
  try {
    gameCount = await prisma.game.count({ where: SITEMAP_GAME_WHERE });
  } catch {
    // DB əlçatmazdırsa indeks yenə də statik hissəni göstərsin.
  }

  const shardCount = Math.max(1, Math.ceil(gameCount / GAMES_PER_SHARD));

  const sitemaps = [
    { loc: `${SITE_URL}/sitemap-pages.xml`, lastModified: now },
    ...Array.from({ length: shardCount }, (_, i) => ({
      loc: `${SITE_URL}/sitemap-games/${i}.xml`,
      lastModified: now,
    })),
  ];

  return xmlResponse(buildSitemapIndex(sitemaps));
}
