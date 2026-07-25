import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logGiveawayAudit, isReviewSource, isReviewStatus } from "@/lib/giveawayWinners";
import { clampRating, sanitizeReviewText } from "@/lib/giveawayWinnersShared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Rəyin bu çəkiliş+qalibə aid olduğunu təsdiqlə (cross-giveaway qorunma). */
async function loadOwnedReview(giveawayId: string, winnerId: string, reviewId: string) {
  const review = await prisma.giveawayWinnerReview.findUnique({
    where: { id: reviewId },
    include: { winner: { select: { id: true, giveawayId: true } } },
  });
  if (!review || review.winnerId !== winnerId || review.winner.giveawayId !== giveawayId) {
    return null;
  }
  return review;
}

/**
 * PATCH → rəyi redaktə/moderasiya et. Approve/Reject/Hide (status), public/private,
 * consent, mətn, reytinq, media, note. Audit-ə xüsusi action yazılır.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string; winnerId: string; reviewId: string } }
) {
  const admin = await requireAdmin();
  const prev = await loadOwnedReview(params.id, params.winnerId, params.reviewId);
  if (!prev) return NextResponse.json({ error: "Rəy tapılmadı." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  const str = (v: unknown) => (typeof v === "string" ? v.trim() || null : null);

  let action = "review.update";

  if (typeof body.text === "string") {
    const text = sanitizeReviewText(body.text);
    if (text.length < 2)
      return NextResponse.json({ error: "Rəy mətni çox qısadır." }, { status: 400 });
    data.text = text;
  }
  if ("rating" in body) {
    data.rating = body.rating == null ? null : clampRating(body.rating);
    if (body.rating != null && data.rating == null)
      return NextResponse.json({ error: "Reytinq 1–5 arasında olmalıdır." }, { status: 400 });
  }
  if ("imageUrl" in body) data.imageUrl = str(body.imageUrl);
  if ("videoUrl" in body) data.videoUrl = str(body.videoUrl);
  if ("internalNote" in body) data.internalNote = str(body.internalNote);
  if (body.source != null) {
    if (!isReviewSource(body.source))
      return NextResponse.json({ error: "Keçərsiz mənbə." }, { status: 400 });
    data.source = body.source;
  }
  if (body.status != null) {
    if (!isReviewStatus(body.status))
      return NextResponse.json({ error: "Keçərsiz status." }, { status: 400 });
    data.status = body.status;
    action = "review.moderate";
  }
  if (typeof body.isPublic === "boolean") {
    data.isPublic = body.isPublic;
    if (action === "review.update") action = "review.public.toggle";
  }
  if (typeof body.hasPublishingConsent === "boolean") {
    data.hasPublishingConsent = body.hasPublishingConsent;
    if (action === "review.update") action = "review.consent.toggle";
  }
  if (typeof body.originalSubmittedAt === "string" && body.originalSubmittedAt) {
    const d = new Date(body.originalSubmittedAt);
    if (Number.isNaN(d.getTime()))
      return NextResponse.json({ error: "Keçərsiz tarix." }, { status: 400 });
    data.originalSubmittedAt = d;
  }

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: "Dəyişiklik yoxdur." }, { status: 400 });

  const review = await prisma.giveawayWinnerReview.update({
    where: { id: params.reviewId },
    data,
  });

  await logGiveawayAudit({
    actorId: admin.id,
    giveawayId: params.id,
    entityType: "review",
    entityId: review.id,
    action,
    prev,
    next: review,
  });

  return NextResponse.json({ review });
}

/** DELETE → rəyi sil. */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; winnerId: string; reviewId: string } }
) {
  const admin = await requireAdmin();
  const review = await loadOwnedReview(params.id, params.winnerId, params.reviewId);
  if (!review) return NextResponse.json({ error: "Rəy tapılmadı." }, { status: 404 });

  await prisma.giveawayWinnerReview.delete({ where: { id: params.reviewId } });

  await logGiveawayAudit({
    actorId: admin.id,
    giveawayId: params.id,
    entityType: "review",
    entityId: review.id,
    action: "review.delete",
    prev: review,
  });

  return NextResponse.json({ ok: true });
}
