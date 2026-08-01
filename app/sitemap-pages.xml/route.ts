/**
 * Statik səhifələr + bələdçilər + kolleksiyalar sitemap-ı.
 * Oyun kataloqu ayrıca shard-lardadır (app/sitemap-games/[shard]).
 */
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";
import { getAllGuides } from "@/lib/guides";
import { buildUrlSet, xmlResponse, type UrlEntry } from "@/lib/sitemapXml";
import { ALL_FACETS, FACET_MIN_PRODUCTS_FOR_INDEX } from "@/lib/gameFacets";
import { getFacetCounts } from "@/lib/facetCatalog";
import { getSettings } from "@/lib/pricing";

export const revalidate = 3600;

export async function GET() {
  const now = new Date();

  const staticEntries: UrlEntry[] = [
    { loc: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { loc: `${SITE_URL}/oyunlar`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { loc: `${SITE_URL}/endirimler`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { loc: `${SITE_URL}/ps-plus`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { loc: `${SITE_URL}/ea-play`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { loc: `${SITE_URL}/hediyye-kartlari`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { loc: `${SITE_URL}/hediyye-kartlari/honsell`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { loc: `${SITE_URL}/hesab-acma`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { loc: `${SITE_URL}/music`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { loc: `${SITE_URL}/ai`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { loc: `${SITE_URL}/work`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { loc: `${SITE_URL}/bilmeli-olduglarin`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { loc: `${SITE_URL}/haqqimizda`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { loc: `${SITE_URL}/mexfilik-siyaseti`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { loc: `${SITE_URL}/geri-qaytarma-siyaseti`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  const guideEntries: UrlEntry[] = getAllGuides().map((g) => ({
    loc: `${SITE_URL}/bilmeli-olduglarin/${encodeURIComponent(g.slug)}`,
    lastModified: g.updatedAt ? new Date(g.updatedAt) : now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  // Facet landing səhifələri. Məhsul sayı həddən aşağı olanlar `noindex`
  // alır (bax: components/FacetLandingPage.tsx) — onları sitemap-a qoymaq
  // Google-a ziddiyyətli siqnal verər, ona görə süzülür.
  let facetEntries: UrlEntry[] = [];
  try {
    const settings = await getSettings();
    // Yalnız sayğac — sitemap üçün sətirləri çəkməyə ehtiyac yoxdur.
    const counts = await getFacetCounts(ALL_FACETS, settings);
    facetEntries = ALL_FACETS
      .filter((f) => (counts[f.path] ?? 0) >= FACET_MIN_PRODUCTS_FOR_INDEX)
      .map((facet) => ({
        loc: `${SITE_URL}/${facet.path}`,
        lastModified: now,
        changeFrequency: "daily" as const,
        priority: facet.priority,
      }));
  } catch {
    // DB əlçatmazdırsa facet-lər buraxılır, qalan sitemap yenə göndərilir.
  }

  let collectionEntries: UrlEntry[] = [];
  try {
    const collections = await prisma.collection.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
    });
    collectionEntries = collections.map((c) => ({
      loc: `${SITE_URL}/kolleksiya/${encodeURIComponent(c.slug)}`,
      lastModified: c.updatedAt,
      changeFrequency: "weekly",
      priority: 0.7,
    }));
  } catch {
    // DB əlçatmazdırsa statik hissə yenə göndərilsin.
  }

  return xmlResponse(
    buildUrlSet([
      ...staticEntries,
      ...facetEntries,
      ...guideEntries,
      ...collectionEntries,
    ])
  );
}
