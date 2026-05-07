/**
 * Rəy affiliate sistemi üçün yalnız sabitlər. Burada `next/headers`,
 * Prisma və ya hər hansı server-only API istifadə olunmur — fayl həm
 * client component-lərdən, həm də middleware-dən təhlükəsiz idxal edilə bilər.
 */

export const REVIEW_AFFILIATE_COOKIE = "hs_review_via";

/** Validation şərtləri — backend və UI arasında paylaşılan sabitlər. */
export const REVIEW_BODY_MIN = 200;
export const REVIEW_BODY_MAX = 5000;
export const REVIEW_RATING_MIN = 1;
export const REVIEW_RATING_MAX = 5;
export const REVIEW_COMMENT_BODY_MIN = 1;
export const REVIEW_COMMENT_BODY_MAX = 1000;
