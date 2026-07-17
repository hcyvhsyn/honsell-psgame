/**
 * Kupon scope-u üçün paylaşılan sabitlər — həm admin UI ("use client"), həm də
 * admin API işlədir. Prisma-ya TOXUNMUR (client import zənciri build-i qırır).
 *
 * Siyahı /api/cart/checkout-un HƏQİQƏTƏN yüklədiyi növlərlə eynidir. Burada
 * olmayan bir dəyər (məs. StreamingPlatform.category olan "MUSIC") heç bir
 * səbət sətri ilə uyğunlaşmaz və kupon istifadə anında xəta verərdi.
 */
export const PROMO_SCOPE_PRODUCT_TYPES = [
  "GAME",
  "PS_PLUS",
  "EA_PLAY",
  "TRY_BALANCE",
  "POINT_BLANK_TG",
  "ACCOUNT_CREATION",
  "EPIC_ACCOUNT_CREATION",
  "STREAMING",
  "PLATFORM",
  "HONSELL_GIFT_CARD",
] as const;

export const PROMO_SCOPE_TYPE_LABELS: Record<string, string> = {
  GAME: "Oyunlar",
  PS_PLUS: "PS Plus",
  EA_PLAY: "EA Play",
  TRY_BALANCE: "TRY balans",
  POINT_BLANK_TG: "Point Blank TG",
  ACCOUNT_CREATION: "PSN hesab açılışı",
  EPIC_ACCOUNT_CREATION: "Epic hesab açılışı",
  STREAMING: "Streaming",
  PLATFORM: "Platformalar (Spotify, YouTube, LinkedIn…)",
  HONSELL_GIFT_CARD: "Honsell hədiyyə kartı",
};
