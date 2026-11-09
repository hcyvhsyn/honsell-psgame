// Səbət ödənişinə əlavə olunan xidmət haqqı (komissiya). SAF, client-safe —
// səbət UI-si (CartView) və checkout serveri eyni funksiyanı işlədir ki,
// müştərinin gördüyü "Yekun" ilə kartdan/cüzdandan tutulan məbləğ üst-üstə düşsün.
//
// Bütün səbət ödəniş üsullarına tətbiq olunur (kart, Apple/Google Pay, taksit,
// cüzdan, referal balansı) — yoxsa müştəri cüzdanı komissiyasız artırıb
// komissiyadan yayına bilərdi. Baza = kupondan SONRAKI səbət cəmi.
// Taksitdə Epoint faizi bu məbləğin (baza + haqq) üstünə gəlir.
//
// ⚠️ Fulfillment, cashback, bonuslar və minimum sifariş haqqı DAXİL ETMƏDƏN
// səbət cəmi ilə işləyir — haqq məhsul dəyəri deyil.

export const CART_SERVICE_FEE_PCT = 3;

export function cartServiceFeeCents(baseCents: number): number {
  if (!Number.isFinite(baseCents) || baseCents <= 0) return 0;
  return Math.round((baseCents * CART_SERVICE_FEE_PCT) / 100);
}
