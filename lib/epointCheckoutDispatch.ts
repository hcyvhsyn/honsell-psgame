import "server-only";
import type { EpointResultData } from "@/lib/epoint";
import { finalizeEpointCartCheckout } from "@/lib/epointCartCheckout";
import { finalizeCrmRenewalPayment, isCrmRenewalPayment } from "@/lib/crmRenewalCheckout";

/**
 * CHECKOUT_PAYMENT ödənişinin uğurlu nəticəsi → axına görə fulfillment.
 *   metadata.flow = "cart-checkout" → səbət (lib/epointCartCheckout.ts)
 *   metadata.flow = "crm-renewal"   → /abunelik CRM yeniləməsi (lib/crmRenewalCheckout.ts)
 * `/result` və admin reconcile eyni dispatcher-i çağırır — yeni axın əlavə edəndə yalnız burada qeyd et.
 */
export async function finalizeEpointCheckoutPayment(
  payment: { id: string; userId: string; type: string; status: string; amountAznCents: number; metadata: string | null },
  resultPayload: EpointResultData,
): Promise<{ ok: boolean; orderCode?: string; reason?: string }> {
  if (isCrmRenewalPayment(payment.metadata)) {
    return finalizeCrmRenewalPayment(payment, resultPayload);
  }
  const r = await finalizeEpointCartCheckout(payment, resultPayload);
  return r.ok ? { ok: true, orderCode: r.orderCode } : { ok: false, reason: r.reason ?? "CHECKOUT_FAILED" };
}
