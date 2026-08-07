import { NextResponse } from "next/server";
import { getReelsPage, normalizeReelCategory, REELS_PAGE_SIZE } from "@/lib/reels";

export const runtime = "nodejs";

/**
 * Publik feed səhifəsi (offset kursoru). Per-user sahə YOXDUR → edge-keşlənən
 * qala bilir. Bəyəndim/dislike vəziyyəti ayrıca `/api/reels/state`-dən gəlir.
 *
 * `category` = GAME | STREAMING | ALL (tanınmayan dəyər → ALL).
 * `platform` yalnız film feed-indəki çip süzgəci üçündür.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const cursor = Number(url.searchParams.get("cursor") || 0);
  const limit = Number(url.searchParams.get("limit") || REELS_PAGE_SIZE);
  const page = await getReelsPage({
    cursor: Number.isFinite(cursor) ? cursor : 0,
    limit: Number.isFinite(limit) ? limit : REELS_PAGE_SIZE,
    category: normalizeReelCategory(url.searchParams.get("category")),
    platformCode: url.searchParams.get("platform"),
  });
  return NextResponse.json(page);
}
