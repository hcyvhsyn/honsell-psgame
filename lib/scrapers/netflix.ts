import { SCRAPER_CONFIG, getRapidApiKey } from "@/lib/scrapers/config";
import { fetchWithRetry } from "@/lib/scrapers/fetchWithRetry";
import { normalizeLanguageList } from "@/lib/scrapers/languageNormalize";
import type { Scraper, ScraperResult, ScrapedTitle } from "@/lib/scrapers/types";

/**
 * uNoGS (https://rapidapi.com/unogs/api/unogs) — RapidAPI üzərindən
 * Netflix kataloqu. AZ ölkəsi `countrylist=91`.
 *
 * Strategiya:
 *   1. `/aaapi.cgi?q=get:new!...&t=ns&cl=91` — AZ kataloqunda olan başlıqlar
 *      (paginated, hər səhifədə 100). Hər başlıq üçün netflix_id, title,
 *      year, genre və dillər gəlir.
 *   2. Audio/subtitle dilləri response-da bəzən "audio"/"subtitle" sahələrində
 *      gəlir; gəlmədiyi başlıqlar üçün boş massiv ötürülür (orchestrator
 *      bunu warning kimi log edir).
 *
 * uNoGS-də periodik schema dəyişiklikləri olur — bu kod son public sənədə
 * əsasən yazılıb; cavab strukturu fərqlənirsə `mapItem` funksiyası adaptasiya
 * olunmalıdır.
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
      // uNoGS-də "new arrivals" sorğu formatı:
      //   q=get:new<days>:<country>  və ya  q=-!<year_from>,<year_to>!...
      // Daha geniş katalog üçün `q=-!1900,2030!0,5!0,10!0!Any!Any!Any!gt100`
      // pattern istifadə olunur. Burada AZ kataloqundakı bütün başlıqları istəyirik.
      const params = new URLSearchParams({
        q: `-!1900,2030!0,5!0,10!0!Any!Any!Any!gt100!{downloadable}`,
        t: "ns",
        cl: String(SCRAPER_CONFIG.unogsCountryId),
        st: "adv",
        ob: "Relevance",
        p: String(page),
        sa: "and",
      });
      const url = `${UNOGS_BASE}/api.cgi?${params.toString()}`;

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
      titles: [...titlesById.values()],
      warnings,
      stats: { requestCount, durationMs: Date.now() - startedAt },
    };
  },
};
