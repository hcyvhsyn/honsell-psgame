/**
 * Yeni platforma kateqoriyaları (Musiqi, Süni İntellekt, İş Platformaları).
 *
 * Streaming-dən fərqli olaraq, bu məhsulların alt-kateqoriyaları yoxdur — admin
 * hər məhsulu (Spotify Premium, Claude Plus, və s.) əl ilə əlavə edir.
 *
 * Verilənlər `ServiceProduct` cədvəlində saxlanılır:
 *   type     = "PLATFORM"
 *   metadata = { category: "MUSIC"|"AI"|"WORK", terms?: string,
 *                originalPriceAznCents?: number, durationMonths?: number,
 *                referralPct?: number, referralEnabled?: boolean }
 */

export type PlatformCategory = "MUSIC" | "AI" | "WORK";

export const PLATFORM_CATEGORY_LABELS: Record<PlatformCategory, string> = {
  MUSIC: "Musiqi Platformaları",
  AI: "Süni İntellekt",
  WORK: "İş Platformaları",
};

export const PLATFORM_CATEGORY_PUBLIC_PATH: Record<PlatformCategory, string> = {
  MUSIC: "/music",
  AI: "/ai",
  WORK: "/work",
};

export const PLATFORM_CATEGORIES: PlatformCategory[] = ["MUSIC", "AI", "WORK"];

export function isValidPlatformCategory(s: string): s is PlatformCategory {
  return PLATFORM_CATEGORIES.includes(s as PlatformCategory);
}

export type PlatformProductMetadata = {
  category: PlatformCategory;
  terms?: string;
  originalPriceAznCents?: number;
  durationMonths?: number;
  referralPct?: number;
  referralEnabled: boolean;
};

export function readPlatformMeta(
  raw: Record<string, unknown> | null | undefined
): PlatformProductMetadata {
  const m = raw ?? {};
  const cat = String(m.category ?? "");
  const opc = Number(m.originalPriceAznCents);
  const durationMonths = Number(m.durationMonths);
  const referralPct = Number(m.referralPct);
  return {
    category: isValidPlatformCategory(cat) ? cat : "MUSIC",
    terms: typeof m.terms === "string" ? m.terms : undefined,
    originalPriceAznCents: Number.isFinite(opc) && opc > 0 ? opc : undefined,
    durationMonths:
      Number.isInteger(durationMonths) && durationMonths > 0 ? durationMonths : undefined,
    referralPct:
      Number.isFinite(referralPct) && referralPct >= 0 ? Math.min(100, referralPct) : undefined,
    referralEnabled: m.referralEnabled !== false,
  };
}
