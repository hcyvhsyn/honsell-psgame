/**
 * Epoint taksit komissiyaları (%) — kart adı → ay sayı → faiz.
 *
 * Mənbə: Epoint kabineti → "Taksit parametrləri" (2026-10-25). API bu faizləri
 * QAYTARMIR (yalnız kart + ay siyahısı), ona görə burada saxlanılır. Kabinetdə
 * faiz dəyişəndə bu cədvəli yenilə — müştəri qiyməti buradan hesablanır.
 *
 * ⚠️ Cədvəldə olmayan kart/ay müştəriyə GÖSTƏRİLMİR: Epoint yeni müddət açsa,
 * faizi bilinməyən seçimlə zərərinə satış olmasın. YapiKredi-də ay seçimi yoxdur.
 *
 * Açar — kart adı kiçik hərflə (Epoint `installment_card_id`-si yox: id-lər
 * hesab səviyyəsindədir, ad isə kabinetdəki cədvəllə birbaşa üst-üstə düşür).
 */
export const INSTALLMENT_FEE_PCT: Record<string, Record<number, number>> = {
  tamkart: { 2: 3, 3: 4, 6: 7, 9: 10, 12: 13, 18: 20, 24: 26 },
  birkart: { 2: 4, 3: 5, 6: 9, 9: 12, 12: 15, 18: 20 },
  bolkart: { 3: 4, 6: 7, 9: 10, 12: 12, 18: 17, 24: 21 },
};

export function installmentFeePct(cardName: string, months: number): number | null {
  const pct = INSTALLMENT_FEE_PCT[cardName.trim().toLowerCase()]?.[months];
  return typeof pct === "number" && pct >= 0 && pct < 100 ? pct : null;
}
