/** Prisma (və ya tx) üçün dar interfeys — genişləndirilmiş client ilə uyğun gəlir. */
type SpendAggregateDb = {
  transaction: {
    aggregate(args: {
      where: { userId: string; type: { in: string[] } };
      _sum: { amountAznCents: true };
    }): Promise<{ _sum: { amountAznCents: number | null } | null }>;
  };
};

type CashbackWriteDb = {
  user: {
    update(args: {
      where: { id: string };
      data: { cashbackBalanceCents: { increment: number } };
    }): Promise<unknown>;
  };
  transaction: {
    create(args: {
      data: {
        userId: string;
        type: string;
        status: string;
        amountAznCents: number;
        metadata: string;
      };
    }): Promise<unknown>;
  };
};

/** PURCHASE + SERVICE_PURCHASE əsaslı ömür boyu xərc — loyalty tier üçün (cari ödəniş daxil deyil). */
export async function getLifetimeSpendAznForLoyalty(
  db: SpendAggregateDb,
  userId: string
): Promise<number> {
  const agg = await db.transaction.aggregate({
    where: { userId, type: { in: ["PURCHASE", "SERVICE_PURCHASE"] } },
    _sum: { amountAznCents: true },
  });
  const raw = agg._sum?.amountAznCents ?? 0;
  return Math.abs(raw) / 100;
}

export type ApplyCashbackParams = {
  userId: string;
  cashbackCents: number;
  tierLabel: string;
  cashbackPct: number;
  sourcePurchaseIds: string[];
  sourceServiceOrderIds: string[];
  orderCode?: string | null;
};

/** Loyalty cashback-i ayrıca balansa yazır + CASHBACK əməliyyatı (depozit cüzdanına toxunmaz). */
export async function applyCashbackToBalance(
  db: CashbackWriteDb,
  p: ApplyCashbackParams
): Promise<void> {
  if (p.cashbackCents <= 0) return;
  await db.user.update({
    where: { id: p.userId },
    data: { cashbackBalanceCents: { increment: p.cashbackCents } },
  });
  await db.transaction.create({
    data: {
      userId: p.userId,
      type: "CASHBACK",
      status: "SUCCESS",
      amountAznCents: p.cashbackCents,
      metadata: JSON.stringify({
        tier: p.tierLabel,
        cashbackPct: p.cashbackPct,
        sourcePurchaseIds: p.sourcePurchaseIds,
        sourceServiceOrderIds: p.sourceServiceOrderIds,
        orderCode: p.orderCode ?? undefined,
        ledger: "cashbackBalance",
      }),
    },
  });
}
