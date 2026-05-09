/**
 * Server-side TMDB v4 API helper-i — admin və müştəri proxy-ləri arasında
 * paylaşılır. Token .env-dən oxunur, public-ə çıxarılmır.
 */

const TMDB_POSTER = "https://image.tmdb.org/t/p/w500";
const TMDB_BACKDROP = "https://image.tmdb.org/t/p/w1280";

export type TmdbSearchResult = {
  id: string;
  title: string;
  year: number | null;
  kind: "MOVIE" | "SERIES";
  posterUrl: string | null;
};

export type TmdbDetails = {
  externalId: string;
  title: string;
  kind: "MOVIE" | "SERIES";
  year: number | null;
  description: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  genres: string[];
  originalLanguage: string | null;
  trailerUrl: string | null;
};

type TmdbRawSearchHit = {
  id: number;
  media_type?: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
};

type TmdbVideo = {
  iso_639_1: string;
  name: string;
  key: string;
  site: string;
  type: string;
  official: boolean;
};

type TmdbDetailRaw = {
  id: number;
  title?: string;
  name?: string;
  release_date?: string | null;
  first_air_date?: string | null;
  overview?: string | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  genres?: { id: number; name: string }[];
  original_language?: string | null;
  videos?: { results: TmdbVideo[] };
};

type TmdbErrorResponse = {
  status_code?: number;
  status_message?: string;
};

export class TmdbError extends Error {
  constructor(public httpStatus: number, public serverMessage: string | null) {
    super(`TMDB cavab vermədi (${httpStatus})${serverMessage ? `: ${serverMessage}` : ""}`);
  }
}

function token(): string {
  const t = process.env.TMDB_ACCESS_TOKEN;
  if (!t) throw new Error("TMDB_ACCESS_TOKEN .env-də qurulmayıb");
  return t;
}

async function tmdbFetch<T>(path: string, params: URLSearchParams): Promise<T> {
  const res = await fetch(`https://api.themoviedb.org/3/${path}?${params}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    let serverMsg: string | null = null;
    try {
      const j = (await res.json()) as TmdbErrorResponse;
      if (j?.status_message) serverMsg = j.status_message;
    } catch {}
    throw new TmdbError(res.status, serverMsg);
  }
  return (await res.json()) as T;
}

export async function tmdbSearch(
  q: string,
  kindParam?: "MOVIE" | "SERIES" | null,
): Promise<TmdbSearchResult[]> {
  if (q.trim().length < 2) return [];
  const endpoint =
    kindParam === "MOVIE"
      ? "search/movie"
      : kindParam === "SERIES"
        ? "search/tv"
        : "search/multi";
  const params = new URLSearchParams({
    query: q,
    include_adult: "false",
    language: "en-US",
    page: "1",
  });
  const data = await tmdbFetch<{ results: TmdbRawSearchHit[] }>(endpoint, params);

  return (data.results ?? [])
    .filter((r) => r.media_type !== "person")
    .map((r) => {
      const mediaType = r.media_type ?? (kindParam === "SERIES" ? "tv" : "movie");
      const title = r.title ?? r.name ?? "";
      const dateStr = r.release_date ?? r.first_air_date ?? "";
      const year = /^\d{4}/.test(dateStr) ? Number(dateStr.slice(0, 4)) : null;
      return {
        id: String(r.id),
        title,
        year,
        kind: mediaType === "tv" ? ("SERIES" as const) : ("MOVIE" as const),
        posterUrl: r.poster_path ? `${TMDB_POSTER}${r.poster_path}` : null,
      };
    })
    .filter((r) => r.title);
}

function pickBestTrailer(
  videos: TmdbVideo[] | undefined,
  originalLang: string | null,
): TmdbVideo | null {
  if (!videos || videos.length === 0) return null;
  const yt = videos.filter((v) => v.site === "YouTube");
  if (yt.length === 0) return null;
  const trailers = yt.filter((v) => v.type === "Trailer");
  const teasers = yt.filter((v) => v.type === "Teaser");
  const matchLang = (v: TmdbVideo) => originalLang != null && v.iso_639_1 === originalLang;

  return (
    trailers.find((v) => v.official && matchLang(v)) ??
    trailers.find((v) => matchLang(v)) ??
    trailers.find((v) => v.official) ??
    trailers[0] ??
    teasers[0] ??
    null
  );
}

export async function tmdbDetails(
  id: string,
  kind: "MOVIE" | "SERIES",
): Promise<TmdbDetails> {
  const endpoint = kind === "SERIES" ? `tv/${id}` : `movie/${id}`;
  const params = new URLSearchParams({ language: "en-US", append_to_response: "videos" });
  const data = await tmdbFetch<TmdbDetailRaw>(endpoint, params);

  const isTv = kind === "SERIES";
  const title = isTv ? data.name ?? "" : data.title ?? "";
  const dateStr = isTv ? data.first_air_date ?? "" : data.release_date ?? "";
  const year = /^\d{4}/.test(dateStr) ? Number(dateStr.slice(0, 4)) : null;
  const trailer = pickBestTrailer(data.videos?.results, data.original_language ?? null);

  return {
    externalId: String(data.id),
    title,
    kind,
    year,
    description: data.overview && data.overview.trim().length > 0 ? data.overview : null,
    posterUrl: data.poster_path ? `${TMDB_POSTER}${data.poster_path}` : null,
    backdropUrl: data.backdrop_path ? `${TMDB_BACKDROP}${data.backdrop_path}` : null,
    genres: (data.genres ?? []).map((g) => g.name).filter(Boolean),
    originalLanguage: data.original_language ?? null,
    trailerUrl: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
  };
}
