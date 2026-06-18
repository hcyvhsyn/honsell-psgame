/**
 * Aldığı məhsula rəy yazan müştəriyə məhsulun qiymətinin müəyyən %-i qədər
 * cashback. Pul `cashbackBalanceCents` ledgerinə (loyalty cashback ilə eyni
 * cüzdan) yazılır və ayrıca CASHBACK əməliyyatı yaradılır.
 *
 * Cashback rəy TƏSDİQLƏNƏNDƏ verilir (admin aktivləşdirəndə, ya da avtomatik
 * aktiv olan dəvət axınında dərhal). İdempotentdir — hər alış (transactionId)
 * üçün yalnız bir dəfə.
 */

type ReviewCashbackDb = {
  transaction: {
    findFirst(args: {
      where: { type: string; metadata: { contains: string } };
      select: { id: true };
    }): Promise<{ id: string } | null>;
    findUnique(args: {
      where: { id: string };
      select: { userId: true; type: true; status: true; amountAznCents: true };
    }): Promise<{ userId: string | null; type: string; status: string; amountAznCents: number } | null>;
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
  user: {
    update(args: {
      where: { id: string };
      data: { cashbackBalanceCents: { increment: number } };
    }): Promise<unknown>;
  };
};

export type ReviewCashbackResult = {
  cashbackCents: number;
  priceCents: number;
};

/**
 * Verilmiş alış (sourceTransactionId) üçün rəy cashback-i yazır.
 * - Alış həmin istifadəçiyə aid, SUCCESS və PURCHASE/SERVICE_PURCHASE olmalıdır.
 * - Cashback = round(|qiymət| * rate / 100).
 * - Eyni alış üçün təkrar yazılmır (metadata markeri ilə yoxlanır).
 * Uğurla yazılarsa nəticəni, əks halda null qaytarır.
 */
export async function awardReviewCashback(
  db: ReviewCashbackDb,
  params: {
    userId: string;
    sourceTransactionId: string;
    reviewCashbackRatePct: number;
    /** Audit üçün: hansı rəyə görə verildi (Testimonial id). */
    testimonialId?: string | null;
  },
): Promise<ReviewCashbackResult | null> {
  const { userId, sourceTransactionId, reviewCashbackRatePct, testimonialId } = params;
  if (reviewCashbackRatePct <= 0) return null;

  // İdempotent: bu alış üçün artıq rəy cashback-i varsa, təkrar yazma.
  const needle = `"reviewCashbackForTransaction":"${sourceTransactionId}"`;
  const existing = await db.transaction.findFirst({
    where: { type: "CASHBACK", metadata: { contains: needle } },
    select: { id: true },
  });
  if (existing) return null;

  // Alışı yoxla — istifadəçiyə aid, uğurlu, alış tipində olmalıdır.
  const purchase = await db.transaction.findUnique({
    where: { id: sourceTransactionId },
    select: { userId: true, type: true, status: true, amountAznCents: true },
  });
  if (!purchase) return null;
  if (purchase.userId !== userId) return null;
  if (purchase.status !== "SUCCESS") return null;
  if (purchase.type !== "PURCHASE" && purchase.type !== "SERVICE_PURCHASE") return null;

  const priceCents = Math.abs(purchase.amountAznCents);
  const cashbackCents = Math.round((priceCents * reviewCashbackRatePct) / 100);
  if (cashbackCents <= 0) return null;

  await db.user.update({
    where: { id: userId },
    data: { cashbackBalanceCents: { increment: cashbackCents } },
  });

  await db.transaction.create({
    data: {
      userId,
      type: "CASHBACK",
      status: "SUCCESS",
      amountAznCents: cashbackCents,
      metadata: JSON.stringify({
        reviewCashbackForTransaction: sourceTransactionId,
        kind: "REVIEW_CASHBACK",
        testimonialId: testimonialId ?? undefined,
        priceCents,
        cashbackPct: reviewCashbackRatePct,
        ledger: "cashbackBalance",
      }),
    },
  });

  return { cashbackCents, priceCents };
}
