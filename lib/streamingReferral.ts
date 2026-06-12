import type { prisma } from "@/lib/prisma";
import { resolveReferralRatePct, type ReferralRateDb, type ReferralTarget } from "@/lib/referralRates";

/**
 * Transaction-client tipi: `prisma` genişləndirilmiş ($extends) client olduğu
 * üçün `$transaction` callback-i base `Prisma.TransactionClient`-ə uyğun gəlmir.
 * Callback-in verdiyi tipi (deny-list metodları çıxılmış genişləndirilmiş
 * client) burada törədirik ki, bütün çağırış yerləri uyğun olsun.
 */
type ReferralTxClient = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Streaming/platform/xidmət alışı uğurla bağlanan kimi referal komissiyasını
 * hesablayıb yazır. Komissiya final qiymət üzərindən, referrer-in müştəri
 * seqmentinə (CustomerTier) və alışın hədəfinə uyğun faizlə hesablanır — faiz
 * mərkəzi `resolveReferralRatePct` resolver-indən gəlir.
 *
 * Eyni mənbə Transaction ID üçün ikinci dəfə komissiya yaratmır.
 */
export async function awardStreamingReferralCommission(
  ptx: ReferralTxClient,
  params: {
    sourceTransactionId: string;
    buyerUserId: string;
    serviceProductId: string | null;
    /** Pozitiv qəpik (AZN * 100) — alışın final məbləği. */
    lineCents: number;
    /** Komissiya hədəfi — faiz seqment × bu hədəf üzrə resolve olunur. */
    target: ReferralTarget;
    kind?: "STREAMING" | "PLATFORM" | "TRY_BALANCE" | "PS_PLUS" | "EA_PLAY" | "ACCOUNT_CREATION";
  }
) {
  const { sourceTransactionId, buyerUserId, lineCents, target } = params;
  if (lineCents <= 0) return null;

  const buyer = await ptx.user.findUnique({
    where: { id: buyerUserId },
    select: { referredById: true },
  });
  const referredById = buyer?.referredById ?? null;
  if (!referredById) return null;

  // Eyni alış üçün təkrar komissiyanı blokla (rate hesablamadan əvvəl — ucuz).
  const needle = `"sourcePurchaseId":"${sourceTransactionId}"`;
  const existing = await ptx.transaction.findFirst({
    where: { type: "COMMISSION", metadata: { contains: needle } },
    select: { id: true },
  });
  if (existing) return null;

  // Referrer-in seqmentinə görə faizi resolve et.
  const referrer = await ptx.user.findUnique({
    where: { id: referredById },
    select: { tierId: true },
  });
  const referrerTierId = referrer?.tierId ?? null;
  const ratePct = await resolveReferralRatePct({
    tierId: referrerTierId,
    target,
    db: ptx as unknown as ReferralRateDb,
  });
  if (ratePct <= 0) return null;

  const commissionCents = Math.round((lineCents * ratePct) / 100);
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
        kind: params.kind ?? "STREAMING",
        lineCents,
        shareRate: ratePct,
        tierId: referrerTierId,
        targetType: target.type,
      }),
    },
  });

  return { commissionCents, referredById };
}
