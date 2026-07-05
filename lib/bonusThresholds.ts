/**
 * Bonus mükafat hədləri — client-safe SABİTLƏR (prisma/import yoxdur).
 * Həm server (lib/checkoutBonuses.ts), həm client (components/cart/BonusProgress.tsx)
 * eyni dəyərlərdən istifadə etsin deyə ayrıca saxlanılır.
 */
export const BONUS_WALLET_MIN_CENTS = 1200; // 12 AZN
export const BONUS_WALLET_CREDIT_CENTS = 100; // 1 AZN
export const BONUS_COUPON_MIN_CENTS = 2000; // 20 AZN
export const BONUS_COMMUNITY_MIN_ITEMS = 2;
export const BONUS_COUPON_PERCENT = 10;
export const BONUS_COUPON_VALID_DAYS = 30;
