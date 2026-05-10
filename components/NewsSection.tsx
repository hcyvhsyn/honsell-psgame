import { prisma } from "@/lib/prisma";
import NewsSectionClient, { type NewsCardData } from "./NewsSectionClient";

/**
 * Verilmiş scope üçün yayımda olan xəbərləri gətirir və cinematic kart
 * şəbəkəsi olaraq render edir. `isFeatured` true olanlar böyük "hero" kart
 * formasında göstərilir, qalanları responsive grid-də.
 *
 * Yayımlanma tarixinə görə (yeni → köhnə) sıralanır; admin paneldən
 * `sortOrder` ilə manual müdaxilə də mümkündür.
 */
export default async function NewsSection({
  scope,
  title,
  subtitle,
  limit = 6,
}: {
  /// Konkret scope (məs. "PLAYSTATION") və ya "HOME" — HOME olanda admin
  /// paneldən manual seçilmiş `showOnHome=true` xəbərlər çəkilir.
  scope: string;
  title?: string;
  subtitle?: string;
  limit?: number;
}) {
  const where =
    scope === "HOME"
      ? { showOnHome: true, isPublished: true }
      : { scope, isPublished: true };

  const items = await prisma.newsArticle.findMany({
    where,
    orderBy: [
      { isFeatured: "desc" },
      { sortOrder: "asc" },
      { publishedAt: "desc" },
      { createdAt: "desc" },
    ],
    take: limit,
  });

  if (items.length === 0) return null;

  const data: NewsCardData[] = items.map((it) => ({
    id: it.id,
    slug: it.slug,
    title: it.title,
    excerpt: it.excerpt,
    body: it.body,
    coverImageUrl: it.coverImageUrl,
    category: it.category,
    isFeatured: it.isFeatured,
    publishedAt: (it.publishedAt ?? it.createdAt).toISOString(),
  }));

  return <NewsSectionClient items={data} title={title} subtitle={subtitle} />;
}
