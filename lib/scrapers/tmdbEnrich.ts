import { SCRAPER_CONFIG } from "@/lib/scrapers/config";
import { fetchWithRetry } from "@/lib/scrapers/fetchWithRetry";
import type { ScrapedTitle } from "@/lib/scrapers/types";

/**
 * TMDB enrichment — scrape edilmiş başlıqların poster/backdrop/təsvirini
 * TMDB-dən doldurur.
 *
 * Niyə TMDB? — JustWatch poster URL-ləri `images.justwatch.com`-dadır
 * (next.config remotePatterns-də yoxdur + aşağı keyfiyyət). TMDB şəkilləri
 * artıq allowlist-dədir (`image.tmdb.org`) və yüksək keyfiyyətlidir.
 *
 * Match strategiyası: IMDb ID üzərindən `/find/{imdbId}?external_source=imdb_id`
 * — bu, ad+il axtarışından qat-qat dəqiqdir (yanlış film riski yoxdur). IMDb ID
 * olmayan başlıqlar enrichment-siz keçir (JustWatch posteri saxlanılır).
 *
 * Fallback siyasəti: TMDB-də poster tapılsa onu işlət; tapılmasa mövcud
 * (JustWatch) posteri saxla. Yəni "həmişə TMDB, fallback JustWatch".
 *
 * Cache: eyni IMDb ID bir neçə ölkədə (DE+GB+FR) görünə bilər — `TmdbCache`
 * istəyi ölkələr arası paylaşır ki, eyni film üçün təkrar sorğu atılmasın.
 */

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_POSTER = "https://image.tmdb.org/t/p/w500";
const TMDB_BACKDROP = "https://image.tmdb.org/t/p/w1280";

interface TmdbHit {
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string | null;
  vote_average?: number | null;
  vote_count?: number | null;
  popularity?: number | null;
}

interface TmdbFindResponse {
  movie_results?: TmdbHit[];
  tv_results?: TmdbHit[];
}

/** Bir IMDb ID üçün TMDB-dən çıxarılan zənginləşdirmə sahələri. */
interface TmdbEnrichment {
  posterUrl?: string;
  backdropUrl?: string;
  description?: string;
  rating?: number;
  voteCount?: number;
  popularity?: number;
}

/** IMDb ID → enrichment nəticəsi (null = TMDB-də tapılmadı). Ölkələr arası
 *  paylaşıla bilən cache; eyni run-da bir IMDb ID yalnız bir dəfə sorğulanır. */
export type TmdbCache = Map<string, TmdbEnrichment | null>;

export function createTmdbCache(): TmdbCache {
  return new Map();
}

function token(): string | null {
  return process.env.TMDB_ACCESS_TOKEN ?? null;
}

async function lookupByImdb(
  imdbId: string,
  kind: "MOVIE" | "SERIES",
  bearer: string
): Promise<TmdbEnrichment | null> {
  const params = new URLSearchParams({ external_source: "imdb_id" });
  const res = await fetchWithRetry(`${TMDB_BASE}/find/${imdbId}?${params}`, {
    headers: { Authorization: `Bearer ${bearer}`, Accept: "application/json" },
    pacingMs: SCRAPER_CONFIG.tmdbPacingMs,
    // 404 = tapılmadı; retry mənasızdır, FetchError atılacaq və caller null edir.
    retryStatuses: [408, 425, 429, 500, 502, 503, 504],
  });
  const data = (await res.json()) as TmdbFindResponse;

  // Əvvəlcə başlığın növünə uyğun nəticəni seç, yoxdursa digərinə bax.
  const primary = kind === "SERIES" ? data.tv_results : data.movie_results;
  const secondary = kind === "SERIES" ? data.movie_results : data.tv_results;
  const hit = primary?.[0] ?? secondary?.[0];
  if (!hit) return null;

  const enrichment: TmdbEnrichment = {};
  if (hit.poster_path) enrichment.posterUrl = `${TMDB_POSTER}${hit.poster_path}`;
  if (hit.backdrop_path) enrichment.backdropUrl = `${TMDB_BACKDROP}${hit.backdrop_path}`;
  if (hit.overview && hit.overview.trim().length > 0) enrichment.description = hit.overview;
  if (typeof hit.vote_average === "number" && hit.vote_average > 0)
    enrichment.rating = hit.vote_average;
  if (typeof hit.vote_count === "number") enrichment.voteCount = hit.vote_count;
  if (typeof hit.popularity === "number") enrichment.popularity = hit.popularity;
  return enrichment;
}

/**
 * Başlıqları TMDB ilə zənginləşdirir (in-place yox — yeni massiv qaytarır).
 *
 * IMDb ID olmayan və ya TMDB-də tapılmayan başlıqlar dəyişmədən keçir.
 * Tapılanlarda poster/backdrop/təsvir TMDB-dən yenilənir (poster üçün TMDB
 * üstün, yoxsa mövcud JustWatch posteri qalır).
 *
 * @returns `{ titles, stats }` — zənginləşmiş başlıqlar + telemetriya.
 */
export async function enrichTitlesWithTmdb(
  titles: ScrapedTitle[],
  cache: TmdbCache = createTmdbCache(),
  warnings: string[] = []
): Promise<{ titles: ScrapedTitle[]; matched: number; missed: number; skipped: number }> {
  const bearer = token();
  if (!bearer) {
    warnings.push("TMDB_ACCESS_TOKEN yoxdur — enrichment atıldı, JustWatch posterləri saxlanıldı.");
    return { titles, matched: 0, missed: 0, skipped: titles.length };
  }

  let matched = 0;
  let missed = 0;
  let skipped = 0;

  const out: ScrapedTitle[] = [];
  for (const t of titles) {
    if (!t.imdbId) {
      skipped++;
      out.push(t);
      continue;
    }

    let enrichment = cache.get(t.imdbId);
    if (enrichment === undefined) {
      try {
        enrichment = await lookupByImdb(t.imdbId, t.kind, bearer);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        warnings.push(`TMDB find ${t.imdbId} uğursuz: ${msg}`);
        enrichment = null;
      }
      cache.set(t.imdbId, enrichment);
    }

    if (!enrichment) {
      missed++;
      out.push(t);
      continue;
    }

    matched++;
    out.push({
      ...t,
      // "Həmişə TMDB, fallback JustWatch": TMDB posteri varsa onu işlət.
      posterUrl: enrichment.posterUrl ?? t.posterUrl,
      backdropUrl: enrichment.backdropUrl ?? t.backdropUrl,
      description: t.description ?? enrichment.description,
      rating: enrichment.rating ?? t.rating,
      voteCount: enrichment.voteCount ?? t.voteCount,
      popularity: enrichment.popularity ?? t.popularity,
    });
  }

  return { titles: out, matched, missed, skipped };
}
