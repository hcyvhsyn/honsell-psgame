import { NextResponse } from "next/server";
import { getReelsPage, REELS_PAGE_SIZE } from "@/lib/reels";

export const runtime = "nodejs";

/**
 * Publik feed səhifəsi (offset kursoru). Per-user sahə YOXDUR → edge-keşlənən
 * qala bilir. Bəyəndim/dislike vəziyyəti ayrıca `/api/reels/state`-dən gəlir.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const cursor = Number(url.searchParams.get("cursor") || 0);
  const limit = Number(url.searchParams.get("limit") || REELS_PAGE_SIZE);
  const page = await getReelsPage({
    cursor: Number.isFinite(cursor) ? cursor : 0,
    limit: Number.isFinite(limit) ? limit : REELS_PAGE_SIZE,
  });
  return NextResponse.json(page);
}
