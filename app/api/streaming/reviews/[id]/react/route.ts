import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * POST /api/streaming/reviews/:id/react
 *   Body: { kind: "LIKE" | "DISLIKE" }
 * Eyni reaksiya təkrar göndərilirsə — silinir (toggle off).
 * Fərqli reaksiya verilərsə — köhnə əvəzlənir.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login tələb olunur" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const kind = body?.kind;
  if (kind !== "LIKE" && kind !== "DISLIKE") {
    return NextResponse.json({ error: "kind LIKE və ya DISLIKE olmalıdır" }, { status: 400 });
  }

  const { id: reviewId } = await params;
  const review = await prisma.streamingReview.findUnique({ where: { id: reviewId } });
  if (!review) return NextResponse.json({ error: "Tapılmadı" }, { status: 404 });
  if (review.status !== "APPROVED") {
    return NextResponse.json({ error: "Bu icmal hələ təsdiqlənməyib" }, { status: 403 });
  }
  if (review.userId === user.id) {
    return NextResponse.json({ error: "Öz icmalınıza reaksiya verə bilməzsiniz" }, { status: 400 });
  }

  const existing = await prisma.streamingReviewReaction.findUnique({
    where: { reviewId_userId: { reviewId, userId: user.id } },
  });

  if (existing && existing.kind === kind) {
    await prisma.streamingReviewReaction.delete({ where: { id: existing.id } });
    return NextResponse.json({ kind: null });
  }
  if (existing) {
    await prisma.streamingReviewReaction.update({
      where: { id: existing.id },
      data: { kind },
    });
    return NextResponse.json({ kind });
  }
  await prisma.streamingReviewReaction.create({
    data: { reviewId, userId: user.id, kind },
  });
  return NextResponse.json({ kind });
}
