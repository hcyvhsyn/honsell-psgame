import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Returns each user the current user has referred, plus per-referral metrics:
 * total commission earned in AZN and number of purchases by that referee.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const referees = await prisma.user.findMany({
    where: { referredById: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      transactions: {
        where: { type: "PURCHASE" },
        select: { amountAznCents: true, createdAt: true },
      },
    },
  });

  // Commissions earned by `user` from each referee's purchases. We look at
  // COMMISSION rows where beneficiary = user, joined to the source purchase
  // through metadata.sourcePurchaseId — but a simpler accurate approach is
  // to sum COMMISSION rows where the source PURCHASE belonged to that
  // referee. Walk the metadata blob for that link.
  const commissionRows = await prisma.transaction.findMany({
    where: { beneficiaryId: user.id, type: "COMMISSION" },
    select: { amountAznCents: true, metadata: true, gameId: true },
  });

  // Build a refereeId → commission total map. We need to map each commission
  // row back to the buyer; the cheapest path is via the source purchase id
  // stored in metadata.
  const sourcePurchaseIds = commissionRows
    .map((c) => {
      try {
        const m = c.metadata ? JSON.parse(c.metadata) : null;
        return typeof m?.sourcePurchaseId === "string" ? m.sourcePurchaseId : null;
      } catch {
        return null;
      }
    })
    .filter((x): x is string => !!x);

  const sourcePurchases = await prisma.transaction.findMany({
    where: { id: { in: sourcePurchaseIds } },
    select: { id: true, userId: true },
  });
  const purchaseToBuyer = new Map(sourcePurchases.map((p) => [p.id, p.userId]));

  const commissionByReferee = new Map<string, number>();
  for (const c of commissionRows) {
    const sourceId = (() => {
      try {
        return JSON.parse(c.metadata ?? "null")?.sourcePurchaseId as string | undefined;
      } catch {
        return undefined;
      }
    })();
    const buyer = sourceId ? purchaseToBuyer.get(sourceId) : undefined;
    if (!buyer) continue;
    commissionByReferee.set(
      buyer,
      (commissionByReferee.get(buyer) ?? 0) + c.amountAznCents
    );
  }

  const result = referees.map((r) => {
    const purchaseCount = r.transactions.length;
    const purchaseTotalAzn =
      r.transactions.reduce((sum, t) => sum + Math.abs(t.amountAznCents), 0) / 100;
    const earnedAzn = (commissionByReferee.get(r.id) ?? 0) / 100;
    return {
      id: r.id,
      email: r.email,
      name: r.name,
      joinedAt: r.createdAt,
      purchaseCount,
      purchaseTotalAzn,
      earnedAzn,
    };
  });

  const totals = {
    referralCount: result.length,
    totalEarnedAzn: result.reduce((s, r) => s + r.earnedAzn, 0),
    totalReferralPurchases: result.reduce((s, r) => s + r.purchaseCount, 0),
  };

  return NextResponse.json({ referrals: result, totals });
}
