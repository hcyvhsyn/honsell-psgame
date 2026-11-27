import { EPOINT_MIN_CHARGE_AZN_CENTS } from "@/lib/cartLimits";
import { cartServiceFeeCents } from "@/lib/cartServiceFee";

export type RenewalCharge = {
  /** CRM qiyməti (abunəliyin dəyəri — CRM-ə, geri ödəniş bazasına bu gedir). */
  priceCents: number;
  /** 3% xidmət haqqı (səbətdəki `cartServiceFeeCents` ilə eyni). */
  serviceFeeCents: number;
  /** Müştərinin ödədiyi: qiymət + haqq. */
  payableCents: number;
  /** Kartdan tutulan: `payableCents`, Epoint minimumundan (5 ₼) azdırsa 5 ₼. */
  chargeCents: number;
  /** Minimum round-up fərqi — ödənişdən sonra cüzdana yazılır. */
  topUpCents: number;
};

/**
 * Yeniləmə məbləği — SAF, client-safe (AbunelikClient düyməsi və /api/abunelik/renew eyni funksiyanı işlədir).
 * CRM qiyməti + 3% xidmət haqqı (2026-11: hər ödənişdə haqq olmalıdır; əvvəl yeniləmə haqqsız idi).
 * Epoint minimumu 5 ₼ — qiymət+haqq azdırsa kartdan 5 ₼ tutulur, fərq cüzdana (səbətdəki CART_MIN_ROUNDUP qaydası).
 */
export function renewalCharge(priceAzn: number): RenewalCharge {
  const priceCents = Math.round(priceAzn * 100);
  const serviceFeeCents = cartServiceFeeCents(priceCents);
  const payableCents = priceCents + serviceFeeCents;
  const chargeCents = Math.max(payableCents, EPOINT_MIN_CHARGE_AZN_CENTS);
  return { priceCents, serviceFeeCents, payableCents, chargeCents, topUpCents: chargeCents - payableCents };
}
