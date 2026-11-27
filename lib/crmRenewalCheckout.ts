import "server-only";
import { prisma } from "@/lib/prisma";
import type { EpointResultData } from "@/lib/epoint";
import { crmRenewalExternalRef, pushCrmRenewalToCrm } from "@/lib/crmRenewals";
import { sendAdminOrderNotification } from "@/lib/resend";

/**
 * /abunelik kart ödənişi: `Transaction` (type CHECKOUT_PAYMENT, metadata.flow = "crm-renewal").
 * `/result` və admin reconcile `lib/epointCheckoutDispatch.ts` vasitəsilə buraya gəlir.
 *
 * Bir DB tranzaksiyasında: ödəniş PENDING→SUCCESS (guard — dəqiq bir dəfə), min 5 AZN round-up
 * fərqi cüzdana (səbətdəki CART_MIN_ROUNDUP kimi), CrmRenewalOrder. Sonra CRM-ə ötürülür.
 * Məbləğ = CRM qiyməti + 3% xidmət haqqı (`renewalCharge`); CRM-ə və `CrmRenewalOrder.amountAznCents`-ə haqqsız
 * qiymət gedir, `chargedAznCents` kartdan tutulandır.
 * Referal komissiyası / cashback YOXDUR (CRM abunəliyi mağaza məhsulu deyil).
 */
export const CRM_RENEWAL_FLOW = "crm-renewal";

export type CrmRenewalPaymentMetadata = {
  gateway: "epoint";
  flow: typeof CRM_RENEWAL_FLOW;
  orderCode: string;
  createdAt: string;
  renewal: {
    ref: string;
    kind: string;
    title: string;
    months: number;
    priceCents: number;
    /** 3% xidmət haqqı. 2026-11-dən əvvəlki ödənişlərdə yoxdur (= 0). */
    serviceFeeCents?: number;
    topUpCents: number;
    chargeCents: number;
    phoneE164: string;
    quotedAt: string;
    newEndDate: string;
  };
  epoint?: Record<string, unknown>;
};

export function parseCrmRenewalMetadata(value: string | null): CrmRenewalPaymentMetadata | null {
  if (!value) return null;
  try {
    const p = JSON.parse(value) as Partial<CrmRenewalPaymentMetadata>;
    if (p.flow !== CRM_RENEWAL_FLOW || !p.renewal || typeof p.orderCode !== "string") return null;
    const r = p.renewal;
    if (typeof r.ref !== "string" || !Number.isInteger(r.months) || !Number.isInteger(r.priceCents)) return null;
    return p as CrmRenewalPaymentMetadata;
  } catch {
    return null;
  }
}

export function isCrmRenewalPayment(metadata: string | null): boolean {
  return parseCrmRenewalMetadata(metadata) != null;
}

type PaymentTx = { id: string; userId: string; type: string; amountAznCents: number; metadata: string | null };

export async function finalizeCrmRenewalPayment(
  payment: PaymentTx,
  resultPayload: EpointResultData,
): Promise<{ ok: true; orderCode: string } | { ok: false; reason: string }> {
  const meta = parseCrmRenewalMetadata(payment.metadata);
  if (!meta) return { ok: false, reason: "RENEWAL_METADATA_INVALID" };
  const r = meta.renewal;

  const order = await prisma.$transaction(async (tx) => {
    const upd = await tx.transaction.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: {
        status: "SUCCESS",
        metadata: JSON.stringify({ ...meta, result: resultPayload, resultReceivedAt: new Date().toISOString() }),
      },
    });
    if (upd.count !== 1) return null;

    if (r.topUpCents > 0) {
      await tx.user.update({ where: { id: payment.userId }, data: { walletBalance: { increment: r.topUpCents } } });
      await tx.transaction.create({
        data: {
          userId: payment.userId,
          type: "DEPOSIT",
          status: "SUCCESS",
          amountAznCents: r.topUpCents,
          metadata: JSON.stringify({
            kind: "CRM_RENEWAL_MIN_ROUNDUP",
            paymentSource: "EPOINT",
            orderCode: meta.orderCode,
            epointPaymentId: payment.id,
            priceCents: r.priceCents,
            serviceFeeCents: r.serviceFeeCents ?? 0,
            chargedCents: r.chargeCents,
          }),
        },
      });
    }

    return tx.crmRenewalOrder.create({
      data: {
        paymentTransactionId: payment.id,
        externalRef: crmRenewalExternalRef(payment.id),
        orderCode: meta.orderCode,
        userId: payment.userId,
        phone: r.phoneE164,
        ref: r.ref,
        kind: r.kind,
        title: r.title,
        months: r.months,
        amountAznCents: r.priceCents,
        chargedAznCents: r.chargeCents,
      },
    });
  });
  if (!order) return { ok: false, reason: "ALREADY_PROCESSED" };

  // CRM-ə ötürmə cavabdan asılı deyil (Epoint callback-i gözlətmirik) — `next start` uzunömürlüdür.
  void pushCrmRenewalToCrm(order.id);

  void (async () => {
    try {
      const user = await prisma.user.findUnique({ where: { id: payment.userId }, select: { email: true, name: true } });
      await sendAdminOrderNotification({
        orderCode: meta.orderCode,
        userEmail: user?.email ?? "—",
        userName: user?.name ?? null,
        totalAzn: r.chargeCents / 100,
        paymentSource: "epoint",
        items: [
          { kind: "CRM_RENEWAL", title: `${r.title} — ${r.months} ay`, qty: 1, lineAzn: r.priceCents / 100 },
          ...((r.serviceFeeCents ?? 0) > 0
            ? [{ kind: "SERVICE_FEE", title: "Xidmət haqqı (3%)", qty: 1, lineAzn: (r.serviceFeeCents ?? 0) / 100 }]
            : []),
        ],
      });
    } catch (e) {
      console.error("[crm-renewal] admin bildirişi", e);
    }
  })();

  return { ok: true, orderCode: meta.orderCode };
}
