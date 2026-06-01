import { SCRAPER_CONFIG, getRapidApiKey } from "@/lib/scrapers/config";
import { fetchWithRetry } from "@/lib/scrapers/fetchWithRetry";
import { normalizeLanguageList } from "@/lib/scrapers/languageNormalize";
import type { Scraper, ScraperResult, ScrapedTitle } from "@/lib/scrapers/types";

/**
 * uNoGS (https://rapidapi.com/unogs/api/unogs) — RapidAPI üzərindən
 * Netflix kataloqu.
 *
 * Müasir v3 endpoint-i: `GET /search/titles?country_list=AZ&order_by=date&limit=100&offset=...`
 * (ISO iki-hərfli ölkə kodu). Köhnə v1 endpoint-i (`/aaapi.cgi`) hələ də
 * mövcud ola bilər amma yeni RapidAPI plan-larında v3-ə yönləndirilib.
 *
 * Cavab forması (kanonik):
 *   { results: [ { netflix_id, title, title_type, ... } ], total: number }
 *
 * uNoGS schema-sı dəyişərsə `mapItem` adaptasiya olunmalıdır.
 */

const UNOGS_HOST = "unogs-unogs-v1.p.rapidapi.com";
const UNOGS_BASE = `https://${UNOGS_HOST}`;

interface UnogsItem {
  netflix_id?: string | number;
  nfid?: string | number;
  title?: string;
  title_type?: string; // "movie" | "series"
  type?: string;
  year?: string | number;
  released?: string;
  poster?: string;
  img?: string;
  synopsis?: string;
  plot?: string;
  imdbid?: string;
  imdb_id?: string;
  genre?: string | string[];
  category?: string | string[];
  audio?: string | string[];
  subtitle?: string | string[];
  subs?: string | string[];
}

interface UnogsResponse {
  results?: UnogsItem[];
  ITEMS?: UnogsItem[];
  total?: number | string;
  TOTAL?: number | string;
}

function asArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

function pickKind(item: UnogsItem): "MOVIE" | "SERIES" {
  const t = (item.title_type ?? item.type ?? "").toLowerCase();
  if (t.includes("series") || t === "tv" || t.includes("show")) return "SERIES";
  return "MOVIE";
}

function pickNumber(v: string | number | undefined): number | undefined {
  if (v === undefined || v === null) return undefined;
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  return Number.isFinite(n) ? n : undefined;
}

function mapItem(item: UnogsItem): ScrapedTitle | null {
  const idRaw = item.netflix_id ?? item.nfid;
  const id = idRaw !== undefined ? String(idRaw) : null;
  if (!id || !item.title) return null;

  return {
    platformExternalId: id,
    deepLinkUrl: `https://www.netflix.com/${SCRAPER_CONFIG.country.toLowerCase()}/title/${id}`,
    title: item.title,
    kind: pickKind(item),
    year: pickNumber(item.year),
    genres: asArray(item.genre ?? item.category),
    imdbId: item.imdbid ?? item.imdb_id ?? undefined,
    posterUrl: item.poster ?? item.img ?? undefined,
    description: item.synopsis ?? item.plot ?? undefined,
    audioLanguages: normalizeLanguageList(asArray(item.audio)),
    subtitleLanguages: normalizeLanguageList(asArray(item.subtitle ?? item.subs)),
  };
}

export const netflixScraper: Scraper = {
  platform: "NETFLIX",
  async run(): Promise<ScraperResult> {
    const startedAt = Date.now();
    const warnings: string[] = [];
    const titlesById = new Map<string, ScrapedTitle>();
    let requestCount = 0;

    let apiKey: string;
    try {
      apiKey = getRapidApiKey();
    } catch (err) {
      return {
        platform: "NETFLIX",
        country: SCRAPER_CONFIG.country,
        titles: [],
        warnings: [],
        fatalError: err instanceof Error ? err.message : String(err),
      };
    }

    const headers = {
      "x-rapidapi-host": UNOGS_HOST,
      "x-rapidapi-key": apiKey,
    };

    const pageSize = 100;
    for (let page = 1; page <= SCRAPER_CONFIG.maxPagesPerPlatform; page++) {
      const offset = (page - 1) * pageSize;
      // Müasir uNoGS v3 endpoint-i — ISO ölkə kodu, ofset əsaslı pagination.
      const params = new URLSearchParams({
        country_list: SCRAPER_CONFIG.country, // "AZ"
        order_by: "date",
        limit: String(pageSize),
        offset: String(offset),
      });
      const url = `${UNOGS_BASE}/search/titles?${params.toString()}`;

      try {
        const res = await fetchWithRetry(url, {
          headers,
          pacingMs: SCRAPER_CONFIG.rateLimitMs.NETFLIX,
        });
        requestCount++;
        const data = (await res.json()) as UnogsResponse;
        const items = data.results ?? data.ITEMS ?? [];
        if (items.length === 0) break;

        for (const item of items) {
          const mapped = mapItem(item);
          if (mapped && !titlesById.has(mapped.platformExternalId)) {
            titlesById.set(mapped.platformExternalId, mapped);
          }
        }
        if (items.length < pageSize) break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        warnings.push(`uNoGS page ${page} failed: ${msg}`);
        // Bir səhifə uğursuz olsa belə davam et — final fatal yalnız 0 nəticə halında.
        if (titlesById.size === 0 && page >= 2) {
          return {
            platform: "NETFLIX",
            country: SCRAPER_CONFIG.country,
            titles: [],
            warnings,
            fatalError: `uNoGS API əlçatan deyil: ${msg}`,
            stats: { requestCount, durationMs: Date.now() - startedAt },
          };
        }
        break;
      }
    }

    return {
      platform: "NETFLIX",
      country: SCRAPER_CONFIG.country,
      titles: [...titlesById.values()],
      warnings,
      stats: { requestCount, durationMs: Date.now() - startedAt },
    };
  },
};
