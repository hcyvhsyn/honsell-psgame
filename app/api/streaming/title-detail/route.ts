/**
 * Info modalının datası — detal səhifəsi ilə EYNİ loader (`loadStreamingTitleDetail`).
 * GET /api/streaming/title-detail?kind=SERIES|MOVIE&slug=<slug>
 */
import { NextResponse } from "next/server";
import { loadStreamingTitleDetail } from "@/lib/streamingTitleDetail";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug")?.trim() ?? "";
  const kind = url.searchParams.get("kind");
  if (!slug || slug.length > 200 || (kind !== "SERIES" && kind !== "MOVIE")) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const detail = await loadStreamingTitleDetail(slug, kind);
  if (!detail) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(detail, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
