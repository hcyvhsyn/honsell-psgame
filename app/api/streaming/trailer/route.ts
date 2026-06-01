import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/streaming/trailer?id=<StreamingTitle id>
 *
 * Bir scrape başlığı üçün YouTube fragman açarını qaytarır. Mənbə:
 *  1. Title-da artıq `trailerUrl` varsa onu işlədir (cache / admin override).
 *  2. Yoxsa IMDb ID (`externalId`) → TMDB `/find` → TMDB id → `/{type}/{id}/videos`
 *     → ən uyğun YouTube trailer. Tapılanda DB-yə yazılır ki, sonrakı kliklər
 *     ani olsun və TMDB sorğusu təkrarlanmasın.
 *
 * Cavab: { key: string | null, title: string }  (key = YouTube video id)
 */

interface TmdbVideo {
  site?: string;
  type?: string;
  key?: string;
  official?: boolean;
  iso_639_1?: string;
}

function pickTrailerKey(videos: TmdbVideo[], originalLang?: string | null): string | null {
  const yt = videos.filter((v) => v.site === "YouTube" && v.key);
  if (yt.length === 0) return null;
  const trailers = yt.filter((v) => v.type === "Trailer");
  const teasers = yt.filter((v) => v.type === "Teaser");
  const matchLang = (v: TmdbVideo) => originalLang != null && v.iso_639_1 === originalLang;
  const best =
    trailers.find((v) => v.official && matchLang(v)) ??
    trailers.find((v) => v.official) ??
    trailers.find((v) => matchLang(v)) ??
    trailers[0] ??
    teasers[0] ??
    yt[0];
  return best?.key ?? null;
}

function keyFromUrl(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/[?&]v=([^&]+)/) ?? url.match(/youtu\.be\/([^?&]+)/) ?? url.match(/embed\/([^?&]+)/);
  return m?.[1] ?? null;
}

async function tmdb<T>(path: string, token: string): Promise<T | null> {
  const res = await fetch(`https://api.themoviedb.org/3/${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });

  const title = await prisma.streamingTitle.findUnique({
    where: { id },
    select: { id: true, title: true, kind: true, externalId: true, trailerUrl: true, originalLanguage: true },
  });
  if (!title) return NextResponse.json({ error: "Başlıq tapılmadı" }, { status: 404 });

  // 1. Artıq saxlanmış trailer varsa — birbaşa qaytar.
  const cachedKey = keyFromUrl(title.trailerUrl);
  if (cachedKey) return NextResponse.json({ key: cachedKey, title: title.title });

  const token = process.env.TMDB_ACCESS_TOKEN;
  if (!token || !title.externalId) {
    return NextResponse.json({ key: null, title: title.title });
  }

  // 2. IMDb → TMDB id + media type.
  const find = await tmdb<{
    movie_results?: Array<{ id: number; original_language?: string }>;
    tv_results?: Array<{ id: number; original_language?: string }>;
  }>(`find/${title.externalId}?external_source=imdb_id`, token);

  const tv = find?.tv_results?.[0];
  const movie = find?.movie_results?.[0];
  const hit = tv ?? movie;
  const type = tv ? "tv" : "movie";
  if (!hit) return NextResponse.json({ key: null, title: title.title });

  // 3. Videolar → ən uyğun trailer.
  const vids = await tmdb<{ results?: TmdbVideo[] }>(`${type}/${hit.id}/videos`, token);
  const key = pickTrailerKey(vids?.results ?? [], hit.original_language ?? title.originalLanguage);

  // 4. Tapılanda DB-yə yaz (cache) — növbəti kliklər ani.
  if (key) {
    await prisma.streamingTitle
      .update({ where: { id: title.id }, data: { trailerUrl: `https://www.youtube.com/watch?v=${key}` } })
      .catch(() => {});
  }

  return NextResponse.json({ key, title: title.title });
}
