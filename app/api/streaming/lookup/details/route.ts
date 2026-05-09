import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { tmdbDetails, TmdbError } from "@/lib/tmdbLookup";

export const runtime = "nodejs";

/** Müştəri icmal formu üçün TMDB detalları. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login tələb olunur" }, { status: 401 });

  const url = new URL(req.url);
  const id = (url.searchParams.get("id") ?? "").trim();
  const kindParam = url.searchParams.get("kind");
  const kind = kindParam === "SERIES" ? "SERIES" : "MOVIE";
  if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });

  try {
    const data = await tmdbDetails(id, kind);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof TmdbError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    const msg = err instanceof Error ? err.message : "TMDB xətası";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
