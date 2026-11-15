import { EPOINT_MIN_CHARGE_AZN_CENTS } from "@/lib/cartLimits";

/**
 * Yeniləmə məbləği: CRM qiyməti olduğu kimi (3% əlavə YOX). Epoint minimumu 5 AZN — qiymət azdırsa kartdan
 * 5 AZN tutulur, fərq ödənişdən sonra cüzdana yazılır (səbətdəki CART_MIN_ROUNDUP qaydası).
 */
export function renewalCharge(priceAzn: number): { priceCents: number; chargeCents: number; topUpCents: number } {
  const priceCents = Math.round(priceAzn * 100);
  const chargeCents = Math.max(priceCents, EPOINT_MIN_CHARGE_AZN_CENTS);
  return { priceCents, chargeCents, topUpCents: chargeCents - priceCents };
}
