import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/community/posts/[id]/reaction — like/dislike toggle.
 * Body: { value: 1 | -1 }
 *  - Eyni dəyər təkrar göndərilsə kayıt silinir (toggle off).
 *  - Əks dəyər göndərilsə kayıt update olunur (like ↔ dislike).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const value = Number(body.value);
  if (value !== 1 && value !== -1) {
    return NextResponse.json({ error: "value 1 və ya -1 olmalıdır." }, { status: 400 });
  }

  const post = await prisma.communityPost.findUnique({
    where: { id: params.id },
    select: { id: true, status: true },
  });
  if (!post || post.status !== "APPROVED") {
    return NextResponse.json({ error: "Post tapılmadı." }, { status: 404 });
  }

  const existing = await prisma.communityPostReaction.findUnique({
    where: { postId_userId: { postId: post.id, userId: user.id } },
  });

  let myReaction = 0;
  if (existing) {
    if (existing.value === value) {
      await prisma.communityPostReaction.delete({
        where: { postId_userId: { postId: post.id, userId: user.id } },
      });
      myReaction = 0;
    } else {
      await prisma.communityPostReaction.update({
        where: { postId_userId: { postId: post.id, userId: user.id } },
        data: { value },
      });
      myReaction = value;
    }
  } else {
    await prisma.communityPostReaction.create({
      data: { postId: post.id, userId: user.id, value },
    });
    myReaction = value;
  }

  const grouped = await prisma.communityPostReaction.groupBy({
    by: ["value"],
    where: { postId: post.id },
    _count: { _all: true },
  });
  let likes = 0;
  let dislikes = 0;
  for (const g of grouped) {
    if (g.value > 0) likes = g._count._all;
    else dislikes = g._count._all;
  }

  return NextResponse.json({ ok: true, likes, dislikes, myReaction });
}
