// Ana səhifədəki "Abunəlik paketləri" vitrinini idarə edən ortaq konstantlar.
// Həm `app/page.tsx` (vitrini göstərən), həm də admin paneli
// (`/admin/subscription-packages`) buradan istifadə edir ki, tip siyahısı və
// "landing-dən gizlət" açarı tək yerdən idarə olunsun.

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
