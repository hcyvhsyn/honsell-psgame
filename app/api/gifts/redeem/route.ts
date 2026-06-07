import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { SITE_URL } from "@/lib/site";
import { sendProductGiftClaimedEmail } from "@/lib/resend";
import {
  isValidProductGiftFormat,
  normalizeProductGiftCode,
  productGiftNeedsAccount,
} from "@/lib/productGift";

export const runtime = "nodejs";

/**
 * Hədiyyəni açır: kodu yoxlayır və ALAN istifadəçinin adına PENDING fulfillment
 * sifarişi yaradır (adi alışdakı kimi, lakin paymentSource=GIFT və məbləğ 0 —
 * alıcı artıq ödəyib). Oyun hədiyyələrində alan öz PSN/Epic hesabını seçməlidir.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const code = normalizeProductGiftCode(typeof body?.code === "string" ? body.code : "");
  const requestedPsnId = typeof body?.psnAccountId === "string" ? body.psnAccountId : null;
  const requestedEpicId = typeof body?.epicAccountId === "string" ? body.epicAccountId : null;

  if (!isValidProductGiftFormat(code)) {
    return NextResponse.json({ ok: false, reason: "INVALID_FORMAT" }, { status: 400 });
  }

  const gift = await prisma.productGift.findUnique({ where: { code } });
  if (!gift) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }
  if (gift.status !== "UNCLAIMED" || gift.claimedAt) {
    return NextResponse.json({ ok: false, reason: "ALREADY_CLAIMED" }, { status: 409 });
  }
  if (gift.expiresAt.getTime() <= Date.now()) {
    return NextResponse.json({ ok: false, reason: "EXPIRED" }, { status: 410 });
  }

  // Çatdırılma hesabı (yalnız PSN/Epic tələb edən məhsul tipləri üçün).
  const need = productGiftNeedsAccount(gift.productKind, gift.store);
  let psnAccountId: string | null = null;
  let epicAccountId: string | null = null;

  if (need === "PSN") {
    const accounts = await prisma.psnAccount.findMany({ where: { userId: user.id } });
    if (accounts.length === 0) {
      return NextResponse.json({ ok: false, reason: "NO_PSN_ACCOUNT" }, { status: 400 });
    }
    const chosen =
      (requestedPsnId && accounts.find((a) => a.id === requestedPsnId)) ||
      accounts.find((a) => a.isDefault) ||
      accounts[0];
    if (!chosen) {
      return NextResponse.json({ ok: false, reason: "SELECT_PSN" }, { status: 400 });
    }
    psnAccountId = chosen.id;
  } else if (need === "EPIC") {
    const accounts = await prisma.epicAccount.findMany({ where: { userId: user.id } });
    if (accounts.length === 0) {
      return NextResponse.json({ ok: false, reason: "NO_EPIC_ACCOUNT" }, { status: 400 });
    }
    const chosen =
      (requestedEpicId && accounts.find((a) => a.id === requestedEpicId)) ||
      accounts.find((a) => a.isDefault) ||
      accounts[0];
    if (!chosen) {
      return NextResponse.json({ ok: false, reason: "SELECT_EPIC" }, { status: 400 });
    }
    epicAccountId = chosen.id;
  }

  const orderCode = `GIFT-${randomBytes(3).toString("hex").toUpperCase()}`;

  const result = await prisma.$transaction(async (tx) => {
    const isGame = gift.productKind === "GAME";

    const baseMeta = {
      paymentSource: "GIFT" as const,
      fromCart: false,
      manualDelivery: true,
      fulfillmentStage: "NEW",
      orderCode,
      giftId: gift.id,
      giftCode: gift.code,
      giftedById: gift.purchasedById,
      store: gift.store ?? undefined,
    };

    const fulfillment = await tx.transaction.create({
      data: {
        userId: user.id,
        type: isGame ? "PURCHASE" : "SERVICE_PURCHASE",
        status: "PENDING",
        amountAznCents: 0,
        savingsAznCents: 0,
        costAznCents: 0,
        ...(gift.gameId ? { gameId: gift.gameId } : {}),
        ...(gift.serviceProductId ? { serviceProductId: gift.serviceProductId } : {}),
        psnAccountId,
        epicAccountId,
        metadata: JSON.stringify(
          isGame ? baseMeta : { ...baseMeta, kind: gift.productKind },
        ),
      },
    });

    // Yarış (race) qoruması: yalnız hələ UNCLAIMED olan kartı CLAIMED-ə keçir.
    const claim = await tx.productGift.updateMany({
      where: { id: gift.id, status: "UNCLAIMED" },
      data: {
        status: "CLAIMED",
        claimedById: user.id,
        claimedAt: new Date(),
        fulfillmentTransactionId: fulfillment.id,
      },
    });
    if (claim.count !== 1) {
      throw new Error("PRODUCT_GIFT_CONCURRENT_CLAIM");
    }

    return { fulfillmentId: fulfillment.id };
  }).catch((err) => {
    console.error("product gift claim failed", err);
    return null;
  });

  if (!result) {
    return NextResponse.json({ ok: false, reason: "ALREADY_CLAIMED" }, { status: 409 });
  }

  // Alana təsdiq email-i.
  try {
    await sendProductGiftClaimedEmail({
      email: user.email,
      userName: user.name ?? user.email,
      productTitle: gift.titleSnap,
      ordersUrl: `${SITE_URL}/profile/orders`,
      referralCode: user.referralCode,
    });
  } catch (emailErr) {
    console.error("product gift claimed email failed", emailErr);
  }

  return NextResponse.json({
    ok: true,
    productKind: gift.productKind,
    title: gift.titleSnap,
    needsAccount: need,
  });
}
