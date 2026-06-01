import { SCRAPER_CONFIG } from "@/lib/scrapers/config";
import { fetchWithRetry } from "@/lib/scrapers/fetchWithRetry";
import type { Scraper, ScraperResult, ScrapedTitle } from "@/lib/scrapers/types";

/**
 * gain.tv — daxili JSON API (login arxasında).
 *
 * Endpoint (DevTools reverse-engineering ilə tapılıb):
 *   GET https://api.gain.tv/{tenant}/CALL/ProfileTitle/getPlaylistsByCategory/{profileId}
 *       ?slug=/dizi|/film&__culture=tr-tr
 *
 * Cavab `playlists[]` qaytarır — hər playlist `items[]`-i göstərir
 * (Öne Çıkanlar, Gain Originals, Janr karusel-ləri və s.). Bütün playlist-lərin
 * item-lərini flat edib uniq titleId-lər üzrə yığırıq. Bu, kataloğun tam
 * snapshot-u deyil — yalnız hazırda surface olunan başlıqlar (təxminən 80-150
 * arası). Tam katalog üçün hər titleId-dən `getSimilarTitles` ilə BFS etmək
 * olar, lakin bu MVP-də atılır.
 *
 * Auth: `GAIN_COOKIE` env-dən tam Cookie header. Cookie 15-30 gün etibarlıdır;
 * vaxtaşırı yeniləmək lazımdır.
 * Profile ID: `GAIN_PROFILE_ID` env — URL path-ından çıxarılır
 * (məs. "J2YHROODFJFHKVY4F0FIXE3E"). Sənin Gain hesabının profile ID-si.
 *
 * Dil: GAİN Türk platformudur — bütün başlıqlar TR audio + TR subtitle.
 * Multi-language seçimi mövcud deyil, ona görə default olaraq `["tr"]` qoyulur.
 */

const GAIN_API_BASE = "https://api.gain.tv";
const GAIN_TENANT = "2da7kf8jf";
const SLUGS: ReadonlyArray<{ slug: "/dizi" | "/film"; kind: "SERIES" | "MOVIE" }> = [
  { slug: "/dizi", kind: "SERIES" },
  { slug: "/film", kind: "MOVIE" },
];

interface GainImage {
  useType?: string; // "thumbnail" | "coverPhoto"
  ratio?: string; // "2:3" | "16:9"
  imageUrl?: string;
}

interface GainItem {
  titleId?: string;
  name?: string;
  publishYear?: number;
  imdbScore?: number;
  shortDescription?: string;
  contentType?: { id?: string; text?: string };
  genres?: Array<{ id?: string; name?: string; text?: string }>;
  imageInfo?: GainImage[];
  isGainOriginal?: boolean;
}

interface GainPlaylist {
  id?: string;
  title?: string;
  items?: GainItem[];
}

interface GainPlaylistsResp {
  playlists?: GainPlaylist[];
}

function pickPoster(item: GainItem): string | undefined {
  const info = item.imageInfo ?? [];
  // Posterlər üçün 2:3 thumbnail/coverPhoto üstünlük verilir.
  return (
    info.find((i) => i.useType === "thumbnail" && i.ratio === "2:3")?.imageUrl ??
    info.find((i) => i.useType === "coverPhoto" && i.ratio === "2:3")?.imageUrl ??
    info.find((i) => i.ratio === "2:3")?.imageUrl ??
    info[0]?.imageUrl
  );
}

function mapItem(item: GainItem, defaultKind: "MOVIE" | "SERIES"): ScrapedTitle | null {
  if (!item.titleId || !item.name) return null;

  // contentType prioriteti: PROGRAM → atılır (film/dizi deyil).
  const typeId = item.contentType?.id?.toUpperCase();
  let kind: "MOVIE" | "SERIES";
  if (typeId === "TV_SERIES") kind = "SERIES";
  else if (typeId === "FILM") kind = "MOVIE";
  else if (typeId === "PROGRAM") return null;
  else kind = defaultKind;

  return {
    platformExternalId: item.titleId,
    deepLinkUrl: `https://gain.tv/title/${item.titleId}`,
    title: item.name,
    kind,
    year: item.publishYear,
    genres: (item.genres ?? [])
      .map((g) => g.text ?? g.name)
      .filter((g): g is string => !!g),
    posterUrl: pickPoster(item),
    description: item.shortDescription,
    // Türk platforması — bütün kontent tr audio/sub.
    audioLanguages: ["tr"],
    subtitleLanguages: ["tr"],
  };
}

function readEnv(): { profileId: string; cookie: string } | { error: string } {
  const profileId = process.env.GAIN_PROFILE_ID;
  const cookie = process.env.GAIN_COOKIE;
  if (!profileId) {
    return { error: "GAIN_PROFILE_ID .env-də təyin olunmayıb. DevTools URL-indən kopyala." };
  }
  if (!cookie) {
    return {
      error:
        "GAIN_COOKIE .env-də təyin olunmayıb. DevTools → Network → bir API sorğusu → Headers → Cookie sətrini kopyala.",
    };
  }
  return { profileId, cookie };
}

export const gainScraper: Scraper = {
  platform: "GAIN",
  async run(): Promise<ScraperResult> {
    const startedAt = Date.now();
    const warnings: string[] = [];
    const titlesById = new Map<string, ScrapedTitle>();
    let requestCount = 0;

    const env = readEnv();
    if ("error" in env) {
      return {
        platform: "GAIN",
        country: SCRAPER_CONFIG.country,
        titles: [],
        warnings: [],
        fatalError: env.error,
      };
    }

    const headers = {
      accept: "application/json",
      cookie: env.cookie,
      // Bəzi backend-lər real Origin/Referer tələb edir — Cloudflare bot
      // protection üçün də faydalıdır.
      origin: "https://gain.tv",
      referer: "https://gain.tv/",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    };

    for (const { slug, kind: defaultKind } of SLUGS) {
      const params = new URLSearchParams({
        slug,
        __culture: "tr-tr",
      });
      const url = `${GAIN_API_BASE}/${GAIN_TENANT}/CALL/ProfileTitle/getPlaylistsByCategory/${env.profileId}?${params.toString()}`;

      try {
        const res = await fetchWithRetry(url, {
          headers,
          pacingMs: SCRAPER_CONFIG.rateLimitMs.GAIN,
        });
        requestCount++;
        const data = (await res.json()) as GainPlaylistsResp;
        const playlists = data.playlists ?? [];

        if (playlists.length === 0) {
          warnings.push(`gain.tv ${slug}: playlists boş gəldi`);
          continue;
        }

        for (const pl of playlists) {
          for (const item of pl.items ?? []) {
            const mapped = mapItem(item, defaultKind);
            if (mapped && !titlesById.has(mapped.platformExternalId)) {
              titlesById.set(mapped.platformExternalId, mapped);
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (titlesById.size === 0) {
          return {
            platform: "GAIN",
            country: SCRAPER_CONFIG.country,
            titles: [],
            warnings,
            fatalError: `gain.tv ${slug} əlçatan deyil: ${msg}`,
            stats: { requestCount, durationMs: Date.now() - startedAt },
          };
        }
        warnings.push(`gain.tv ${slug} failed: ${msg}`);
      }
    }

    return {
      platform: "GAIN",
      country: SCRAPER_CONFIG.country,
      titles: [...titlesById.values()],
      warnings,
      stats: { requestCount, durationMs: Date.now() - startedAt },
    };
  },
};
