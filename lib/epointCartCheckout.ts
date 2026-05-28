import { prisma } from "@/lib/prisma";
import { applyCashbackToBalance } from "@/lib/loyaltyCashback";
import { getSettings } from "@/lib/pricing";
import { recordPurchaseSpend, recordSuccessfulInvite } from "@/lib/referralCycle";
import {
  sendAdminOrderNotification,
} from "@/lib/resend";
import { awardStreamingReferralCommission } from "@/lib/streamingReferral";
import type { EpointResultData } from "@/lib/epoint";
import {
  HONSELL_GIFT_CARD_VALIDITY_DAYS,
} from "@/lib/honsellGiftCard";

export const EPOINT_CART_PAYMENT_TYPE = "CHECKOUT_PAYMENT";

export type EpointCartLineSnapshot =
  | {
      kind: "GAME";
      title: string;
      qty: number;
      gameId: string;
      unitListCents: number;
      unitSavingsCents: number;
      // Maya dəyəri snapshot-u (AZN qəpik). Köhnə epoint payment-lərində
      // olmaya bilər — completeEpointCartCheckout-da fallback ilə işlənir.
      unitCostCents?: number;
      // PS oyunları üçün PSN, Epic (PC) oyunları üçün epicAccountId istifadə olunur.
      psnAccountId: string | null;
      epicAccountId?: string | null;
      store?: string;
      reviewAffiliateId?: string | null;
    }
  | {
      kind: "TRY_BALANCE";
      title: string;
      qty: number;
      serviceProductId: string;
      unitListCents: number;
      psnAccountId: string;
    }
  | {
      kind: "PS_PLUS";
      title: string;
      qty: number;
      serviceProductId: string;
      unitListCents: number;
      psnAccountId: string | null;
    }
  | {
      kind: "EA_PLAY";
      title: string;
      qty: number;
      serviceProductId: string;
      unitListCents: number;
      psnAccountId: string | null;
    }
  | {
      kind: "ACCOUNT_CREATION";
      title: string;
      qty: number;
      serviceProductId: string;
      unitListCents: number;
      psnAccountId: string | null;
      detail: {
        firstName: string;
        lastName: string;
        birthDate: string;
        email: string;
        password: string;
      };
    }
  | {
      kind: "EPIC_ACCOUNT_CREATION";
      title: string;
      qty: number;
      serviceProductId: string;
      unitListCents: number;
      epicAccountId: string | null;
      detail: {
        firstName: string;
        lastName: string;
        birthDate: string;
        email: string;
        password: string;
        displayName: string;
      };
    }
  | {
      kind: "STREAMING";
      title: string;
      qty: number;
      serviceProductId: string;
      unitListCents: number;
      deliveryMode: "CODE" | "GMAIL";
      gmail?: string;
    }
  | {
      kind: "PLATFORM";
      title: string;
      qty: number;
      serviceProductId: string;
      unitListCents: number;
      category: string;
      durationMonths: number | null;
      /// Musiqi alt-brendi (məs. YOUTUBE_PREMIUM) — admin sifariş baxışında lazımdır.
      musicBrand?: string | null;
      /// İş Platformaları (LinkedIn) plan tipi (CAREER | BUSINESS).
      planType?: string | null;
      /// LinkedIn / YouTube Premium üçün müştəri hesab email-i.
      gmail?: string;
      /// LinkedIn / YouTube Premium üçün müştəri hesab şifrəsi.
      password?: string;
    }
  | {
      kind: "HONSELL_GIFT_CARD";
      title: string;
      qty: number;
      serviceProductId: string;
      unitListCents: number;
    };

export type EpointCartPaymentMetadata = {
  gateway: "epoint";
  flow: "cart-checkout";
  orderCode: string;
  createdAt: string;
  checkout: {
    totalCents: number;
    loyalty: {
      label: string;
      cashbackPct: number;
    };
    lines: EpointCartLineSnapshot[];
  };
  epoint?: Record<string, unknown>;
  result?: EpointResultData;
  resultReceivedAt?: string;
};

type PaymentTransaction = {
  id: string;
  userId: string;
  type: string;
  status: string;
  amountAznCents: number;
  metadata: string | null;
};

function parseMetadata(value: string | null): EpointCartPaymentMetadata | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<EpointCartPaymentMetadata>;
    if (
      parsed.gateway !== "epoint" ||
      parsed.flow !== "cart-checkout" ||
      typeof parsed.orderCode !== "string" ||
      !parsed.checkout ||
      !Array.isArray(parsed.checkout.lines)
    ) {
      return null;
    }
    return parsed as EpointCartPaymentMetadata;
  } catch {
    return null;
  }
}

