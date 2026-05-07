import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/game-reviews?status=PENDING — admin moderasiya siyahısı.
 * Status: PENDING | APPROVED | REJECTED | HIDDEN | ALL.
 */
export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = (url.searchParams.get("status") || "PENDING").toUpperCase();
  const where =
    status === "ALL"
      ? {}
      : ["PENDING", "APPROVED", "REJECTED", "HIDDEN"].includes(status)
        ? { status }
        : { status: "PENDING" };

  const reviews = await prisma.gameReview.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: { select: { id: true, name: true, email: true } },
      game: { select: { id: true, title: true, imageUrl: true } },
    },
  });

  return NextResponse.json({
    reviews: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      body: r.body,
      status: r.status,
      moderatedAt: r.moderatedAt?.toISOString() ?? null,
      moderationNote: r.moderationNote,
      createdAt: r.createdAt.toISOString(),
      author: { id: r.user.id, name: r.user.name, email: r.user.email },
      game: { id: r.game.id, title: r.game.title, imageUrl: r.game.imageUrl },
    })),
  });
}
