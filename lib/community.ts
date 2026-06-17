// Honsell İcması — sərbəst topluluq divarının ortaq sabitləri və validasiyası.
// Həm API route-ları, həm public/admin UI bu modulu istifadə edir ki, limit və
// kateqoriya tərifləri tək yerdə qalsın.

export const COMMUNITY_POST_BODY_MIN = 10;
export const COMMUNITY_POST_BODY_MAX = 2000;
export const COMMUNITY_POST_TITLE_MAX = 120;

export const COMMUNITY_COMMENT_BODY_MIN = 1;
export const COMMUNITY_COMMENT_BODY_MAX = 1000;

// ─── Spam əleyhinə interval limitləri (cooldown) ─────────────────────────────
// Paylaşım (fikir) 5 dəqiqədən bir, icmal (rəy) və şərh isə 30 saniyədən bir
// göndərilə bilər. Server tərəfdə son yazının vaxtı ilə müqayisə olunur.
export const COMMUNITY_POST_COOLDOWN_MS = 5 * 60 * 1000;
export const COMMUNITY_REVIEW_COOLDOWN_MS = 30 * 1000;
export const COMMUNITY_COMMENT_COOLDOWN_MS = 30 * 1000;

/** Son yazıdan sonra qalan gözləmə müddəti (ms). Limit keçilibsə 0 qaytarır. */
export function cooldownRemainingMs(
  lastAt: Date | null | undefined,
  windowMs: number,
): number {
  if (!lastAt) return 0;
  const remaining = windowMs - (Date.now() - lastAt.getTime());
  return remaining > 0 ? remaining : 0;
}

/** Gözləmə müddətini müştəriyə oxunaqlı formada göstərir ("2 dəq 14 san"). */
export function formatWait(ms: number): string {
  const totalSec = Math.max(1, Math.ceil(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min > 0) return sec > 0 ? `${min} dəq ${sec} san` : `${min} dəq`;
  return `${sec} san`;
}

export type CommunityCategory =
  | "GENERAL"
  | "SERIAL"
  | "OYUN"
  | "ENDIRIM"
  | "SUAL";

export type CommunityCategoryDef = {
  key: CommunityCategory;
  label: string;
  description: string;
  /** Tailwind rəng açarı — UI badge-ləri üçün (məs: "violet"). */
  accent: string;
};

export const COMMUNITY_CATEGORIES: CommunityCategoryDef[] = [
  {
    key: "GENERAL",
    label: "Ümumi",
    description: "İstənilən mövzuda söhbət",
    accent: "violet",
  },
  {
    key: "SERIAL",
    label: "Serial & Film",
    description: "İzlədiyin serial və filmlər",
    accent: "fuchsia",
  },
  {
    key: "OYUN",
    label: "Oyun",
    description: "Oyun təcrübələri və tövsiyələr",
    accent: "emerald",
  },
  {
    key: "ENDIRIM",
    label: "Endirim & Təklif",
    description: "Tapdığın sərfəli təkliflər",
    accent: "amber",
  },
  {
    key: "SUAL",
    label: "Sual",
    description: "İcmadan kömək istə",
    accent: "sky",
  },
];

const CATEGORY_KEYS = new Set<string>(COMMUNITY_CATEGORIES.map((c) => c.key));

export function isValidCommunityCategory(value: unknown): value is CommunityCategory {
  return typeof value === "string" && CATEGORY_KEYS.has(value);
}

/** Naməlum dəyəri etibarlı kateqoriyaya çevirir (default: GENERAL). */
export function normalizeCommunityCategory(value: unknown): CommunityCategory {
  return isValidCommunityCategory(value) ? value : "GENERAL";
}

export function communityCategoryDef(key: string): CommunityCategoryDef {
  return (
    COMMUNITY_CATEGORIES.find((c) => c.key === key) ?? COMMUNITY_CATEGORIES[0]
  );
}

// ─── Moderasiya səbəblərinin müştəriyə göstərilən izahı ───────────────────────
// communityModeration.ts (AI + lokal fallback) bu kodları qaytarır; UI bunları
// dostca mesaja çevirir ki, paylaşımın niyə dayandığı müştəriyə aydın olsun.
const COMMUNITY_BLOCK_REASON_LABELS: Record<string, string> = {
  AD: "Mesajda reklam, xarici link və ya əlaqə məlumatı (nömrə, sosial hesab) var.",
  SPAM: "Mesaj spam kimi qiymətləndirildi.",
  PROFANITY: "Mesajda söyüş və ya təhqiramiz ifadə var.",
  HARASSMENT: "Mesaj kimisə təhqir edən və ya hədələyən xarakter daşıyır.",
  HATE: "Mesajda nifrət nitqi aşkarlandı.",
  SEXUAL: "Mesajda uyğunsuz (cinsi) məzmun var.",
  THREAT: "Mesajda hədə-qorxu var.",
};

const COMMUNITY_BLOCK_REASON_FALLBACK = "Mesaj icma qaydalarına uyğun deyil.";

/** Səbəb kodunu müştəriyə göstəriləcək Azərbaycan dilində izaha çevirir. */
export function communityBlockReasonText(reason?: string | null): string {
  if (!reason) return COMMUNITY_BLOCK_REASON_FALLBACK;
  return COMMUNITY_BLOCK_REASON_LABELS[reason] ?? COMMUNITY_BLOCK_REASON_FALLBACK;
}
