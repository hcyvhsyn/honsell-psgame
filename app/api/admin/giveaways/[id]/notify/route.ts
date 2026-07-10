import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { notifyGiveawayWinners } from "@/lib/giveaways";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** POST → qaliblərə WhatsApp bildirişi göndər (yalnız hələ bildirilməmişlərə). */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  await requireAdmin();
  const result = await notifyGiveawayWinners(params.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
