// Ana səhifədəki "Abunəlik paketləri" vitrinini idarə edən ortaq konstantlar.
// Həm `app/page.tsx` (vitrini göstərən), həm də admin paneli
// (`/admin/subscription-packages`) buradan istifadə edir ki, tip siyahısı və
// "landing-dən gizlət" açarı tək yerdən idarə olunsun.

import { readPlatformMeta } from "./platformSubscriptions";

export const LANDING_SERVICE_TYPES = [
  "PS_PLUS",
  "EA_PLAY",
  "STREAMING",
  "PLATFORM",
  "PUBG_UC",
  "POINT_BLANK_TG",
] as const;

export type LandingServiceType = (typeof LANDING_SERVICE_TYPES)[number];

export const LANDING_SERVICE_ORDER = new Map<string, number>(
  LANDING_SERVICE_TYPES.map((type, index) => [type, index]),
);

/** Admin UI-da göstərilən qısa tip etiketləri. */
export const LANDING_SERVICE_TYPE_LABELS: Record<string, string> = {
  PS_PLUS: "PS Plus",
  EA_PLAY: "EA Play",
  STREAMING: "Streaming",
  PLATFORM: "Platforma",
  PUBG_UC: "PUBG UC",
  POINT_BLANK_TG: "Point Blank TG",
};

/**
 * Məhsulun metadata-sında `hideFromLanding: true` varsa, o, ana səhifədəki
 * "Abunəlik paketləri" vitrinindən çıxarılır (öz səhifəsində və satışda qalır).
 */
export function isHiddenFromLanding(metadata: unknown): boolean {
  return (
    !!metadata &&
    typeof metadata === "object" &&
    !Array.isArray(metadata) &&
    (metadata as Record<string, unknown>).hideFromLanding === true
  );
}

/**
 * Bu məhsul checkout-da müştəridən hesab məlumatı (email/şifrə) tələb edirmi?
 * Vitrindəki "səbətə əlavə et" düyməsi belə məhsulları birbaşa səbətə atmamalıdır —
 * əks halda məlumat boş qalır və checkout `... hesab (email və şifrə) tələb olunur`
 * xətası ilə bloklanır. Bunun əvəzinə düymə məhsulun öz səhifəsinə yönləndirir.
 *
 * Məntiq `app/api/cart/checkout/route.ts` ilə eyni saxlanmalıdır.
 */
export function landingServiceRequiresAccount(type: string, metadata: unknown): boolean {
  const meta =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};

  if (type === "STREAMING") {
    return String(meta.deliveryMode ?? "CODE") === "GMAIL";
  }

  if (type === "PLATFORM") {
    const platform = readPlatformMeta(meta);
    if (platform.accountSlots && platform.accountSlots >= 1) return true;
    if (platform.category === "MUSIC" && platform.musicBrand === "YOUTUBE_PREMIUM") return true;
    if (
      platform.category === "WORK" &&
      (platform.planType === "CAREER" || platform.planType === "BUSINESS")
    ) {
      return true;
    }
    return false;
  }

  return false;
}
