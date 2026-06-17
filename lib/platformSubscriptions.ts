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

export type AiBrand = "CLAUDE" | "CHATGPT" | "OTHER";

export const AI_BRANDS: AiBrand[] = ["CLAUDE", "CHATGPT", "OTHER"];

export const AI_BRAND_LABELS: Record<AiBrand, string> = {
  CLAUDE: "Claude",
  CHATGPT: "ChatGPT",
  OTHER: "Digər",
};

export const AI_BRAND_SLUGS: Record<Exclude<AiBrand, "OTHER">, string> = {
  CLAUDE: "claude",
  CHATGPT: "chatgpt",
};

export function isValidAiBrand(s: string): s is AiBrand {
  return AI_BRANDS.includes(s as AiBrand);
}

// Music kateqoriyasında alt-brend tipi. Brand "YOUTUBE_PREMIUM" olduqda paket
// /music/youtube səhifəsində göstərilir; "GENERIC" olduqda yalnız /music
// listing-də qalır.
export type MusicBrand = "GENERIC" | "YOUTUBE_PREMIUM";

export const MUSIC_BRANDS: MusicBrand[] = ["GENERIC", "YOUTUBE_PREMIUM"];

export const MUSIC_BRAND_LABELS: Record<MusicBrand, string> = {
  GENERIC: "Ümumi (musiqi siyahısı)",
  YOUTUBE_PREMIUM: "YouTube Premium",
};

export function isValidMusicBrand(s: string): s is MusicBrand {
  return MUSIC_BRANDS.includes(s as MusicBrand);
}

// İş Platformaları kateqoriyasında LinkedIn Premium variantları üçün — admin
// panel hər ServiceProduct rekorduna planType və populyarlıq bayrağı qoyur ki,
// /work/linkedin-premium səhifəsi Career/Business qruplarını qura bilsin.
export type WorkPlanType = "CAREER" | "BUSINESS";

export const WORK_PLAN_TYPES: WorkPlanType[] = ["CAREER", "BUSINESS"];

export const WORK_PLAN_TYPE_LABELS: Record<WorkPlanType, string> = {
  CAREER: "LinkedIn Premium · Career",
  BUSINESS: "LinkedIn Premium · Business",
};

export function isValidWorkPlanType(s: string): s is WorkPlanType {
  return WORK_PLAN_TYPES.includes(s as WorkPlanType);
}

// Çoxhesablı musiqi planları (məs. Spotify Premium). Hər plan tipi fərqli sayda
// hesab (email+şifrə cütü) tələb edir — dəqiq say `accountSlots` ilə verilir.
export type SpotifyPlanTier = "INDIVIDUAL" | "DUO" | "FAMILY";

export const SPOTIFY_PLAN_TIERS: SpotifyPlanTier[] = ["INDIVIDUAL", "DUO", "FAMILY"];

export const SPOTIFY_PLAN_LABELS: Record<SpotifyPlanTier, string> = {
  INDIVIDUAL: "Individual",
  DUO: "Duo",
  FAMILY: "Family",
};

// Plan seçiləndə standart hesab slotu sayı (admin paket üzrə dəyişə bilər).
export const SPOTIFY_PLAN_DEFAULT_SLOTS: Record<SpotifyPlanTier, number> = {
  INDIVIDUAL: 1,
  DUO: 2,
  FAMILY: 5,
};

export function isValidSpotifyPlanTier(s: string): s is SpotifyPlanTier {
  return SPOTIFY_PLAN_TIERS.includes(s as SpotifyPlanTier);
}

export type PlatformProductMetadata = {
  category: PlatformCategory;
  terms?: string;
  originalPriceAznCents?: number;
  durationMonths?: number;
  referralPct?: number;
  referralEnabled: boolean;
  aiBrand?: AiBrand;
  musicBrand?: MusicBrand;
  /// LinkedIn variantları üçün plan tipi (yalnız WORK kateqoriyası).
  planType?: WorkPlanType;
  /// Çoxhesablı musiqi planı tipi (məs. Spotify Individual/Duo/Family).
  planTier?: SpotifyPlanTier;
  /// Checkout-da tələb olunan hesab (email+şifrə) cütlərinin sayı. ≥1 olduqda
  /// müştəri bu qədər hesab daxil etməlidir (məs. Duo=2, Family=5).
  accountSlots?: number;
  /// "Populyar" rozetkası ilə qabardılan variant.
  isPopular?: boolean;
};

export function readPlatformMeta(
  raw: Record<string, unknown> | null | undefined
): PlatformProductMetadata {
  const m = raw ?? {};
  const cat = String(m.category ?? "");
  const opc = Number(m.originalPriceAznCents);
  const durationMonths = Number(m.durationMonths);
  const referralPct = Number(m.referralPct);
  const aiBrandRaw = String(m.aiBrand ?? "");
  const musicBrandRaw = String(m.musicBrand ?? "");
  const planTypeRaw = String(m.planType ?? "").toUpperCase();
  const planTierRaw = String(m.planTier ?? "").toUpperCase();
  const accountSlots = Number(m.accountSlots);
  return {
    category: isValidPlatformCategory(cat) ? cat : "MUSIC",
    terms: typeof m.terms === "string" ? m.terms : undefined,
    originalPriceAznCents: Number.isFinite(opc) && opc > 0 ? opc : undefined,
    durationMonths:
      Number.isInteger(durationMonths) && durationMonths > 0 ? durationMonths : undefined,
    referralPct:
      Number.isFinite(referralPct) && referralPct >= 0 ? Math.min(100, referralPct) : undefined,
    referralEnabled: m.referralEnabled !== false,
    aiBrand: isValidAiBrand(aiBrandRaw) ? aiBrandRaw : undefined,
    musicBrand: isValidMusicBrand(musicBrandRaw) ? musicBrandRaw : undefined,
    planType: isValidWorkPlanType(planTypeRaw) ? planTypeRaw : undefined,
    planTier: isValidSpotifyPlanTier(planTierRaw) ? planTierRaw : undefined,
    accountSlots:
      Number.isInteger(accountSlots) && accountSlots >= 1 ? accountSlots : undefined,
    isPopular: Boolean(m.isPopular),
  };
}
