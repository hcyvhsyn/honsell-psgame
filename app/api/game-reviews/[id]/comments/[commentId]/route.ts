import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Yalnız yorum sahibi və ya admin silə bilər. */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; commentId: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const comment = await prisma.reviewComment.findUnique({
    where: { id: params.commentId },
    select: { id: true, userId: true, reviewId: true },
  });
  if (!comment || comment.reviewId !== params.id) {
    return NextResponse.json({ error: "Yorum tapılmadı." }, { status: 404 });
  }

  const isOwner = comment.userId === user.id;
  const isAdmin = user.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.reviewComment.delete({ where: { id: comment.id } });
  return NextResponse.json({ ok: true });
}
