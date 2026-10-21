/**
 * HBO başlığı (serial və ya film) → IMDb ID (TMDB vasitəsilə). Vitrin başlıqları IMDb ID ilə
 * (`StreamingTitle.externalId`) uyğunlaşdırılır, HBO CMS-də isə IMDb ID yoxdur.
 *
 *   serial: /search/tv?query=<ad>&first_air_date_year=<il>   → /tv/<id>/external_ids
 *   film:   /search/movie?query=<ad>&primary_release_year=<il> → /movie/<id>/external_ids
 * Ad TAM uyğun (normallaşdırılmış), il ±1.
 *
 * Əmin olmayanda (bir neçə bərabər namizəd və ya uyğunluq yoxdur) null — səhv
 * başlığa bağlamaqdansa yeni başlıq yaratmaq yaxşıdır.
 */
import { SCRAPER_CONFIG } from "@/lib/scrapers/config";
import { fetchWithRetry, sleep } from "@/lib/scrapers/fetchWithRetry";

const TMDB_BASE = "https://api.themoviedb.org/3";

export function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

interface TmdbHit {
  id: number;
  /** tv */
  name?: string;
  original_name?: string;
  first_air_date?: string;
  /** movie */
  title?: string;
  original_title?: string;
  release_date?: string;
}

async function tmdbGet<T>(path: string, token: string): Promise<T> {
  const res = await fetchWithRetry(`${TMDB_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    pacingMs: SCRAPER_CONFIG.tmdbPacingMs,
  });
  return (await res.json()) as T;
}

export async function imdbIdForTitle(kind: "SERIES" | "MOVIE", title: string, year: number | null | undefined): Promise<string | null> {
  const token = process.env.TMDB_ACCESS_TOKEN;
  if (!token) return null;
  const movie = kind === "MOVIE";
  const want = normalizeTitle(title);
  const queries = year ? [`&${movie ? "primary_release_year" : "first_air_date_year"}=${year}`, ""] : [""];
  const names = (h: TmdbHit) => (movie ? [h.title, h.original_title] : [h.name, h.original_name]);
  const yearOf = (h: TmdbHit) => {
    const d = movie ? h.release_date : h.first_air_date;
    return d ? Number(d.slice(0, 4)) : null;
  };
  for (const q of queries) {
    const data = await tmdbGet<{ results?: TmdbHit[] }>(`/search/${movie ? "movie" : "tv"}?query=${encodeURIComponent(title)}${q}&include_adult=false`, token);
    const hits = (data.results ?? []).filter((h) => names(h).some((n) => normalizeTitle(n ?? "") === want));
    const close = year ? hits.filter((h) => yearOf(h) !== null && Math.abs(yearOf(h)! - year) <= 1) : hits;
    const exact = year ? close.filter((h) => yearOf(h) === year) : close;
    const pick = exact.length === 1 ? exact[0] : close.length === 1 ? close[0] : null;
    if (pick) {
      const ext = await tmdbGet<{ imdb_id?: string | null }>(`/${movie ? "movie" : "tv"}/${pick.id}/external_ids`, token);
      await sleep(SCRAPER_CONFIG.tmdbPacingMs);
      return ext.imdb_id && /^tt\d+$/.test(ext.imdb_id) ? ext.imdb_id : null;
    }
    if (close.length > 1) return null; // qeyri-müəyyən — təxmin etmirik
  }
  return null;
}
