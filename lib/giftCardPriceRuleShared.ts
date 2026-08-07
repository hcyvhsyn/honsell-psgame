/**
 * TRY hədiyyə kartlarının qaydaya görə qiymətləndirilməsi — SAF hesablama.
 *
 * Bu fayl server-only asılılıqlarından (prisma, lib/pricing) azaddır, ona görə
 * HƏM admin client komponenti, HƏM API route onu import edir. Tək mənbə olması
 * vacibdir: admin önizləmədə gördüyü rəqəm serverin yazdığı rəqəmlə eyni olmalıdır.
 *
 * ⚠️ `lib/pricing.ts` BURAYA import edilə bilməz — o, `lib/prisma`-ya toxunur və
 * client bundle-a düşsə `next build` sınır (tsc keçsə də).
 *
 * Qiymət modeli:
 *   bazaKurs  = referansAzn / referansTry          // məs. 12.00 / 250 = 0.048
 *   xamQiymət = bazaKurs × tryAmount × (1 − pct/100)
 *   qiymət    = xamQiymət, 0.10 AZN-ə qədər AŞAĞI yuvarlaqlaşdırılır
 *   maya      = tryAmount × faktikiAlışKursu
 *   epoint    = qiymət × epointFeePct/100          // yalnız göstərilir
 */

/** Qiymət pilləsi — bütün qiymətlər 0.10 AZN-in tam qatı olur. */
export const GIFT_CARD_PRICE_STEP_CENTS = 10;

/** UI-də başlanğıc təklif: nominal böyüdükcə vahid qiymət azalır. Yalnız seed. */
export const DEFAULT_DISCOUNT_LADDER: Record<number, number> = {
  250: 0,
  500: 1,
  750: 2,
  1000: 3,
};

export type GiftCardPriceRule = {
  /** Referansdan çıxarılan baza satış kursu (AZN / ₺). */
  baseAznPerTry: number;
  /**
   * Faktiki alış kursu (AZN / ₺) — mənfəət hesabı üçün.
   * ⚠️ `Settings.tryToAznRate`-ə YAZILMIR: o kurs oyunları, PS Plus və PUBG UC-ni
   * də qiymətləndirir, dəyişdirmək bütün kataloqu sürüşdürərdi.
   */
  costAznPerTry: number;
  /** Epoint komissiyası (%) — qiymətə hopdurulmur, yalnız göstərilir. */
  epointFeePct: number;
};

export type GiftCardNominal = {
  id: string;
  tryAmount: number | null;
  discountPct: number;
  currentPriceAznCents: number;
  isActive: boolean;
};

export type GiftCardPriceWarning =
  /** `metadata.tryAmount` yoxdur — nominal bilinmir, yazıla bilməz. */
  | "NO_TRY_AMOUNT"
  /** Yuvarlaqlaşdırmadan sonra 0 qəpik qalır — kurs/faiz səhvdir. */
  | "ZERO_PRICE"
  /** Satış qiyməti mayadan aşağıdır. */
  | "BELOW_COST"
  /** Epoint komissiyasından sonra mənfəət mənfidir. */
  | "NEGATIVE_AFTER_FEE";

export type GiftCardPriceRow = {
  id: string;
  tryAmount: number;
  discountPct: number;
  /** bazaKurs × (1 − pct/100) */
  effectiveAznPerTry: number;
  /** Yuvarlaqlaşdırmadan əvvəlki dəyər — admin fərqi görsün. */
  rawPriceAzn: number;
  priceAznCents: number;
  costAznCents: number;
  epointFeeCents: number;
  netAfterFeeCents: number;
  profitAznCents: number;
  profitAfterFeeCents: number;
  currentPriceAznCents: number;
  deltaCents: number;
  isActive: boolean;
  warnings: GiftCardPriceWarning[];
  /** false olduqda sətir bazaya YAZILMIR. */
  writable: boolean;
};

export function baseRateFromAnchor(anchorTryAmount: number, anchorPriceAzn: number): number {
  if (!Number.isFinite(anchorTryAmount) || anchorTryAmount <= 0) return 0;
  if (!Number.isFinite(anchorPriceAzn) || anchorPriceAzn <= 0) return 0;
  return anchorPriceAzn / anchorTryAmount;
}

/**
 * AZN dəyərini 0.10 AZN-ə qədər AŞAĞI yuvarlaqlaşdırır və qəpik qaytarır.
 *
 * ⚠️ Sadə `Math.floor(azn * 10) / 10` İŞLƏMİR: float xətası ucbatından dəqiq
 * 23.80 dəyəri 2379.9999… olur və 23.70-ə düşür. Ona görə əvvəlcə qəpiyə
 * `Math.round` (kiçik epsilon ilə), sonra pilləyə floor edilir.
 */
export function floorToPriceStepCents(azn: number): number {
  if (!Number.isFinite(azn) || azn <= 0) return 0;
  const cents = Math.round(azn * 100 + 1e-6);
  return Math.floor(cents / GIFT_CARD_PRICE_STEP_CENTS) * GIFT_CARD_PRICE_STEP_CENTS;
}

