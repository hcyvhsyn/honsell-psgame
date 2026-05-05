import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";
import { getAllGuides } from "@/lib/guides";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE_URL}/oyunlar`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/endirimler`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/ps-plus`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/hediyye-kartlari`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/hesab-acma`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/bilmeli-olduglarin`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
  ];

  const guides = getAllGuides();
  const guideEntries: MetadataRoute.Sitemap = guides.map((g) => ({
    url: `${SITE_URL}/bilmeli-olduglarin/${encodeURIComponent(g.slug)}`,
    lastModified: g.updatedAt ? new Date(g.updatedAt) : now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  let games: { productId: string; updatedAt: Date }[] = [];
  let collections: { slug: string; updatedAt: Date }[] = [];
  try {
    [games, collections] = await Promise.all([
      prisma.game.findMany({
        where: { isActive: true },
        select: { productId: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 5000,
      }),
      prisma.collection.findMany({
        where: { isActive: true },
        select: { slug: true, updatedAt: true },
      }),
    ]);
  } catch {
    // If DB is unreachable at build/edge, still serve the static portion.
  }

  const gameEntries: MetadataRoute.Sitemap = games.map((g) => ({
    url: `${SITE_URL}/oyunlar/${encodeURIComponent(g.productId)}`,
    lastModified: g.updatedAt,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const collectionEntries: MetadataRoute.Sitemap = collections.map((c) => ({
    url: `${SITE_URL}/kolleksiya/${encodeURIComponent(c.slug)}`,
    lastModified: c.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticEntries, ...guideEntries, ...collectionEntries, ...gameEntries];
}
