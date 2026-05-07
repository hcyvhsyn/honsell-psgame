import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  REVIEW_COMMENT_BODY_MAX,
  REVIEW_COMMENT_BODY_MIN,
} from "@/lib/reviewAffiliate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: rəyə yazılmış (gizlənməmiş) yorumları siyahılayır. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const review = await prisma.gameReview.findUnique({
    where: { id: params.id },
    select: { id: true, status: true },
  });
  if (!review || review.status !== "APPROVED") {
    return NextResponse.json({ error: "Rəy tapılmadı." }, { status: 404 });
  }

  const comments = await prisma.reviewComment.findMany({
    where: { reviewId: review.id, isHidden: false },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({
    comments: comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      author: {
        id: c.user.id,
        name: c.user.name ?? c.user.email.split("@")[0],
        avatarUrl: null,
      },
    })),
  });
}

/** POST: rəyə yorum əlavə et. Body: { body: 1..1000 }. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const text = typeof body.body === "string" ? body.body.trim() : "";

  if (text.length < REVIEW_COMMENT_BODY_MIN) {
    return NextResponse.json({ error: "Yorum boş ola bilməz." }, { status: 400 });
  }
  if (text.length > REVIEW_COMMENT_BODY_MAX) {
    return NextResponse.json(
      { error: `Yorum maksimum ${REVIEW_COMMENT_BODY_MAX} simvol ola bilər.` },
      { status: 400 }
    );
  }

  const review = await prisma.gameReview.findUnique({
    where: { id: params.id },
    select: { id: true, status: true },
  });
  if (!review || review.status !== "APPROVED") {
    return NextResponse.json({ error: "Rəy tapılmadı." }, { status: 404 });
  }

  const created = await prisma.reviewComment.create({
    data: { reviewId: review.id, userId: user.id, body: text },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({
    ok: true,
    comment: {
      id: created.id,
      body: created.body,
      createdAt: created.createdAt.toISOString(),
      author: {
        id: created.user.id,
        name: created.user.name ?? created.user.email.split("@")[0],
        avatarUrl: null,
      },
    },
  });
}
