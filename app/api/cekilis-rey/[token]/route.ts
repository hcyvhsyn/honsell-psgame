import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logGiveawayAudit } from "@/lib/giveawayWinners";
import { clampRating, sanitizeReviewText } from "@/lib/giveawayWinnersShared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Qalib rəyi (public, token ilə). Token qalibin WhatsApp-ına göndərilir — sahib
 * olmaq təsdiq sayılır (OTP yoxdur, winback axını ilə eyni etibar modeli).
 *
 * GET  → rəy formasının konteksti (çəkiliş + mükafat + salamlama adı + vəziyyət).
 * POST → rəyi təqdim et (mətn + reytinq + opsional foto).
 */

async function findByToken(token: string) {
  return prisma.giveawayEntry.findUnique({
    where: { reviewToken: token },
    select: {
      id: true,
      giveawayId: true,
      isWinner: true,
      reviewStatus: true,
      user: { select: { name: true, phone: true, email: true, avatarUrl: true } },
      giveaway: { select: { title: true, prizeLabel: true, prizeImageUrl: true } },
      winners: { select: { id: true } },
    },
  });
}

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const entry = await findByToken(params.token);
  if (!entry || !entry.isWinner) {
    return NextResponse.json({ error: "Link tapılmadı." }, { status: 404 });
  }
  return NextResponse.json({
    name: entry.user.name ?? "",
    title: entry.giveaway.title,
    prizeLabel: entry.giveaway.prizeLabel,
    prizeImageUrl: entry.giveaway.prizeImageUrl,
    submitted: entry.reviewStatus === "SUBMITTED",
  });
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const entry = await findByToken(params.token);
  if (!entry || !entry.isWinner) {
    return NextResponse.json({ error: "Link tapılmadı." }, { status: 404 });
  }
  if (entry.reviewStatus === "SUBMITTED") {
    return NextResponse.json({ error: "Bu link üçün artıq rəy yazılıb." }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const text = sanitizeReviewText(body.text, 2000);
  const rating = clampRating(body.rating) ?? 5;
  const imageUrl =
    typeof body.imageUrl === "string" && body.imageUrl.trim() ? body.imageUrl.trim() : null;

  if (text.length < 3) {
    return NextResponse.json({ error: "Rəy mətni çox qısadır." }, { status: 400 });
  }

  // Qalibin öz təqdimi → GiveawayWinnerReview (USER_SUBMITTED). Qalib qeydini tap
  // və ya (nadir hal) yarat. Consent + APPROVED + public: qalib özü göstərilməsi
  // üçün göndərib. Mənbə şəffaflığı ictimai səhifədə "Qalib tərəfindən göndərilib".
  await prisma.$transaction(async (tx) => {
    let winnerId = entry.winners[0]?.id;
    if (!winnerId) {
      const created = await tx.giveawayWinner.create({
        data: {
          giveawayId: entry.giveawayId,
          entryId: entry.id,
          name: entry.user.name || "İştirakçı",
          phone: entry.user.phone ?? null,
          email: entry.user.email ?? null,
          avatarUrl: entry.user.avatarUrl ?? null,
          prizeTitle: entry.giveaway.prizeLabel,
          source: "WEBSITE_ENTRY",
          selectionMethod: "MANUAL",
          selectedAt: new Date(),
          isPublic: true,
        },
      });
      winnerId = created.id;
    }

    const review = await tx.giveawayWinnerReview.create({
      data: {
        winnerId,
        text,
        rating,
        imageUrl,
        source: "WEBSITE",
        entryMethod: "USER_SUBMITTED",
        originalSubmittedAt: new Date(),
        hasPublishingConsent: true,
        status: "APPROVED",
        isPublic: true,
      },
    });

    await tx.giveawayEntry.update({
      where: { id: entry.id },
      data: { reviewStatus: "SUBMITTED", reviewSubmittedAt: new Date() },
    });

    return review;
  });

  await logGiveawayAudit({
    actorId: null,
    giveawayId: entry.giveawayId,
    entityType: "review",
    entityId: entry.id,
    action: "review.create.user",
    next: { entryId: entry.id, entryMethod: "USER_SUBMITTED" },
  });

  return NextResponse.json({ ok: true });
}
