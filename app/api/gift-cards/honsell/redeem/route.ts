import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  formatHonsellGiftCardCode,
  isValidHonsellGiftCardFormat,
  normalizeHonsellGiftCardCode,
} from "@/lib/honsellGiftCard";
import { sendHonsellGiftCardRedeemedEmail } from "@/lib/resend";

export const runtime = "nodejs";

/**
 * Honsell hədiyyə kart aktivləşdirilməsi. İstifadəçi 11 simvollu kodu daxil
 * edir; kod ACTIVE və hələ etibarlıdırsa, məbləğ wallet balansına köçürülür
 * və kart REDEEMED kimi işarələnir.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const rawCode = typeof body?.code === "string" ? body.code : "";
  const code = normalizeHonsellGiftCardCode(rawCode);

  if (!isValidHonsellGiftCardFormat(code)) {
    return NextResponse.json(
      { error: "Etibarsız kod formatı. Honsell hədiyyə kart kodu 11 simvoldan ibarətdir." },
      { status: 400 },
    );
  }

  type RedeemResult =
    | { ok: true; amountAznCents: number; newWalletCents: number }
    | { ok: false; reason: "NOT_FOUND" | "ALREADY_REDEEMED" | "EXPIRED" };

  const result = await prisma.$transaction<RedeemResult>(async (tx) => {
    const card = await tx.honsellGiftCard.findUnique({ where: { code } });
    if (!card) return { ok: false, reason: "NOT_FOUND" };
    if (card.status !== "ACTIVE" || card.redeemedAt) {
      return { ok: false, reason: "ALREADY_REDEEMED" };
    }
    if (card.expiresAt.getTime() <= Date.now()) {
      return { ok: false, reason: "EXPIRED" };
    }

    // Cüzdana məbləği ət əlavə et
    const updatedUser = await tx.user.update({
      where: { id: user.id },
      data: { walletBalance: { increment: card.amountAznCents } },
      select: { walletBalance: true },
    });

    // Audit üçün DEPOSIT tipində tranzaksiya — referat və komissiya yaratmır.
    const txRow = await tx.transaction.create({
      data: {
        userId: user.id,
        type: "DEPOSIT",
        status: "SUCCESS",
        amountAznCents: card.amountAznCents,
        metadata: JSON.stringify({
          kind: "HONSELL_GIFT_CARD_REDEEM",
          honsellGiftCardId: card.id,
          honsellGiftCardCode: card.code,
        }),
      },
    });

    // Optimistic update — eyni anda iki istəyin redempt etməsinin qarşısını
    // almaq üçün updateMany ilə where: status: "ACTIVE" şərtindən istifadə.
    const claim = await tx.honsellGiftCard.updateMany({
      where: { id: card.id, status: "ACTIVE" },
      data: {
        status: "REDEEMED",
        redeemedById: user.id,
        redeemedAt: new Date(),
        redeemTransactionId: txRow.id,
      },
    });

    if (claim.count !== 1) {
      // Race condition: başqa istək artıq aktivləşdirib. Transaction rollback olur.
      throw new Error("HONSELL_GIFT_CARD_CONCURRENT_REDEEM");
    }

    return {
      ok: true,
      amountAznCents: card.amountAznCents,
      newWalletCents: updatedUser.walletBalance,
    };
  }).catch((err: Error) => {
    if (err.message === "HONSELL_GIFT_CARD_CONCURRENT_REDEEM") {
      return { ok: false as const, reason: "ALREADY_REDEEMED" as const };
    }
    throw err;
  });

  if (!result.ok) {
    if (result.reason === "NOT_FOUND") {
      return NextResponse.json(
        { error: "Bu kod tapılmadı. Kodun düzgün yazıldığını yoxlayın." },
        { status: 404 },
      );
    }
    if (result.reason === "ALREADY_REDEEMED") {
      return NextResponse.json(
        { error: "Bu kod artıq istifadə edilib." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Bu kodun etibarlılıq müddəti bitib." },
      { status: 410 },
    );
  }

  const amountAzn = result.amountAznCents / 100;
  const newWalletAzn = result.newWalletCents / 100;

  try {
    await sendHonsellGiftCardRedeemedEmail({
      email: user.email,
      userName: user.name ?? user.email,
      amountAznFormatted: `${amountAzn.toFixed(2)} AZN`,
      newWalletBalanceFormatted: `${newWalletAzn.toFixed(2)} AZN`,
      referralCode: user.referralCode,
    });
  } catch (emailErr) {
    console.error("honsell gift card redeemed email failed", emailErr);
  }

  return NextResponse.json({
    ok: true,
    formattedCode: formatHonsellGiftCardCode(code),
    creditedAzn: amountAzn,
    newWalletBalanceAzn: newWalletAzn,
  });
}
