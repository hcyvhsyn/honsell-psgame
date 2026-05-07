/** Prisma client (yaxud transaction client) üçün dar interfeys. */
type StreamingReferralDb = {
  user: {
    findUnique(args: {
      where: { id: string };
    }): Promise<{ id: string; referredById: string | null } | null>;
    update(args: {
      where: { id: string };
      data: { referralBalanceCents: { increment: number } };
    }): Promise<unknown>;
  };
  transaction: {
    findFirst(args: {
      where: { type: string; metadata: { contains: string } };
      select: { id: true };
    }): Promise<{ id: string } | null>;
    create(args: {
      data: {
        userId: string;
        beneficiaryId: string;
        type: string;
        status: string;
        amountAznCents: number;
        serviceProductId?: string | null;
        metadata: string;
      };
    }): Promise<unknown>;
  };
};

/**
 * Streaming alışı uğurla bağlanan kimi referal komissiyasını hesablayıb yazır.
 * Streaming üçün cost izlənmir — komissiya **final qiymət üzərindən faiz** kimi
 * `Settings.referralStreamingProfitSharePct` dəyəri ilə hesablanır.
 *
 * Eyni mənbə Transaction ID üçün ikinci dəfə komissiya yaratmır.
 */
export async function awardStreamingReferralCommission(
  ptx: StreamingReferralDb,
  params: {
    sourceTransactionId: string;
    buyerUserId: string;
    serviceProductId: string | null;
    /** Pozitiv qəpik (AZN * 100) — alışın final məbləği. */
    lineCents: number;
    streamingProfitSharePct: number;
  }
) {
  const { sourceTransactionId, buyerUserId, lineCents, streamingProfitSharePct } = params;
  if (lineCents <= 0 || streamingProfitSharePct <= 0) return null;

  const buyer = await ptx.user.findUnique({ where: { id: buyerUserId } });
  const referredById = buyer?.referredById ?? null;
  if (!referredById) return null;

  const needle = `"sourcePurchaseId":"${sourceTransactionId}"`;
  const existing = await ptx.transaction.findFirst({
    where: { type: "COMMISSION", metadata: { contains: needle } },
    select: { id: true },
  });
  if (existing) return null;

  const commissionCents = Math.round((lineCents * streamingProfitSharePct) / 100);
  if (commissionCents <= 0) return null;

  await ptx.user.update({
    where: { id: referredById },
    data: { referralBalanceCents: { increment: commissionCents } },
  });

  await ptx.transaction.create({
    data: {
      userId: referredById,
      beneficiaryId: referredById,
      type: "COMMISSION",
      status: "SUCCESS",
      amountAznCents: commissionCents,
      serviceProductId: params.serviceProductId ?? null,
      metadata: JSON.stringify({
        sourcePurchaseId: sourceTransactionId,
        kind: "STREAMING",
        lineCents,
        shareRate: streamingProfitSharePct,
      }),
    },
  });

  return { commissionCents, referredById };
}
