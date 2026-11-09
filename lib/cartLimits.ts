// Sebet üçün biznes-qaydaları. Həm server (checkout API), həm client (CartView,
// CartIndicator, səbətə-əlavə toast-u) eyni dəyəri istifadə etsin deyə ortaq
// saxlayırıq. Client-safe SAF modul — prisma import ETMƏ.

/**
 * Minimum sifariş məbləği (AZN) — YALNIZ PlayStation-a aid məhsullara tətbiq olunur
 * (2026-11). Səbətin PS hissəsi (`minOrderBaseCents`) 0-dan böyük, amma bundan azdırsa
 * checkout HƏR ödəniş üsulunda bloklanır (cüzdan, referal, kart). Abunəliklər
 * (`MIN_ORDER_EXEMPT_TYPES` — Netflix, HBO Max, Spotify, YouTube) tək alına bilir və
 * PS hissəsinə SAYILMIR: 8 ₼ Netflix + 12 ₼ oyun = PS hissəsi 12 ₼ → bloklanır.
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

/**
 * Minimumdan azad məhsul tipləri — PlayStation-a aid OLMAYAN abunəliklər:
 * `STREAMING` (Netflix, HBO Max …) və `PLATFORM` (Spotify, YouTube Premium …).
 * Qalan HƏR tip (oyun, PS Plus, EA Play, TRY balans, PSN hesabı, hədiyyə kartı, yeni
 * tiplər) minimuma sayılır — yeni tip əlavə olunanda default təhlükəsiz tərəfdir.
 */
export const MIN_ORDER_EXEMPT_TYPES: readonly string[] = ["STREAMING", "PLATFORM"];

/** Bu tip minimum sifariş bazasına (PS hissəsinə) sayılırmı? */
export function countsTowardMinOrder(productType: string | null | undefined): boolean {
  return !MIN_ORDER_EXEMPT_TYPES.includes(String(productType ?? "").toUpperCase());
}

export type MinOrderBaseItem = {
  productType: string;
  finalAzn: number;
  qty: number;
  /** Dəst sətri: üzvlər ayrı-ayrı sayılır (server dəsti üzvlərinə açır). */
  serviceBundleItems?: Array<{ serviceType: string; bundleAznCents: number }>;
};

/**
 * Səbətin minimuma sayılan (PlayStation) hissəsi, qəpik — client tərəfi. Server
 * (`checkout/route.ts`) eyni qaydanı açılmış sətirlərin `kind`-i ilə tətbiq edir.
 */
export function minOrderBaseCents(items: readonly MinOrderBaseItem[]): number {
  let cents = 0;
  for (const i of items) {
    const qty = Math.max(1, i.qty || 1);
    if (i.serviceBundleItems?.length) {
      for (const m of i.serviceBundleItems) {
        if (countsTowardMinOrder(m.serviceType)) cents += m.bundleAznCents * qty;
      }
    } else if (countsTowardMinOrder(i.productType)) {
      cents += Math.round(i.finalAzn * 100) * qty;
    }
  }
  return cents;
}

export type MinOrderProgress = {
  /** Səbətin minimuma sayılan (PS) hissəsi, qəpik. */
  totalCents: number;
  /** Səbətdə PS məhsulu varmı — yoxdursa minimum ümumiyyətlə tətbiq olunmur. */
  applies: boolean;
  /** Minimuma çatmaq üçün qalan, qəpik (çatıbsa 0). */
  missingCents: number;
  /** 0..1 */
  ratio: number;
  reached: boolean;
};

/**
 * PS hissəsindən minimum-sifariş proqresini hesablayır (bütün UI-lar bunu oxuyur).
 * Arqument `minOrderBaseCents(items) / 100`-dür, səbətin ÜMUMİ cəmi YOX.
 */
export function minOrderProgress(psTotalAzn: number): MinOrderProgress {
  const totalCents = Math.max(0, Math.round(psTotalAzn * 100));
  const applies = totalCents > 0;
  const missingCents = applies ? Math.max(0, MIN_ORDER_AZN_CENTS - totalCents) : 0;
  return {
    totalCents,
    applies,
    missingCents,
    ratio: Math.min(1, totalCents / MIN_ORDER_AZN_CENTS),
    reached: missingCents === 0,
  };
}

/**
 * Server tərəfi: PS hissəsi bu qədər olan sifariş qəbul olunurmu? 0 = səbətdə yalnız
 * abunəlik var → minimum yoxdur.
 */
export function meetsMinOrder(psTotalCents: number): boolean {
  return psTotalCents <= 0 || psTotalCents >= MIN_ORDER_AZN_CENTS;
}

/** Müştəriyə göstərilən xəta mətni (server + client eyni mətn). */
export function minOrderMessage(psTotalCents: number): string {
  const missing = Math.max(0, MIN_ORDER_AZN_CENTS - psTotalCents) / 100;
  return `PlayStation məhsullarında minimum sifariş ${MIN_ORDER_AZN} AZN-dir (abunəliklər sayılmır). Daha ${missing.toFixed(2)} AZN-lik PlayStation məhsulu əlavə et.`;
}
