import * as cheerio from "cheerio";
import { SCRAPER_CONFIG } from "@/lib/scrapers/config";
import { fetchWithRetry } from "@/lib/scrapers/fetchWithRetry";
import { normalizeLanguageList } from "@/lib/scrapers/languageNormalize";
import type { Scraper, ScraperResult, ScrapedTitle } from "@/lib/scrapers/types";

/**
 * Gain.tv — birbaşa HTML scrape.
 *
 * Strategiya:
 *   1. /diziler və /filmler list səhifələrindən başlıq URL-lərini çıxar.
 *   2. Hər detay səhifəsini cheerio ilə parse edib dil/janr/il/ID al.
 *
 * Notlar:
 *   - gain.tv Next.js-də qurulub. Server-side rendered HTML-də list mövcuddur,
 *     amma list bəzən infinite-scroll JSON endpoint ilə doldurulur. Bu kod ilkin
 *     HTML-i hədəfləyir; əgər boş gəlirsə `extractSlugsFromHtml` adaptasiya
 *     olunmalıdır (məs. embedded `__NEXT_DATA__` JSON-undan oxuma).
 *   - Dil informasiyası adətən detay səhifəsində "Dublyaj:" / "Altyazı:"
 *     etiketləri ilə gəlir; tapılmazsa boş massiv ötürülür.
 *   - robots.txt və TOS-a hörmət üçün User-Agent-də əlaqə məlumatı verilir və
 *     rate-limit 1 req/s saxlanır.
 */

const GAIN_BASE = "https://gain.tv";
const LIST_PATHS = ["/diziler", "/filmler"];
const USER_AGENT =
  "Mozilla/5.0 (compatible; honsell-streaming-sync/1.0; +https://honsell.store/contact)";

function abs(url: string): string {
  if (url.startsWith("http")) return url;
  if (url.startsWith("/")) return `${GAIN_BASE}${url}`;
  return `${GAIN_BASE}/${url}`;
}

function slugFromUrl(url: string): string {
  const u = url.replace(GAIN_BASE, "").replace(/^\/+/, "").replace(/\/+$/, "");
  return u || url;
}

/** List səhifə HTML-indən detay URL-lərini çıxarır. Bir neçə selector dener
 *  ki, qabıq dəyişikliklərinə davamlı olsun. */
function extractSlugsFromHtml(html: string, kindHint: "MOVIE" | "SERIES"): string[] {
  const $ = cheerio.load(html);
  const urls = new Set<string>();

  // Yaygın pattern-lər: <a href="/dizi/..."> və ya <a href="/film/...">
  const prefix = kindHint === "SERIES" ? "/dizi/" : "/film/";
  $(`a[href^="${prefix}"]`).each((_, el) => {
    const href = $(el).attr("href");
    if (href) urls.add(abs(href));
  });

  // Fallback: bütün card linkləri
  if (urls.size === 0) {
    $('a[href*="/dizi/"], a[href*="/film/"]').each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      const wantsSeries = kindHint === "SERIES";
      if (wantsSeries && href.includes("/dizi/")) urls.add(abs(href));
      if (!wantsSeries && href.includes("/film/")) urls.add(abs(href));
    });
  }

  return [...urls];
}

