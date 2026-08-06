/**
 * WhatsApp rəy dəvətində admin-in seçə biləcəyi rəy kateqoriyası (Testimonial.platform).
 * Boş ("") = avtomatik: kateqoriya seçilmiş məhsulun tipindən götürülür.
 *
 * DİQQƏT: Bu fayl "use client" komponentindən import olunur — lib/prisma-ya
 * çatan heç nə import etməməlidir (bax: client-import-prisma-build-trap).
 */

export const REVIEW_CATEGORY_OPTIONS: { code: string; label: string }[] = [
  { code: "", label: "Avtomatik (məhsula görə)" },
  { code: "GAME", label: "Oyun" },
  { code: "EPIC_GAMES", label: "Epic Games" },
  { code: "EA_PLAY", label: "EA Play" },
  { code: "PS_PLUS", label: "PS Plus" },
  { code: "GIFT_CARD", label: "Hədiyyə kartı" },
  { code: "ACCOUNT_CREATION", label: "Hesab açma" },
  { code: "STREAMING", label: "Streaming" },
  { code: "MUSIC", label: "Musiqi" },
  { code: "GENERAL", label: "Ümumi" },
];

// Admin-in əl ilə seçə biləcəyi override dəyərləri (boş = avtomatik).
const OVERRIDE_CODES = new Set(
  REVIEW_CATEGORY_OPTIONS.map((o) => o.code).filter(Boolean)
);

export function isReviewCategoryOverride(v: unknown): v is string {
  return typeof v === "string" && OVERRIDE_CODES.has(v);
}
