/**
 * FAQ və PlatformGuide üçün ortaq scope tərifləri. Admin paneldə tab-ları və
 * public səhifədə filterləri sinxron saxlamaq üçün burda mərkəzləşdirilib.
 *
 * Yeni platforma əlavə olunduqda burda yeni scope əlavə etmək kifayətdir —
 * admin UI avtomatik yeni tab göstərəcək.
 */

import { STREAMING_SERVICES, STREAMING_SERVICE_LABELS } from "./streamingCart";

export type ContentScope =
  | "HOME"
  | "PLAYSTATION"
  | "STREAMING_OVERVIEW"
  | `STREAMING_${string}`;

export type ContentScopeOption = {
  key: string;
  label: string;
  /// Bu scope-un public olaraq göstərildiyi path-ı (kontekst üçün admin panelə yazılır).
  description: string;
};

export const FAQ_SCOPES: ContentScopeOption[] = [
  { key: "HOME", label: "Ana səhifə", description: "/" },
  { key: "PLAYSTATION", label: "PlayStation", description: "/playstation" },
  { key: "STREAMING_OVERVIEW", label: "Streaming (Ümumi)", description: "/streaming" },
  ...STREAMING_SERVICES.map((s) => ({
    key: `STREAMING_${s}`,
    label: `${STREAMING_SERVICE_LABELS[s] ?? s}`,
    description: `/streaming/${s.toLowerCase().replace("_", "-")}`,
  })),
  { key: "LINKEDIN_PREMIUM", label: "LinkedIn Premium", description: "/work/linkedin-premium" },
];

/** PlatformGuide eyni scope-lardan istifadə edir. */
export const PLATFORM_GUIDE_SCOPES = FAQ_SCOPES;

/**
 * Xəbərlər üçün scope-lar — `FAQ_SCOPES`-un alt-çoxluğu (eynidir).
 * Burada ayrıca dəyişən saxlayırıq ki, sabaha xəbərlər üçün yeni scope əlavə etmək
 * istəsək FAQ-a toxunmadan edə bilək.
 */
export const NEWS_SCOPES = FAQ_SCOPES;

/**
 * Banner scope-ları — bütün bannerlər (HOME, PlayStation, Streaming) tək admin
 * səhifəsindən idarə olunur. Hər scope öz public render hədəfinə uyğundur.
 */
export const BANNER_SCOPES: ContentScopeOption[] = [
  { key: "HOME", label: "Ana səhifə", description: "/ səhifəsində göstərilir" },
  { key: "PLAYSTATION", label: "PlayStation", description: "/playstation səhifəsində" },
  { key: "STREAMING_OVERVIEW", label: "Streaming (Ümumi)", description: "/streaming səhifəsində" },
  ...STREAMING_SERVICES.map((s) => ({
    key: `STREAMING_${s}`,
    label: `Streaming · ${STREAMING_SERVICE_LABELS[s] ?? s}`,
    description: `/streaming/${s.toLowerCase().replace("_", "-")}`,
  })),
];

export function isValidContentScope(s: string): boolean {
  return FAQ_SCOPES.some((o) => o.key === s);
}

export function isValidBannerScope(s: string): boolean {
  return BANNER_SCOPES.some((o) => o.key === s);
}
