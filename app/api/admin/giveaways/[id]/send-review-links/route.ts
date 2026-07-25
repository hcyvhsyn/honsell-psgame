import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { sendWinnerReviewLinks } from "@/lib/giveaways";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** POST → qaliblərə rəy linki göndər (hədiyyə çatdırıldıqdan sonra). */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  await requireAdmin();
  const result = await sendWinnerReviewLinks(params.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
