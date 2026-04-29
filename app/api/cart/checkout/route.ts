import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  computeDisplayPrice,
  getSettings,
  tryCentsToCostAzn,
} from "@/lib/pricing";
import { getLoyaltyTier } from "@/lib/loyalty";

export const runtime = "nodejs";

/**
 * Atomic multi-item checkout. Body: { items: [{ id, qty }], psnAccountId }.
 *
 * Validates every game still exists + is active, validates the PSN account
 * belongs to the buyer, recomputes prices server-side (we never trust
 * client-supplied prices), checks the wallet has enough balance, then debits
 * + records purchases + pays affiliate commission in a single Prisma
 * transaction. Each PURCHASE row is tagged with the chosen PSN account so
 * the delivery worker knows where to send the game.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const rawItems = Array.isArray(body.items) ? body.items : [];
  const items: { id: string; qty: number }[] = rawItems
    .map((i: { id?: unknown; qty?: unknown }) => ({
      id: typeof i?.id === "string" ? i.id : "",
      qty: Math.max(1, Math.min(20, Math.floor(Number(i?.qty) || 1))),
    }))
    .filter((i: { id: string }) => i.id);

  if (items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  // Resolve the PSN account: explicit → use it after ownership check;
  // implicit → fall back to the user's default. If they have none, block.
  const requestedAccountId =
    typeof body.psnAccountId === "string" ? body.psnAccountId : null;

  let psnAccount = null;
  if (requestedAccountId) {
    psnAccount = await prisma.psnAccount.findUnique({
      where: { id: requestedAccountId },
    });
    if (!psnAccount || psnAccount.userId !== user.id) {
      return NextResponse.json(
        { error: "Invalid PSN account" },
        { status: 400 }
      );
    }
  } else {
    psnAccount = await prisma.psnAccount.findFirst({
      where: { userId: user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
  }

  if (!psnAccount) {
    return NextResponse.json(
      {
        error:
          "Add a PlayStation account before checkout so we know where to deliver your purchase.",
        code: "NO_PSN_ACCOUNT",
      },
      { status: 400 }
    );
  }

  const settings = await getSettings();
  const games = await prisma.game.findMany({
    where: { id: { in: items.map((i) => i.id) }, isActive: true },
  });

  if (games.length !== items.length) {
    return NextResponse.json(
      { error: "Some items are no longer available" },
      { status: 409 }
    );
  }

  // Build (game, qty, unitListPrice, unitCost) tuples and the total.
  const lines = items.map((i) => {
    const game = games.find((g) => g.id === i.id)!;
    const price = computeDisplayPrice(game, settings);
    const unitListCents = Math.round(price.finalAzn * 100);
    const tryForCost =
      game.discountTryCents != null && game.discountTryCents < game.priceTryCents
        ? game.discountTryCents
        : game.priceTryCents;
    const unitCostCents = Math.round(
      tryCentsToCostAzn(tryForCost, settings) * 100
    );
    return {
      game,
      qty: i.qty,
      unitListCents,
      unitCostCents,
      lineCents: unitListCents * i.qty,
    };
  });
  const totalCents = lines.reduce((sum, l) => sum + l.lineCents, 0);

  // Loyalty tier (cashback %) — based on lifetime spend BEFORE this purchase.
  const spentAgg = await prisma.transaction.aggregate({
    where: { userId: user.id, type: "PURCHASE" },
    _sum: { amountAznCents: true },
  });
  const spentAzn = Math.abs(spentAgg._sum.amountAznCents ?? 0) / 100;
  const loyalty = getLoyaltyTier(spentAzn);

  if (user.walletBalance < totalCents) {
    return NextResponse.json(
      {
        error: "Insufficient wallet balance",
        requiredAzn: totalCents / 100,
        balanceAzn: user.walletBalance / 100,
      },
      { status: 402 }
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { walletBalance: { decrement: totalCents } },
    });

    const purchaseIds: string[] = [];
    let totalCommissionCents = 0;
    let cashbackCents = 0;

    for (const line of lines) {
      // One PURCHASE row per qty so transaction history is granular.
      for (let n = 0; n < line.qty; n++) {
        const purchase = await tx.transaction.create({
          data: {
            userId: user.id,
            type: "PURCHASE",
            status: "SUCCESS",
            amountAznCents: -line.unitListCents,
            gameId: line.game.id,
            psnAccountId: psnAccount!.id,
          },
        });
        purchaseIds.push(purchase.id);

        // Commission = referralProfitSharePct of actual profit (revenue
        // received from the buyer minus the FX-converted cost).
        if (user.referredById && settings.referralProfitSharePct > 0) {
          const profitCents = Math.max(
            0,
            line.unitListCents - line.unitCostCents
          );
          const commissionCents = Math.round(
            (profitCents * settings.referralProfitSharePct) / 100
          );
          if (commissionCents > 0) {
            totalCommissionCents += commissionCents;
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
                gameId: line.game.id,
                metadata: JSON.stringify({
                  sourcePurchaseId: purchase.id,
                  profitCents,
                  shareRate: settings.referralProfitSharePct,
                }),
              },
            });
          }
        }
      }
    }

    // Tier cashback — credit % of paid amount back to the buyer's wallet.
    if (loyalty.cashbackPct > 0) {
      cashbackCents = Math.round((totalCents * loyalty.cashbackPct) / 100);
      if (cashbackCents > 0) {
        await tx.user.update({
          where: { id: user.id },
          data: { walletBalance: { increment: cashbackCents } },
        });
        await tx.transaction.create({
          data: {
            userId: user.id,
            type: "CASHBACK",
            status: "SUCCESS",
            amountAznCents: cashbackCents,
            metadata: JSON.stringify({
              tier: loyalty.label,
              cashbackPct: loyalty.cashbackPct,
              sourcePurchaseIds: purchaseIds,
            }),
          },
        });
      }
    }

    return { purchaseIds, totalCommissionCents, cashbackCents };
  });

  const netDecrement = totalCents - result.cashbackCents;

  return NextResponse.json({
    ok: true,
    purchaseCount: result.purchaseIds.length,
    paidAzn: totalCents / 100,
    cashbackAzn: result.cashbackCents / 100,
    cashbackPct: loyalty.cashbackPct,
    commissionPaidAzn: result.totalCommissionCents / 100,
    newBalanceAzn: (user.walletBalance - netDecrement) / 100,
    deliveredTo: {
      id: psnAccount.id,
      label: psnAccount.label,
      psnEmail: psnAccount.psnEmail,
    },
  });
}
