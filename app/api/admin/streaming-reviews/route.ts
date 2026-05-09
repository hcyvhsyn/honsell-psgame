import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

const VALID_STATUS = new Set(["PENDING", "APPROVED", "REJECTED"]);

/**
 * GET ?status=PENDING|APPROVED|REJECTED — admin moderation queue.
 */
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get("status");

  const where: Prisma.StreamingReviewWhereInput = {};
  if (status && VALID_STATUS.has(status)) where.status = status;

  const reviews = await prisma.streamingReview.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: { select: { id: true, name: true, email: true, streamingReviewTrusted: true } },
    },
  });

  return NextResponse.json({
    reviews: reviews.map((r) => ({
      id: r.id,
      userId: r.userId,
      user: { id: r.user.id, name: r.user.name ?? r.user.email, email: r.user.email, trusted: r.user.streamingReviewTrusted },
      tmdbId: r.tmdbId,
      kind: r.kind,
      service: r.service,
      rating: r.rating,
      body: r.body,
      status: r.status,
      rejectedReason: r.rejectedReason,
      titleSnap: r.titleSnap,
      posterUrlSnap: r.posterUrlSnap,
      yearSnap: r.yearSnap,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

/**
 * POST — actions:
 *   { action: "APPROVE", id }
 *   { action: "REJECT", id, reason? }
 *   { action: "DELETE", id }
 *   { action: "TOGGLE_TRUSTED", userId, trusted }
 */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  try {
    if (action === "APPROVE") {
      const r = await prisma.streamingReview.update({
        where: { id: String(body.id) },
        data: { status: "APPROVED", rejectedReason: null },
      });
      return NextResponse.json({ ok: true, status: r.status });
    }

    if (action === "REJECT") {
      const r = await prisma.streamingReview.update({
        where: { id: String(body.id) },
        data: {
          status: "REJECTED",
          rejectedReason: body.reason ? String(body.reason) : null,
        },
      });
      return NextResponse.json({ ok: true, status: r.status });
    }

    if (action === "DELETE") {
      await prisma.streamingReview.delete({ where: { id: String(body.id) } });
      return NextResponse.json({ ok: true });
    }

    if (action === "TOGGLE_TRUSTED") {
      const u = await prisma.user.update({
        where: { id: String(body.userId) },
        data: { streamingReviewTrusted: Boolean(body.trusted) },
        select: { id: true, streamingReviewTrusted: true },
      });
      return NextResponse.json({ ok: true, userId: u.id, trusted: u.streamingReviewTrusted });
    }

    return NextResponse.json({ error: "Bilinməyən action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Xəta baş verdi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