export function computeGiftCardPriceRow(
  nominal: GiftCardNominal,
  rule: GiftCardPriceRule,
): GiftCardPriceRow {
  const warnings: GiftCardPriceWarning[] = [];
  const tryAmount = Number(nominal.tryAmount);
  const hasTry = Number.isFinite(tryAmount) && tryAmount > 0;
  if (!hasTry) warnings.push("NO_TRY_AMOUNT");

  const pct = Number.isFinite(nominal.discountPct) ? nominal.discountPct : 0;
  const effectiveAznPerTry = rule.baseAznPerTry * (1 - pct / 100);
  const rawPriceAzn = hasTry ? effectiveAznPerTry * tryAmount : 0;
  const priceAznCents = floorToPriceStepCents(rawPriceAzn);
  if (hasTry && priceAznCents <= 0) warnings.push("ZERO_PRICE");

  const costAznCents = hasTry ? Math.round(tryAmount * rule.costAznPerTry * 100) : 0;
  const epointFeeCents = Math.round((priceAznCents * rule.epointFeePct) / 100);
  const netAfterFeeCents = priceAznCents - epointFeeCents;
  const profitAznCents = priceAznCents - costAznCents;
  const profitAfterFeeCents = netAfterFeeCents - costAznCents;

  if (priceAznCents > 0 && profitAznCents < 0) warnings.push("BELOW_COST");
  else if (priceAznCents > 0 && profitAfterFeeCents < 0) warnings.push("NEGATIVE_AFTER_FEE");

  return {
    id: nominal.id,
    tryAmount: hasTry ? tryAmount : 0,
    discountPct: pct,
    effectiveAznPerTry,
    rawPriceAzn,
    priceAznCents,
    costAznCents,
    epointFeeCents,
    netAfterFeeCents,
    profitAznCents,
    profitAfterFeeCents,
    currentPriceAznCents: nominal.currentPriceAznCents,
    deltaCents: priceAznCents - nominal.currentPriceAznCents,
    isActive: nominal.isActive,
    warnings,
    writable: hasTry && priceAznCents > 0,
  };
}

export function computeGiftCardPriceTable(
  nominals: GiftCardNominal[],
  rule: GiftCardPriceRule,
): {
  rows: GiftCardPriceRow[];
  totals: {
    writable: number;
    skipped: number;
    profitAznCents: number;
    profitAfterFeeCents: number;
  };
} {
  const rows = nominals
    .map((n) => computeGiftCardPriceRow(n, rule))
    .sort((a, b) => a.tryAmount - b.tryAmount);

  let writable = 0;
  let profitAznCents = 0;
  let profitAfterFeeCents = 0;
  for (const r of rows) {
    if (!r.writable) continue;
    writable += 1;
    profitAznCents += r.profitAznCents;
    profitAfterFeeCents += r.profitAfterFeeCents;
  }

  return {
    rows,
    totals: { writable, skipped: rows.length - writable, profitAznCents, profitAfterFeeCents },
  };
}

/** Qayda doğrulaması — client və server EYNİ mətni göstərsin deyə ortaqdır. */
export function validateGiftCardPriceRule(rule: {
  baseAznPerTry?: unknown;
  costAznPerTry?: unknown;
  epointFeePct?: unknown;
}): string | null {
  const base = Number(rule.baseAznPerTry);
  if (!Number.isFinite(base) || base < 0.001 || base > 1) {
    return "Baza kurs 0.001 və 1 AZN/₺ arasında olmalıdır. Referans nominal və qiyməti yoxla.";
  }
  const cost = Number(rule.costAznPerTry);
  if (!Number.isFinite(cost) || cost < 0 || cost > 1) {
    return "Faktiki alış kursu 0 və 1 AZN/₺ arasında olmalıdır.";
  }
  const fee = Number(rule.epointFeePct);
  if (!Number.isFinite(fee) || fee < 0 || fee >= 100) {
    return "Epoint komissiyası 0 və 100 arasında olmalıdır.";
  }
  return null;
}

/** Endirim faizi doğrulaması. */
export function validateDiscountPct(pct: unknown): string | null {
  const n = Number(pct);
  if (!Number.isFinite(n) || n < 0 || n > 90) {
    return "Endirim faizi 0 və 90 arasında olmalıdır.";
  }
  return null;
}

/**
 * Saxlanmış endirim faizini oxuyur.
 *
 * Niyə saxlanılır, hesablanmır: 0.10-a yuvarlaqlaşdırma İTKİLİdir. 500₺ üçün
 * 0.048 baza və 1% endirim 23.76 → 23.70 verir; geri hesablasaq 1.25% çıxır,
 * 1% deyil. Yəni modal hər açılışda faizləri sürüşdürərdi.
 */
export function readStoredDiscountPct(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== "object") return null;
  const rule = (metadata as { priceRule?: unknown }).priceRule;
  if (!rule || typeof rule !== "object") return null;
  const pct = Number((rule as { discountPct?: unknown }).discountPct);
  return Number.isFinite(pct) ? pct : null;
}
