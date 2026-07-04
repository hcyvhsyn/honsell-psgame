import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Like / dislike toggle (ReviewReaction ilə eyni məntiq):
 *   • eyni dəyər təkrar → reaksiya silinir (geri alır)
 *   • əks dəyər → update
 *   • yoxdursa → yaradılır
 * Cavab: yeni myReaction (1 | -1 | 0).
 */
export async function POST(req: Request, ctx: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş tələb olunur" }, { status: 401 });

  const reelId = String(ctx.params.id ?? "");
  const body = await req.json().catch(() => ({}));
  const value = Number(body?.value);
  if (value !== 1 && value !== -1) {
    return NextResponse.json({ error: "value 1 və ya -1 olmalıdır" }, { status: 400 });
  }

  const existing = await prisma.reelReaction.findUnique({
    where: { reelId_userId: { reelId, userId: user.id } },
  });

  let myReaction = 0;
  if (!existing) {
    await prisma.reelReaction.create({ data: { reelId, userId: user.id, value } });
    myReaction = value;
  } else if (existing.value === value) {
    await prisma.reelReaction.delete({ where: { reelId_userId: { reelId, userId: user.id } } });
    myReaction = 0;
  } else {
    await prisma.reelReaction.update({
      where: { reelId_userId: { reelId, userId: user.id } },
      data: { value },
    });
    myReaction = value;
  }

  return NextResponse.json({ myReaction });
}
