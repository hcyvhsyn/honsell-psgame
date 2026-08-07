/**
 * Oyun paketləri — CLIENT-SAFE tiplər və saf riyaziyyat.
 *
 * ⚠️ Bu fayl `lib/prisma`-ya (birbaşa və ya dolayı) TOXUNMAMALIDIR. Səbət,
 * ana səhifə rail-i və paket detal səhifəsindəki `"use client"` komponentlər
 * buradan import edir; server tərəfi isə [lib/gameBundles.ts](./gameBundles.ts)-dədir.
 * Client komponent server faylını import etsə `next build` sınır (tsc keçsə də).
 */

/** PERCENT → cəmdən faiz endirimi, CUSTOM → hər oyuna ayrıca paket qiyməti. */
export type BundlePricingMode = "PERCENT" | "CUSTOM";

export const BUNDLE_PRICING_MODES: BundlePricingMode[] = ["PERCENT", "CUSTOM"];

export const BUNDLE_PRICING_MODE_LABELS: Record<BundlePricingMode, string> = {
  PERCENT: "Cəmdən faiz endirimi",
  CUSTOM: "Hər oyuna ayrıca qiymət",
};

/** Səbətdəki paket sətrinin `productType` dəyəri. */
export const BUNDLE_PRODUCT_TYPE = "BUNDLE";

/** Paket daxilində bir oyunun qiymət sətri. Bütün məbləğlər AZN qəpiklə. */
export type BundleItemPrice = {
  gameId: string;
  title: string;
  imageUrl: string | null;
  slug: string | null;
  /** Oyunun adi vitrin qiyməti (endirim + flash deal tətbiq olunmuş halda). */
  listAznCents: number;
  /** Paket daxilindəki qiymət — heç vaxt `listAznCents`-dən böyük olmur. */
  bundleAznCents: number;
};

export type BundlePricing = {
  items: BundleItemPrice[];
  listTotalAznCents: number;
  totalAznCents: number;
  savingsAznCents: number;
  /** Faktiki endirim faizi (yuvarlaqlaşdırılmış); qənaət yoxdursa 0. */
  discountPct: number;
};

/** Vitrin (rail + detal səhifə) üçün client-safe paket görünüşü. */
export type BundleCardData = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  imageUrl: string | null;
  badgeText: string | null;
  pricing: BundlePricing;
};

/** Səbət sətrində saxlanan qısa tərkib snapshot-u. */
export type BundleCartSnapshotItem = {
  gameId: string;
  title: string;
  imageUrl: string | null;
  bundleAznCents: number;
};

export function normalizePricingMode(value: unknown): BundlePricingMode {
  return value === "CUSTOM" ? "CUSTOM" : "PERCENT";
}

/** Admin 0–95 aralığından kənar rəqəm yazsa kəsir (100% paket = pulsuz oyun). */
export function clampDiscountPct(value: unknown): number {
  const n = Math.round(Number(value) || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(95, n));
}

/**
 * PERCENT rejimi: hədəf cəmi oyunlar arasında bölür (largest-remainder).
 *
 * Hər oyun checkout-da AYRICA `Transaction` sətri yaradır, ona görə sətirlərin
 * cəmi müştəridən tutulan məbləğə qəpiyinə qədər bərabər olmalıdır. Sadə
 * `Math.round(list * k)` 3–4 oyunlu paketdə 1–2 qəpik fərq buraxır və sifariş
 * cəmi ödənişlə uyğunsuz olur.
 *
 * Bölgü list qiymətə mütənasibdir: bahalı oyun endirimin böyük hissəsini daşıyır.
 */
export function allocateBundlePrices(listCents: number[], discountPct: number): number[] {
  const safe = listCents.map((c) => Math.max(0, Math.round(c)));
  if (safe.length === 0) return [];

  const pct = clampDiscountPct(discountPct);
  if (pct === 0) return safe;

  const listTotal = safe.reduce((s, c) => s + c, 0);
  if (listTotal === 0) return safe.map(() => 0);

  const target = Math.round((listTotal * (100 - pct)) / 100);

  // 1) Aşağı yuvarlaqlaşdırılmış paylar, 2) qalıq ən böyük kəsr hissəsi olanlara.
  const exact = safe.map((c) => (c * target) / listTotal);
  const floors = exact.map((v) => Math.floor(v));
  let remainder = target - floors.reduce((s, v) => s + v, 0);

  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);

  const result = floors.slice();
  for (let k = 0; k < order.length && remainder > 0; k++) {
    result[order[k].i] += 1;
    remainder -= 1;
  }

  // Qalıq hələ də varsa (bütün kəsrlər 0 olduqda) sıra ilə paylanır.
  for (let k = 0; remainder > 0; k = (k + 1) % result.length) {
    result[k] += 1;
    remainder -= 1;
  }

  return result;
}

/** Sətirlərdən cəm/qənaət/faiz çıxarır. `items` xaricində hər şeyi hesablayır. */
export function summarizeBundle(items: BundleItemPrice[]): Omit<BundlePricing, "items"> {
  const listTotalAznCents = items.reduce((s, i) => s + i.listAznCents, 0);
  const totalAznCents = items.reduce((s, i) => s + i.bundleAznCents, 0);
  const savingsAznCents = Math.max(0, listTotalAznCents - totalAznCents);
  const discountPct =
    listTotalAznCents > 0 ? Math.round((savingsAznCents / listTotalAznCents) * 100) : 0;
  return { listTotalAznCents, totalAznCents, savingsAznCents, discountPct };
}

/**
 * Paketin səbət payload-ı — rail kartı və detal səhifəsi EYNİ funksiyanı çağırır
 * ki, iki yerdən əlavə olunan paket səbətdə fərqli görünməsin.
 *
 * `finalAzn` yalnız göstərim üçündür: checkout serverdə qiyməti paket id-sinə
 * görə yenidən hesablayır.
 */
export function buildBundleCartPayload(bundle: BundleCardData) {
  return {
    id: bundle.id,
    title: bundle.title,
    imageUrl: bundle.imageUrl ?? bundle.pricing.items[0]?.imageUrl ?? null,
    finalAzn: bundle.pricing.totalAznCents / 100,
    productType: BUNDLE_PRODUCT_TYPE,
    bundleItems: bundle.pricing.items.map((i) => ({
      gameId: i.gameId,
      title: i.title,
      imageUrl: i.imageUrl,
      bundleAznCents: i.bundleAznCents,
    })),
  };
}

/** AZN qəpik → "12.50₼". Vitrin boyu eyni format işlədilir. */
export function formatAznCents(cents: number): string {
  return `${(Math.max(0, Math.round(cents)) / 100).toFixed(2)}₼`;
}
