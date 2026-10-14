// Sebet üçün biznes-qaydaları. Həm server (checkout API), həm client (CartView,
// CartIndicator, səbətə-əlavə toast-u) eyni dəyəri istifadə etsin deyə ortaq
// saxlayırıq. Client-safe SAF modul — prisma import ETMƏ.

/**
 * Minimum sifariş məbləği (AZN). Səbətin cəmi bundan azdırsa checkout HƏR
 * ödəniş üsulunda bloklanır (cüzdan, referal, kart).
 *
 * ⚠️ Müqayisə KUPONDAN ƏVVƏLKİ cəmlə aparılır (məhsulların endirimli qiymətlərinin
 * cəmi) — müştəri proqres zolağında gördüyü rəqəmlə kassada fərqli nəticə
 * almasın. Kupon tətbiqi minimumu "pozmur".
 *
 * Dəyişmək üçün yalnız bu rəqəmi dəyiş — server, səbət zolağı, header halqası
 * və toast birlikdə yenilənir.
 */
export const MIN_ORDER_AZN = 20;
export const MIN_ORDER_AZN_CENTS = MIN_ORDER_AZN * 100;

/**
 * Epoint-in minimum işləm məbləği. `MIN_ORDER_AZN` bundan böyük olduğu müddətcə
 * kartla round-up (fərqin cüzdana qaytarılması) praktikada işə düşmür, amma
 * kupon cəmi 5 AZN-dən aşağı salarsa gateway yenə də rədd etməsin deyə qalır.
 */
export const EPOINT_MIN_CHARGE_AZN_CENTS = 500;

export type MinOrderProgress = {
  /** Səbətin cari cəmi, qəpik. */
  totalCents: number;
  /** Minimuma çatmaq üçün qalan, qəpik (çatıbsa 0). */
  missingCents: number;
  /** 0..1 */
  ratio: number;
  reached: boolean;
};

/** Səbət cəmindən minimum-sifariş proqresini hesablayır (bütün UI-lar bunu oxuyur). */
export function minOrderProgress(totalAzn: number): MinOrderProgress {
  const totalCents = Math.max(0, Math.round(totalAzn * 100));
  const missingCents = Math.max(0, MIN_ORDER_AZN_CENTS - totalCents);
  return {
    totalCents,
    missingCents,
    ratio: Math.min(1, totalCents / MIN_ORDER_AZN_CENTS),
    reached: missingCents === 0,
  };
}

/** Server tərəfi: bu cəmlə sifariş qəbul olunurmu? */
export function meetsMinOrder(totalCents: number): boolean {
  return totalCents >= MIN_ORDER_AZN_CENTS;
}

/** Müştəriyə göstərilən xəta mətni (server + client eyni mətn). */
export function minOrderMessage(totalCents: number): string {
  const missing = Math.max(0, MIN_ORDER_AZN_CENTS - totalCents) / 100;
  return `Minimum sifariş məbləği ${MIN_ORDER_AZN} AZN-dir. Səbətə daha ${missing.toFixed(2)} AZN-lik məhsul əlavə et.`;
}
