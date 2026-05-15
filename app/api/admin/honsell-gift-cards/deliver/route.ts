import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import {
  formatHonsellGiftCardCode,
  isValidHonsellGiftCardFormat,
  normalizeHonsellGiftCardCode,
} from "@/lib/honsellGiftCard";
import { sendHonsellGiftCardEmail } from "@/lib/resend";
import { SITE_URL } from "@/lib/site";

export const runtime = "nodejs";

/**
 * Admin PENDING vəziyyətindəki Honsell hədiyyə kartına kodu daxil edib təslim edir.
 * Uğur halında kart ACTIVE olur, müştəriyə email göndərilir və alış tranzaksiyası
 * SUCCESS-ə keçir (kart kodu metadata-ya da əlavə edilir ki, profil orders səhifəsi
 * köhnə formatla uyğun göstərsin).
 */
export async function POST(req: Request) {
  await requireAdmin();

  const body = await req.json().catch(() => ({}));
  const cardId = typeof body?.cardId === "string" ? body.cardId.trim() : "";
  const rawCode = typeof body?.code === "string" ? body.code : "";
  const code = normalizeHonsellGiftCardCode(rawCode);

  if (!cardId) {
    return NextResponse.json({ error: "cardId tələb olunur." }, { status: 400 });
  }
  if (!isValidHonsellGiftCardFormat(code)) {
    return NextResponse.json(
      { error: "Kod 11 simvoldan ibarət olmalıdır (yalnız böyük hərflər və rəqəmlər, 0/O/1/I/L istisna)." },
      { status: 400 },
    );
  }

  const existingByCode = await prisma.honsellGiftCard.findUnique({ where: { code } });
  if (existingByCode && existingByCode.id !== cardId) {
    return NextResponse.json(
      { error: "Bu kod artıq başqa kartda istifadə olunub." },
      { status: 409 },
    );
  }

  const card = await prisma.honsellGiftCard.findUnique({
    where: { id: cardId },
    include: {
      purchasedBy: { select: { id: true, email: true, name: true, referralCode: true } },
    },
  });
  if (!card) {
    return NextResponse.json({ error: "Kart tapılmadı." }, { status: 404 });
  }
  if (card.status !== "PENDING") {
    return NextResponse.json(
      { error: "Yalnız PENDING statuslu kartlara kod təyin oluna bilər." },
      { status: 409 },
    );
  }

  const updateResult = await prisma.$transaction(async (tx) => {
    const claim = await tx.honsellGiftCard.updateMany({
      where: { id: cardId, status: "PENDING" },
      data: {
        code,
        status: "ACTIVE",
        deliveredAt: new Date(),
      },
    });
    if (claim.count !== 1) {
      return { ok: false as const, reason: "RACE" as const };
    }

    if (card.purchaseTransactionId) {
      const tr = await tx.transaction.findUnique({ where: { id: card.purchaseTransactionId } });
      if (tr) {
        let meta: Record<string, unknown> = {};
        try {
          meta = tr.metadata ? (JSON.parse(tr.metadata) as Record<string, unknown>) : {};
        } catch {
          meta = {};
        }
        meta.honsellGiftCardCode = code;
        await tx.transaction.update({
          where: { id: tr.id },
          data: {
            status: "SUCCESS",
            metadata: JSON.stringify(meta),
          },
        });
      }
    }

    return { ok: true as const };
  });

  if (!updateResult.ok) {
    return NextResponse.json(
      { error: "Kart artıq başqa admin tərəfindən təslim edilib." },
      { status: 409 },
    );
  }

  if (card.purchasedBy?.email) {
    try {
      const dateFmt = new Intl.DateTimeFormat("az-AZ", { dateStyle: "long" });
      await sendHonsellGiftCardEmail({
        email: card.purchasedBy.email,
        userName: card.purchasedBy.name ?? card.purchasedBy.email,
        amountAznFormatted: `${(card.amountAznCents / 100).toFixed(2)} AZN`,
        code,
        formattedCode: formatHonsellGiftCardCode(code),
        expiresAtFormatted: dateFmt.format(card.expiresAt),
        redeemUrl: `${SITE_URL}/profile/hediyye-kart`,
        referralCode: card.purchasedBy.referralCode ?? null,
      });
    } catch (emailErr) {
      console.error("honsell gift card delivery email failed", emailErr);
    }
  }

  return NextResponse.json({
    ok: true,
    code,
    formattedCode: formatHonsellGiftCardCode(code),
  });
}
