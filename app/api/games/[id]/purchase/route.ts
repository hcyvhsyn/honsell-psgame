import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const game = await prisma.game.findUnique({ where: { id: params.id } });
  if (!game || !game.isActive) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const settings = await getSettings();
  const price = computeDisplayPrice(game, settings);
  const priceCents = Math.round(price.finalAzn * 100);

  if (user.walletBalance < priceCents) {
    return NextResponse.json(
      { error: "Insufficient wallet balance" },
      { status: 402 }
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    // Debit buyer
    await tx.user.update({
      where: { id: user.id },
      data: { walletBalance: { decrement: priceCents } },
    });
    const purchase = await tx.transaction.create({
      data: {
        userId: user.id,
        type: "PURCHASE",
        status: "SUCCESS",
        amountAznCents: -priceCents,
        gameId: game.id,
      },
    });

    // Pay affiliate commission to the referrer, if any.
    let commissionCents = 0;
    if (user.referredById && settings.affiliateRatePct > 0) {
      commissionCents = Math.round(
        (priceCents * settings.affiliateRatePct) / 100
      );
      if (commissionCents > 0) {
        await tx.user.update({
          where: { id: user.referredById },
          data: { walletBalance: { increment: commissionCents } },
        });
        await tx.transaction.create({
          data: {
            userId: user.referredById,
            beneficiaryId: user.referredById,
            type: "COMMISSION",
            status: "SUCCESS",
            amountAznCents: commissionCents,
            gameId: game.id,
            metadata: JSON.stringify({ sourcePurchaseId: purchase.id }),
          },
        });
      }
    }

    return { purchase, commissionCents };
  });

  return NextResponse.json({
    ok: true,
    purchaseId: result.purchase.id,
    paidAzn: priceCents / 100,
    commissionPaidAzn: result.commissionCents / 100,
  });
}
