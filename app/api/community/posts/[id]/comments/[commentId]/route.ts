import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DELETE_WINDOW_MS = 5 * 60 * 1000;

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; commentId: string } },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const comment = await prisma.communityPostComment.findUnique({
    where: { id: params.commentId },
    select: { id: true, postId: true, userId: true, createdAt: true },
  });

  if (!comment || comment.postId !== params.id) {
    return NextResponse.json({ error: "Şərh tapılmadı." }, { status: 404 });
  }
  if (comment.userId !== user.id) {
    return NextResponse.json({ error: "Bu şərhi silə bilməzsiniz." }, { status: 403 });
  }

  const ageMs = Date.now() - comment.createdAt.getTime();
  if (ageMs > DELETE_WINDOW_MS) {
    return NextResponse.json(
      { error: "Şərhi yalnız ilk 5 dəqiqə ərzində silmək olar." },
      { status: 403 },
    );
  }

  await prisma.communityPostComment.delete({ where: { id: comment.id } });

  return NextResponse.json({ ok: true });
}
