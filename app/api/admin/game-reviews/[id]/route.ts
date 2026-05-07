import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/game-reviews/[id]
 * Body: { action: "APPROVE" | "REJECT" | "HIDE", note?: string }
 *
 * APPROVE: PENDING/REJECTED/HIDDEN → APPROVED (public)
 * REJECT:  hər hansı → REJECTED (görünməz)
 * HIDE:    APPROVED → HIDDEN (gizlənir, audit qalır)
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "").toUpperCase();
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;

  const next: Record<string, "APPROVED" | "REJECTED" | "HIDDEN"> = {
    APPROVE: "APPROVED",
    REJECT: "REJECTED",
    HIDE: "HIDDEN",
  };
  const target = next[action];
  if (!target) {
    return NextResponse.json({ error: "Tanınmayan əməl." }, { status: 400 });
  }

  const review = await prisma.gameReview.findUnique({ where: { id: params.id } });
  if (!review) return NextResponse.json({ error: "Rəy tapılmadı." }, { status: 404 });

  await prisma.gameReview.update({
    where: { id: review.id },
    data: {
      status: target,
      moderatedAt: new Date(),
      moderatedById: admin.id,
      moderationNote: note,
    },
  });

  return NextResponse.json({ ok: true, status: target });
}
