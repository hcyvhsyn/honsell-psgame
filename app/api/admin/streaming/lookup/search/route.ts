import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { tmdbSearch, TmdbError } from "@/lib/tmdbLookup";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const kindParam = url.searchParams.get("kind");
  const kind = kindParam === "MOVIE" || kindParam === "SERIES" ? kindParam : null;

  try {
    const results = await tmdbSearch(q, kind);
    return NextResponse.json({ results });
  } catch (err) {
    if (err instanceof TmdbError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    const msg = err instanceof Error ? err.message : "TMDB xətası";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
