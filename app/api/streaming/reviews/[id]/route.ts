import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

/** DELETE /api/streaming/reviews/:id — yalnız öz icmal sahibi və ya admin silə bilər. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login tələb olunur" }, { status: 401 });

  const { id } = await params;
  const review = await prisma.streamingReview.findUnique({ where: { id } });
  if (!review) return NextResponse.json({ error: "Tapılmadı" }, { status: 404 });

  if (review.userId !== user.id && user.role !== "ADMIN") {
    return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
  }

  await prisma.streamingReview.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
