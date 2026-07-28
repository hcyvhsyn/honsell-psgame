/**
 * Sitemap paylaşdırma parametrləri.
 *
 * Əvvəl bütün kataloq tək `/sitemap.xml`-də idi və `take: 5000` ilə kəsilirdi —
 * yəni 5000-ci oyundan sonrakı hər səhifə Google-a heç vaxt göndərilmirdi.
 * İndi kataloq shard-lara bölünür və `/sitemap.xml` sitemap indeksi kimi
 * onlara işarə edir.
 *
 * Protokol limiti 50 000 URL / 50 MB-dır; 5 000 daha kiçik fayl deməkdir və
 * Google Search Console-da "hansı hissə indekslənməyib" sualını cavablamağı
 * asanlaşdırır.
 */
export const GAMES_PER_SHARD = 5000;

/** Sitemap-a düşəcək oyunların filtri — tək mənbədən idarə olunsun deyə burada. */
export const SITEMAP_GAME_WHERE = {
  isActive: true,
  // Slug-suz sətir hələ backfill olunmayıb; productId URL-i 308 verir və
  // yönləndirilən URL sitemap-a qoyulmamalıdır.
  slug: { not: null },
} as const;
