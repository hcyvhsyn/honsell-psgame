import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import {
  logGiveawayAudit,
  isReviewSource,
  isReviewEntryMethod,
  isReviewStatus,
} from "@/lib/giveawayWinners";
import { clampRating, sanitizeReviewText } from "@/lib/giveawayWinnersShared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST → qalibə rəy əlavə et (admin). Yalnız ADMIN_TRANSCRIBED (real mesajdan
 * köçürülmüş) və ya ADMIN_STORE_NOTE (mağaza açıqlaması) qəbul olunur —
 * USER_SUBMITTED yalnız qalibin öz təqdimi (public token axını) ilə yaranır,
 * admin onu saxta yarada bilməz.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string; winnerId: string } }
) {
  const admin = await requireAdmin();

  const winner = await prisma.giveawayWinner.findUnique({ where: { id: params.winnerId } });
  if (!winner || winner.giveawayId !== params.id) {
    return NextResponse.json({ error: "Qalib tapılmadı." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));

  const text = sanitizeReviewText(body.text);
  if (text.length < 2) {
    return NextResponse.json({ error: "Rəy mətni tələb olunur." }, { status: 400 });
  }
  if (!isReviewSource(body.source)) {
    return NextResponse.json({ error: "Rəyin gəldiyi kanal (source) seçilməlidir." }, { status: 400 });
  }
  if (!isReviewEntryMethod(body.entryMethod) || body.entryMethod === "USER_SUBMITTED") {
    return NextResponse.json(
      { error: "Daxiletmə üsulu ADMIN_TRANSCRIBED və ya ADMIN_STORE_NOTE olmalıdır." },
      { status: 400 }
    );
  }

  const rating = body.rating == null ? null : clampRating(body.rating);
  if (body.rating != null && rating == null) {
    return NextResponse.json({ error: "Reytinq 1–5 arasında olmalıdır." }, { status: 400 });
  }

  const status = isReviewStatus(body.status) ? body.status : "PENDING";
  const str = (v: unknown) => (typeof v === "string" ? v.trim() || null : null);

  let originalSubmittedAt: Date | null = null;
  if (typeof body.originalSubmittedAt === "string" && body.originalSubmittedAt) {
    const d = new Date(body.originalSubmittedAt);
    if (Number.isNaN(d.getTime()))
      return NextResponse.json({ error: "Keçərsiz göndərilmə tarixi." }, { status: 400 });
    originalSubmittedAt = d;
  }

  const review = await prisma.giveawayWinnerReview.create({
    data: {
      winnerId: winner.id,
      text,
      rating,
      imageUrl: str(body.imageUrl),
      videoUrl: str(body.videoUrl),
      source: body.source,
      entryMethod: body.entryMethod,
      originalSubmittedAt,
      enteredByAdminId: admin.id,
      hasPublishingConsent: Boolean(body.hasPublishingConsent),
      status,
      isPublic: Boolean(body.isPublic),
      internalNote: str(body.internalNote),
    },
  });

  await logGiveawayAudit({
    actorId: admin.id,
    giveawayId: params.id,
    entityType: "review",
    entityId: review.id,
    action: "review.create",
    next: review,
  });

  return NextResponse.json({ review });
}
