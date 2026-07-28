/**
 * Sitemap XML qurma köməkçiləri.
 *
 * `MetadataRoute.Sitemap` (app/sitemap.ts) əvəzinə əl ilə XML yazırıq, çünki
 * lazımdır: (a) sitemap indeksi + shard-lar, (b) `<image:image>` uzantısı —
 * oyun kaperlərini Google Images-ə vermək üçün. Next-in built-in sitemap
 * generatoru nə birini, nə də digərini vermir.
 */

/** XML-də mətn/URL üçün təhlükəsizləşdirmə. Ampersand mütləq escape olunmalıdır. */
export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export type UrlEntry = {
  loc: string;
  lastModified?: Date | null;
  changeFrequency?:
    | "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
  /** Şəkil uzantısı — Google Images indeksləməsi üçün. */
  images?: { loc: string; title?: string }[];
};

function isoDate(d: Date): string {
  return d.toISOString();
}

export function buildUrlSet(entries: UrlEntry[]): string {
  const hasImages = entries.some((e) => e.images && e.images.length > 0);
  const body = entries
    .map((e) => {
      const parts = [`    <loc>${xmlEscape(e.loc)}</loc>`];
      if (e.lastModified) parts.push(`    <lastmod>${isoDate(e.lastModified)}</lastmod>`);
      if (e.changeFrequency) parts.push(`    <changefreq>${e.changeFrequency}</changefreq>`);
      if (e.priority != null) parts.push(`    <priority>${e.priority.toFixed(1)}</priority>`);
      for (const img of e.images ?? []) {
        parts.push(
          `    <image:image><image:loc>${xmlEscape(img.loc)}</image:loc>` +
            (img.title ? `<image:title>${xmlEscape(img.title)}</image:title>` : "") +
            `</image:image>`
        );
      }
      return `  <url>\n${parts.join("\n")}\n  </url>`;
    })
    .join("\n");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"` +
    (hasImages ? ` xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"` : "") +
    `>\n${body}\n</urlset>\n`
  );
}

export function buildSitemapIndex(
  sitemaps: { loc: string; lastModified?: Date | null }[]
): string {
  const body = sitemaps
    .map((s) => {
      const parts = [`    <loc>${xmlEscape(s.loc)}</loc>`];
      if (s.lastModified) parts.push(`    <lastmod>${isoDate(s.lastModified)}</lastmod>`);
      return `  <sitemap>\n${parts.join("\n")}\n  </sitemap>`;
    })
    .join("\n");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${body}\n</sitemapindex>\n`
  );
}

/** Bütün sitemap route-ları eyni başlıqlarla cavab verir. */
export function xmlResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Sitemap saatda bir yenilənir; CDN-də də eyni müddət saxlanılır.
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
