import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";
import { getLoyaltyTier } from "@/lib/loyalty";
import {
  applyCashbackToBalance,
  getLifetimeSpendAznForLoyalty,
} from "@/lib/loyaltyCashback";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as {
    paymentSource?: string;
    psnAccountId?: string | null;
  };
  const paymentSource: "wallet" | "referral" =
    body.paymentSource === "referral" ? "referral" : "wallet";

  const game = await prisma.game.findUnique({ where: { id: params.id } });
  if (!game || !game.isActive) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const settings = await getSettings();
  const price = computeDisplayPrice(game, settings);
  const priceCents = Math.round(price.finalAzn * 100);

  if (paymentSource === "referral") {
    if (user.referralBalanceCents < priceCents) {
      return NextResponse.json({ error: "Referal balansı kifayət etmir." }, { status: 402 });
    }
  } else if (user.walletBalance < priceCents) {
    return NextResponse.json({ error: "Cüzdan balansı kifayət etmir." }, { status: 402 });
  }

  const payTag = paymentSource === "referral" ? "REFERRAL" : "WALLET";

  const psnId =
    typeof body.psnAccountId === "string" && body.psnAccountId.trim() !== ""
      ? body.psnAccountId.trim()
      : null;
  if (!psnId) {
    return NextResponse.json(
      { error: "PSN hesabını seçin (psnAccountId)." },
      { status: 400 }
    );
  }
  const psnBelongs = await prisma.psnAccount.findFirst({
    where: { id: psnId, userId: user.id },
    select: { id: true },
  });
  if (!psnBelongs) {
    return NextResponse.json({ error: "PSN hesabı tapılmadı." }, { status: 400 });
  }

  const orderCode = `HON-${randomBytes(3).toString("hex").toUpperCase()}`;

  const spentAzn = await getLifetimeSpendAznForLoyalty(prisma, user.id);
  const loyalty = getLoyaltyTier(spentAzn);
  const loyaltyCashbackCents =
    loyalty.cashbackPct > 0 ? Math.round((priceCents * loyalty.cashbackPct) / 100) : 0;

  const result = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data:
        paymentSource === "referral"
          ? { referralBalanceCents: { decrement: priceCents } }
          : { walletBalance: { decrement: priceCents } },
    });
    const purchase = await tx.transaction.create({
      data: {
        userId: user.id,
        type: "PURCHASE",
        status: "PENDING",
        amountAznCents: -priceCents,
        gameId: game.id,
        psnAccountId: psnId,
        metadata: JSON.stringify({
          paymentSource: payTag,
          manualDelivery: true,
          fulfillmentStage: "NEW",
          orderCode,
        }),
      },
    });

    if (loyaltyCashbackCents > 0) {
      await applyCashbackToBalance(tx, {
        userId: user.id,
        cashbackCents: loyaltyCashbackCents,
        tierLabel: loyalty.label,
        cashbackPct: loyalty.cashbackPct,
        sourcePurchaseIds: [purchase.id],
        sourceServiceOrderIds: [],
        orderCode,
      });
    }

    return { purchase, commissionCents: 0, loyaltyCashbackCents, cashbackPct: loyalty.cashbackPct };
  });

  let newWalletCents = user.walletBalance;
  let newReferralCents = user.referralBalanceCents;
  if (paymentSource === "referral") {
    newWalletCents = user.walletBalance;
    newReferralCents = user.referralBalanceCents - priceCents;
  } else {
    newWalletCents = user.walletBalance - priceCents;
    newReferralCents = user.referralBalanceCents;
  }

  const prevCb = user.cashbackBalanceCents ?? 0;

  return NextResponse.json({
    ok: true,
    orderCode,
    pendingFulfillment: true,
    paymentSourceUsed: paymentSource,
    purchaseId: result.purchase.id,
    paidAzn: priceCents / 100,
    commissionPaidAzn: result.commissionCents / 100,
    newWalletBalanceAzn: newWalletCents / 100,
    newReferralBalanceAzn: newReferralCents / 100,
    cashbackAzn: result.loyaltyCashbackCents / 100,
    cashbackPct: result.cashbackPct,
    newCashbackBalanceAzn: (prevCb + result.loyaltyCashbackCents) / 100,
  });
}
