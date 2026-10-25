import { prisma } from "@/lib/prisma";
import { createPlatformSubscriptionFromTransaction } from "@/lib/subscriptions";
import { awardStreamingReferralCommission } from "@/lib/streamingReferral";
import { recordPurchaseSpend, recordSuccessfulInvite } from "@/lib/referralCycle";

/**
 * PLATFORM sifarişini (AI, Musiqi, İş — o cümlədən Spotify) təsdiqləyir: SUCCESS + abunəlik
 * + referal komissiyası + referal dövrü uçotu. Tək mənbə — iki yerdən çağırılır:
 *   - admin "Təsdiq" (`app/api/admin/service-orders/[id]`) — sonra müştəriyə WhatsApp,
 *   - CRM "Hazırdır" (`app/api/partner/spotify-orders/complete`) — WhatsApp-ı CRM göndərir.
 *
 * Yalnız PENDING sətir təsdiqlənir (`updateMany` qoruması): admin və CRM eyni anda bassa
 * abunəlik/komissiya iki dəfə yazılmır. Qaytarır: `true` → bu çağırış təsdiqlədi.
 */
export async function approvePlatformOrder(tx: {
  id: string;
  userId: string;
  amountAznCents: number;
  serviceProductId: string | null;
  serviceProduct?: { metadata: unknown } | null;
}): Promise<boolean> {
  return prisma.$transaction(async (ptx) => {
    const updated = await ptx.transaction.updateMany({
      where: { id: tx.id, status: "PENDING" },
      data: { status: "SUCCESS" },
    });
    if (updated.count !== 1) return false;

    if (tx.serviceProductId) {
      await createPlatformSubscriptionFromTransaction(ptx, {
        transactionId: tx.id,
        userId: tx.userId,
        serviceProductId: tx.serviceProductId,
        priceAznCents: tx.amountAznCents,
        serviceProductMetadata: tx.serviceProduct?.metadata,
      });
    }

    const cm = await awardStreamingReferralCommission(ptx, {
      sourceTransactionId: tx.id,
      buyerUserId: tx.userId,
      serviceProductId: tx.serviceProductId,
      lineCents: Math.abs(tx.amountAznCents),
      target: { type: "SERVICE_PRODUCT", serviceProductId: tx.serviceProductId ?? "" },
      kind: "PLATFORM",
    });

    try {
      await recordPurchaseSpend(ptx, tx.userId, Math.abs(tx.amountAznCents));
      if (cm?.referredById) {
        await recordSuccessfulInvite(ptx, cm.referredById, tx.userId);
      }
    } catch (err) {
      console.error("referral cycle bookkeeping failed", err);
    }
    return true;
  });
}
