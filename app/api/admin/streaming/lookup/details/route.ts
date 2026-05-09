import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { tmdbDetails, TmdbError } from "@/lib/tmdbLookup";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
