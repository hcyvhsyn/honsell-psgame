import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";

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
    .map((i: any) => ({
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

  // Build (game, qty, unitPrice) tuples and the grand total in qəpik.
  const lines = items.map((i) => {
    const game = games.find((g) => g.id === i.id)!;
    const price = computeDisplayPrice(game, settings);
    const unitCents = Math.round(price.finalAzn * 100);
    return { game, qty: i.qty, unitCents, lineCents: unitCents * i.qty };
  });
  const totalCents = lines.reduce((sum, l) => sum + l.lineCents, 0);

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

    for (const line of lines) {
      // One PURCHASE row per qty so transaction history is granular.
      for (let n = 0; n < line.qty; n++) {
        const purchase = await tx.transaction.create({
          data: {
            userId: user.id,
            type: "PURCHASE",
            status: "SUCCESS",
            amountAznCents: -line.unitCents,
            gameId: line.game.id,
            psnAccountId: psnAccount!.id,
          },
        });
        purchaseIds.push(purchase.id);

        if (user.referredById && settings.affiliateRatePct > 0) {
          const commissionCents = Math.round(
            (line.unitCents * settings.affiliateRatePct) / 100
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
                metadata: JSON.stringify({ sourcePurchaseId: purchase.id }),
              },
            });
          }
        }
      }
    }

    return { purchaseIds, totalCommissionCents };
  });

  return NextResponse.json({
    ok: true,
    purchaseCount: result.purchaseIds.length,
    paidAzn: totalCents / 100,
    commissionPaidAzn: result.totalCommissionCents / 100,
    newBalanceAzn: (user.walletBalance - totalCents) / 100,
    deliveredTo: { id: psnAccount.id, label: psnAccount.label, psnEmail: psnAccount.psnEmail },
  });
}