/** Detay HTML-indən başlıq metadatasını çıxarır. */
function parseDetail(html: string, url: string, kind: "MOVIE" | "SERIES"): ScrapedTitle | null {
  const $ = cheerio.load(html);

  const title =
    $('h1').first().text().trim() ||
    $('meta[property="og:title"]').attr("content")?.trim() ||
    "";
  if (!title) return null;

  const description =
    $('meta[property="og:description"]').attr("content")?.trim() ||
    $('meta[name="description"]').attr("content")?.trim() ||
    undefined;

  const posterUrl = $('meta[property="og:image"]').attr("content")?.trim() || undefined;

  // İl — başlıq yanında və ya ayrıca etiketdə.
  let year: number | undefined;
  const yearText = $('*:contains("Yıl"), *:contains("İl")').first().text();
  const yearMatch = yearText.match(/\b(19|20)\d{2}\b/) ?? html.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) year = parseInt(yearMatch[0], 10);

  // Janrlar
  const genres: string[] = [];
  $('a[href*="/tur/"], a[href*="/kategori/"]').each((_, el) => {
    const t = $(el).text().trim();
    if (t) genres.push(t);
  });

  // Dil etiketləri — "Dublyaj: Türkçe, Rusça" / "Altyazı: İngilizce" pattern-i.
  const bodyText = $('main, body').text();
  const audioMatch = bodyText.match(/Dublaj[^\n:]*:\s*([^\n]+)/i);
  const subMatch = bodyText.match(/Altyaz[ıi][^\n:]*:\s*([^\n]+)/i);
  const audioLanguages = normalizeLanguageList(
    audioMatch ? audioMatch[1].split(/[,/]/).map((s) => s.trim()) : []
  );
  const subtitleLanguages = normalizeLanguageList(
    subMatch ? subMatch[1].split(/[,/]/).map((s) => s.trim()) : []
  );

  return {
    platformExternalId: slugFromUrl(url),
    deepLinkUrl: url,
    title,
    kind,
    year,
    genres: [...new Set(genres)],
    posterUrl,
    description,
    audioLanguages,
    subtitleLanguages,
  };
}

export const gainScraper: Scraper = {
  platform: "GAIN",
  async run(): Promise<ScraperResult> {
    const startedAt = Date.now();
    const warnings: string[] = [];
    const titlesById = new Map<string, ScrapedTitle>();
    let requestCount = 0;

    // 1) List səhifələrini paginate edib URL-ləri topla
    const slugUrls = new Set<string>();
    for (const path of LIST_PATHS) {
      const kindHint: "MOVIE" | "SERIES" = path.includes("dizi") ? "SERIES" : "MOVIE";
      for (let page = 1; page <= SCRAPER_CONFIG.maxPagesPerPlatform; page++) {
        const url = page === 1 ? `${GAIN_BASE}${path}` : `${GAIN_BASE}${path}?page=${page}`;
        try {
          const res = await fetchWithRetry(url, {
            headers: { "user-agent": USER_AGENT, accept: "text/html,*/*" },
            pacingMs: SCRAPER_CONFIG.rateLimitMs.GAIN,
          });
          requestCount++;
          const html = await res.text();
          const found = extractSlugsFromHtml(html, kindHint);
          if (found.length === 0) break;
          const before = slugUrls.size;
          for (const u of found) slugUrls.add(`${u}::${kindHint}`);
          // Yeni URL əlavə olunmadısa — pagination bitib.
          if (slugUrls.size === before) break;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          warnings.push(`gain.tv list ${url} failed: ${msg}`);
          if (page === 1 && slugUrls.size === 0) {
            return {
              platform: "GAIN",
              titles: [],
              warnings,
              fatalError: `gain.tv list səhifəsi əlçatan deyil: ${msg}`,
              stats: { requestCount, durationMs: Date.now() - startedAt },
            };
          }
          break;
        }
      }
    }

    // 2) Hər detay səhifəsini çək
    for (const entry of slugUrls) {
      const [url, kindHint] = entry.split("::") as [string, "MOVIE" | "SERIES"];
      try {
        const res = await fetchWithRetry(url, {
          headers: { "user-agent": USER_AGENT, accept: "text/html,*/*" },
          pacingMs: SCRAPER_CONFIG.rateLimitMs.GAIN,
        });
        requestCount++;
        const html = await res.text();
        const mapped = parseDetail(html, url, kindHint);
        if (mapped && !titlesById.has(mapped.platformExternalId)) {
          titlesById.set(mapped.platformExternalId, mapped);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        warnings.push(`gain.tv detail ${url} failed: ${msg}`);
      }
    }

    return {
      platform: "GAIN",
      titles: [...titlesById.values()],
      warnings,
      stats: { requestCount, durationMs: Date.now() - startedAt },
    };
  },
};
