import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * İzlənmə sayğacını atomik artırır (fire-and-forget). Client `keepalive` ilə
 * göndərir və session daxilində təkrarı özü filtrləyir — burada sadə increment.
 */
export async function POST(_req: Request, ctx: { params: { id: string } }) {
  const reelId = String(ctx.params.id ?? "");
  try {
    await prisma.reel.update({
      where: { id: reelId },
      data: { viewCount: { increment: 1 } },
    });
  } catch {
    // silinmiş reel və s. — səssizcə keç
  }
  return NextResponse.json({ ok: true });
}
