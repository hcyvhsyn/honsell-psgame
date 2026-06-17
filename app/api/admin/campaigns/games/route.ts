import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getActiveDiscountedGames } from "@/lib/campaigns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?q= → axtarışlı aktiv endirimli oyunlar (kampaniya üçün seçim siyahısı). */
export async function GET(req: Request) {
  await requireAdmin();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? undefined;
  const games = await getActiveDiscountedGames({ q, limit: 300 });
  return NextResponse.json({ games });
}
