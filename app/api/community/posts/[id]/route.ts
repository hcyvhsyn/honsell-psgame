import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DELETE_WINDOW_MS = 5 * 60 * 1000;

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const post = await prisma.communityPost.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true, createdAt: true },
  });

  if (!post) return NextResponse.json({ error: "Paylaşım tapılmadı." }, { status: 404 });
  if (post.userId !== user.id) {
    return NextResponse.json({ error: "Bu paylaşımı silə bilməzsiniz." }, { status: 403 });
  }

  const ageMs = Date.now() - post.createdAt.getTime();
  if (ageMs > DELETE_WINDOW_MS) {
    return NextResponse.json(
      { error: "Paylaşımı yalnız ilk 5 dəqiqə ərzində silmək olar." },
      { status: 403 },
    );
  }

  await prisma.communityPost.delete({ where: { id: post.id } });

  return NextResponse.json({ ok: true });
}
