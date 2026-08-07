import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { findEditionCandidates } from "@/lib/gameEditionLookup";

export const runtime = "nodejs";

/**
 * Bir oyunun SÜRÜM namizədləri — reels formunda admin bunları təsdiqləyir.
 * Axtarış məntiqi `lib/gameEditionLookup.ts`-dədir (Telegram axını ilə ORTAQ).
 */
export async function GET(req: Request) {
  await requireAdmin();
  const gameId = (new URL(req.url).searchParams.get("gameId") || "").trim();
  if (!gameId) {
    return NextResponse.json({ error: "gameId tələb olunur" }, { status: 400 });
  }

  const found = await findEditionCandidates(gameId);
  if (!found) return NextResponse.json({ error: "Oyun tapılmadı" }, { status: 404 });

  return NextResponse.json(found);
}
