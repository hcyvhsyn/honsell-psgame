/**
 * Honsell hədiyyə kartı kodları — 11 simvollu, böyük hərf/rəqəm.
 * Mümkün qarışıqlığa yol verə biləcək simvollar (0/O, 1/I/L) istisna edilir
 * ki, müştəri əl ilə kodu yazarkən səhv etməsin.
 *
 * Bu fayl server-only asılılıqlarından (prisma, node:crypto) azaddır,
 * ona görə client komponentlərdə də import oluna bilər.
 */
export const HONSELL_GIFT_CARD_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const HONSELL_GIFT_CARD_CODE_LENGTH = 11;
export const HONSELL_GIFT_CARD_VALIDITY_DAYS = 365;
export const HONSELL_GIFT_CARD_SERVICE_TYPE = "HONSELL_GIFT_CARD";

/** Stabil ServiceProduct id-ləri (migration-da seed olunur). */
export const HONSELL_GIFT_CARD_PRODUCT_IDS = [
  "hsl-giftcard-5",
  "hsl-giftcard-10",
  "hsl-giftcard-20",
  "hsl-giftcard-50",
  "hsl-giftcard-100",
  "hsl-giftcard-200",
  "hsl-giftcard-500",
  "hsl-giftcard-1000",
] as const;

/** İstifadəçi inputu — defislər, boşluqlar silinir, hər şey upper-case olur. */
export function normalizeHonsellGiftCardCode(raw: string): string {
  return raw.replace(/[\s-]+/g, "").toUpperCase();
}

export function isValidHonsellGiftCardFormat(code: string): boolean {
  if (code.length !== HONSELL_GIFT_CARD_CODE_LENGTH) return false;
  for (const ch of code) {
    if (!HONSELL_GIFT_CARD_CODE_ALPHABET.includes(ch)) return false;
  }
  return true;
}

/** Format: AAAA-BBB-CCCC (görüntüləmə üçün). Saxlanan dəyər həmişə defisiz. */
export function formatHonsellGiftCardCode(code: string): string {
  if (code.length !== HONSELL_GIFT_CARD_CODE_LENGTH) return code;
  return `${code.slice(0, 4)}-${code.slice(4, 7)}-${code.slice(7)}`;
}