function metadataWithResult(meta: EpointCartPaymentMetadata, result: EpointResultData) {
  return JSON.stringify({
    ...meta,
    result,
    resultReceivedAt: new Date().toISOString(),
  });
}

export async function finalizeEpointCartCheckout(
  payment: PaymentTransaction,
  resultPayload: EpointResultData,
) {
  const meta = parseMetadata(payment.metadata);
  if (!meta) return { ok: false, reason: "CART_METADATA_INVALID" };
  if (payment.type !== EPOINT_CART_PAYMENT_TYPE) {
    return { ok: false, reason: "UNSUPPORTED_TRANSACTION_TYPE" };
  }

  const user = await prisma.user.findUnique({ where: { id: payment.userId } });
  if (!user) return { ok: false, reason: "USER_NOT_FOUND" };

  const settings = await getSettings();
  type IssuedHonsellGiftCard = {
    amountAznCents: number;
    expiresAt: Date;
  };
  type CompletionSummary = {
    purchaseIds: string[];
    serviceOrderIds: string[];
    cashbackCents: number;
    totalCommissionCents: number;
    tryBalancePendingCount: number;
    orderCode: string;
    honsellGiftCards: IssuedHonsellGiftCard[];
  };

  const summary = await prisma.$transaction(async (tx): Promise<CompletionSummary | null> => {
    const paymentUpdate = await tx.transaction.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: {
        status: "SUCCESS",
        metadata: metadataWithResult(meta, resultPayload),
      },
    });
    if (paymentUpdate.count !== 1) return null;

    const purchaseIds: string[] = [];
    const serviceOrderIds: string[] = [];
    const honsellGiftCards: IssuedHonsellGiftCard[] = [];
    let totalCommissionCents = 0;
    let tryBalancePendingCount = 0;

    for (const line of meta.checkout.lines) {
      for (let n = 0; n < line.qty; n++) {
        if (line.kind === "GAME") {
          const isEpicGame = line.store === "EPIC";
          const purchase = await tx.transaction.create({
            data: {
              userId: payment.userId,
              type: "PURCHASE",
              status: "PENDING",
              amountAznCents: -line.unitListCents,
              savingsAznCents: line.unitSavingsCents,
              costAznCents: line.unitCostCents ?? 0,
              gameId: line.gameId,
              psnAccountId: isEpicGame ? null : line.psnAccountId,
              epicAccountId: isEpicGame ? line.epicAccountId ?? null : null,
              metadata: JSON.stringify({
                paymentSource: "EPOINT",
                fromCart: true,
                manualDelivery: true,
                fulfillmentStage: "NEW",
                store: isEpicGame ? "EPIC" : "PS",
                orderCode: meta.orderCode,
                epointPaymentId: payment.id,
                ...(line.reviewAffiliateId
                  ? {
                      reviewAffiliateId: line.reviewAffiliateId,
                      reviewAffiliateLineCents: line.unitListCents,
                    }
                  : {}),
              }),
            },
          });
          purchaseIds.push(purchase.id);
          continue;
        }

        if (line.kind === "TRY_BALANCE") {
          const sc = await tx.serviceCode.findFirst({
            where: { serviceProductId: line.serviceProductId, isUsed: false },
            orderBy: { createdAt: "asc" },
          });

          if (!sc) {
            const serviceOrder = await tx.transaction.create({
              data: {
                userId: payment.userId,
                type: "SERVICE_PURCHASE",
                status: "PENDING",
                amountAznCents: -line.unitListCents,
                serviceProductId: line.serviceProductId,
                psnAccountId: line.psnAccountId,
                metadata: JSON.stringify({
                  fromCart: true,
                  kind: "TRY_BALANCE",
                  reason: "OUT_OF_STOCK",
                  paymentSource: "EPOINT",
                  orderCode: meta.orderCode,
                  epointPaymentId: payment.id,
                }),
              },
            });
            serviceOrderIds.push(serviceOrder.id);
            tryBalancePendingCount += 1;
            continue;
          }

          await tx.serviceCode.update({
            where: { id: sc.id },
            data: { isUsed: true },
          });

          const serviceOrder = await tx.transaction.create({
            data: {
              userId: payment.userId,
              type: "SERVICE_PURCHASE",
              status: "SUCCESS",
              amountAznCents: -line.unitListCents,
              serviceProductId: line.serviceProductId,
              serviceCodeId: sc.id,
              psnAccountId: line.psnAccountId,
              metadata: JSON.stringify({
                fromCart: true,
                kind: "TRY_BALANCE",
                paymentSource: "EPOINT",
                orderCode: meta.orderCode,
                epointPaymentId: payment.id,
              }),
            },
          });
          serviceOrderIds.push(serviceOrder.id);

          const cm = await awardStreamingReferralCommission(tx, {
            sourceTransactionId: serviceOrder.id,
            buyerUserId: payment.userId,
            serviceProductId: line.serviceProductId,
            lineCents: line.unitListCents,
            streamingProfitSharePct: settings.referralGiftCardsPct,
            kind: "TRY_BALANCE",
          });
          if (cm) {
            totalCommissionCents += cm.commissionCents;
          }

          try {
            await recordPurchaseSpend(tx, payment.userId, line.unitListCents);
            if (cm?.referredById) {
              await recordSuccessfulInvite(tx, cm.referredById, payment.userId);
            }
          } catch (err) {
            console.error("referral cycle bookkeeping failed", err);
          }
          continue;
        }

        if (line.kind === "PS_PLUS") {
          const serviceOrder = await tx.transaction.create({
            data: {
              userId: payment.userId,
              type: "SERVICE_PURCHASE",
              status: "PENDING",
              amountAznCents: -line.unitListCents,
              serviceProductId: line.serviceProductId,
              psnAccountId: line.psnAccountId,
              metadata: JSON.stringify({
                fromCart: true,
                kind: "PS_PLUS",
                paymentSource: "EPOINT",
                orderCode: meta.orderCode,
                epointPaymentId: payment.id,
              }),
            },
          });
          serviceOrderIds.push(serviceOrder.id);
          continue;
        }

        if (line.kind === "EA_PLAY") {
          const serviceOrder = await tx.transaction.create({
            data: {
              userId: payment.userId,
              type: "SERVICE_PURCHASE",
              status: "PENDING",
              amountAznCents: -line.unitListCents,
              serviceProductId: line.serviceProductId,
              psnAccountId: line.psnAccountId,
              metadata: JSON.stringify({
                fromCart: true,
                kind: "EA_PLAY",
                paymentSource: "EPOINT",
                orderCode: meta.orderCode,
                epointPaymentId: payment.id,
              }),
            },
          });
          serviceOrderIds.push(serviceOrder.id);
          continue;
        }

        if (line.kind === "ACCOUNT_CREATION") {
          const serviceOrder = await tx.transaction.create({
            data: {
              userId: payment.userId,
              type: "SERVICE_PURCHASE",
              status: "PENDING",
              amountAznCents: -line.unitListCents,
              serviceProductId: line.serviceProductId,
              psnAccountId: line.psnAccountId,
              metadata: JSON.stringify({
                fromCart: true,
                kind: "ACCOUNT_CREATION",
                paymentSource: "EPOINT",
                orderCode: meta.orderCode,
                epointPaymentId: payment.id,
                firstName: line.detail.firstName,
                lastName: line.detail.lastName,
                birthDate: line.detail.birthDate,
                email: line.detail.email,
                password: line.detail.password,
              }),
            },
          });
          serviceOrderIds.push(serviceOrder.id);
          continue;
        }

        if (line.kind === "EPIC_ACCOUNT_CREATION") {
          const serviceOrder = await tx.transaction.create({
            data: {
              userId: payment.userId,
              type: "SERVICE_PURCHASE",
              status: "PENDING",
              amountAznCents: -line.unitListCents,
              serviceProductId: line.serviceProductId,
              epicAccountId: line.epicAccountId,
              metadata: JSON.stringify({
                fromCart: true,
                kind: "EPIC_ACCOUNT_CREATION",
                paymentSource: "EPOINT",
                orderCode: meta.orderCode,
                epointPaymentId: payment.id,
                firstName: line.detail.firstName,
                lastName: line.detail.lastName,
                birthDate: line.detail.birthDate,
                email: line.detail.email,
                password: line.detail.password,
                displayName: line.detail.displayName,
              }),
            },
          });
          serviceOrderIds.push(serviceOrder.id);
          continue;
        }

        if (line.kind === "STREAMING") {
          const serviceOrder = await tx.transaction.create({
            data: {
              userId: payment.userId,
              type: "SERVICE_PURCHASE",
              status: "PENDING",
              amountAznCents: -line.unitListCents,
              serviceProductId: line.serviceProductId,
              metadata: JSON.stringify({
                fromCart: true,
                kind: "STREAMING",
                deliveryMode: line.deliveryMode,
                paymentSource: "EPOINT",
                orderCode: meta.orderCode,
                epointPaymentId: payment.id,
                ...(line.deliveryMode === "GMAIL" && line.gmail ? { gmail: line.gmail } : {}),
              }),
            },
          });
          serviceOrderIds.push(serviceOrder.id);
          continue;
        }

        if (line.kind === "HONSELL_GIFT_CARD") {
          // Honsell hədiyyə kartı — alış zamanı kod yaranmır. Status PENDING qalır;
          // admin /admin/honsell-gift-cards səhifəsindən kodu manual daxil edib
          // müştəriyə email ilə təslim edir.
          const expiresAt = new Date(
            Date.now() + HONSELL_GIFT_CARD_VALIDITY_DAYS * 24 * 60 * 60 * 1000,
          );
          const serviceOrder = await tx.transaction.create({
            data: {
              userId: payment.userId,
              type: "SERVICE_PURCHASE",
              status: "PENDING",
              amountAznCents: -line.unitListCents,
              serviceProductId: line.serviceProductId,
              metadata: JSON.stringify({
                fromCart: true,
                kind: "HONSELL_GIFT_CARD",
                paymentSource: "EPOINT",
                orderCode: meta.orderCode,
                epointPaymentId: payment.id,
                honsellGiftCardAmountAznCents: line.unitListCents,
                honsellGiftCardExpiresAt: expiresAt.toISOString(),
              }),
            },
          });
          await tx.honsellGiftCard.create({
            data: {
              code: null,
              amountAznCents: line.unitListCents,
              status: "PENDING",
              purchasedById: payment.userId,
              purchaseTransactionId: serviceOrder.id,
              expiresAt,
            },
          });
          serviceOrderIds.push(serviceOrder.id);
          honsellGiftCards.push({ amountAznCents: line.unitListCents, expiresAt });
          continue;
        }

        const serviceOrder = await tx.transaction.create({
          data: {
            userId: payment.userId,
            type: "SERVICE_PURCHASE",
            status: "PENDING",
            amountAznCents: -line.unitListCents,
            serviceProductId: line.serviceProductId,
            metadata: JSON.stringify({
              fromCart: true,
              kind: "PLATFORM",
              category: line.category,
              durationMonths: line.durationMonths,
              paymentSource: "EPOINT",
              orderCode: meta.orderCode,
              epointPaymentId: payment.id,
              ...(line.musicBrand ? { musicBrand: line.musicBrand } : {}),
              ...(line.planType ? { planType: line.planType } : {}),
              ...(line.gmail ? { gmail: line.gmail } : {}),
              ...(line.password ? { customerPassword: line.password } : {}),
            }),
          },
        });
        serviceOrderIds.push(serviceOrder.id);
      }
    }

    const cashbackCents =
      meta.checkout.loyalty.cashbackPct > 0
        ? Math.round((meta.checkout.totalCents * meta.checkout.loyalty.cashbackPct) / 100)
        : 0;

    if (cashbackCents > 0) {
      await applyCashbackToBalance(tx, {
        userId: payment.userId,
        cashbackCents,
        tierLabel: meta.checkout.loyalty.label,
        cashbackPct: meta.checkout.loyalty.cashbackPct,
        sourcePurchaseIds: purchaseIds,
        sourceServiceOrderIds: serviceOrderIds,
        orderCode: meta.orderCode,
      });
    }

    return {
      purchaseIds,
      serviceOrderIds,
      cashbackCents,
      totalCommissionCents,
      tryBalancePendingCount,
      orderCode: meta.orderCode,
      honsellGiftCards,
    };
  });

  if (!summary) return { ok: false, reason: "ALREADY_PROCESSED" };

  // Honsell hədiyyə kartı kodları admin tərəfindən manual təslim edildikdə
  // (/admin/honsell-gift-cards) müştəriyə email ilə göndərilir.

  try {
    await sendAdminOrderNotification({
      orderCode: meta.orderCode,
      userEmail: user.email,
      userName: user.name,
      totalAzn: meta.checkout.totalCents / 100,
      paymentSource: "epoint",
      items: meta.checkout.lines.map((line) => ({
        kind: line.kind,
        title: line.title,
        qty: line.qty,
        lineAzn: (line.unitListCents * line.qty) / 100,
      })),
    });
  } catch (notifyErr) {
    console.error("admin order notify failed", notifyErr);
  }

  return {
    ok: true,
    orderCode: meta.orderCode,
    purchaseCount: summary.purchaseIds.length + summary.serviceOrderIds.length,
    cashbackAzn: summary.cashbackCents / 100,
    commissionPaidAzn: summary.totalCommissionCents / 100,
    tryBalancePendingCount: summary.tryBalancePendingCount,
  };
}
