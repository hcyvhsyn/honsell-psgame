import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { drawGiveawayWinners } from "@/lib/giveaways";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST → random qalibləri çək (status COMPLETED olur). */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  await requireAdmin();
  const result = await drawGiveawayWinners(params.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, winners: result.winners });
}
