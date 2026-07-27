/**
 * Çəkiliş qalibləri + qalib rəyləri üçün CLIENT-SAFE sabitlər, etiketlər və saf
 * köməkçilər. Prisma import ETMİR — həm client komponentlərdən, həm də saf
 * unit testlərdən istifadə oluna bilər. Server-side (prisma) məntiq
 * `@/lib/giveawayWinners`-dədir.
 */

// ─── Enum-benzəri sabitlər (String sütunlar + app validasiyası) ───────────────

export const WINNER_SOURCES = [
  "WEBSITE_ENTRY",
  "INSTAGRAM",
  "WHATSAPP",
  "TELEGRAM",
  "OFFLINE",
  "MANUAL_OTHER",
] as const;
export type WinnerSource = (typeof WINNER_SOURCES)[number];

export const SELECTION_METHODS = ["RANDOM", "MANUAL", "EXTERNAL"] as const;
export type SelectionMethod = (typeof SELECTION_METHODS)[number];

export const REVIEW_SOURCES = [
  "WEBSITE",
  "WHATSAPP",
  "INSTAGRAM",
  "TELEGRAM",
  "EMAIL",
  "STORE_NOTE",
] as const;
export type ReviewSource = (typeof REVIEW_SOURCES)[number];

export const REVIEW_ENTRY_METHODS = [
  "USER_SUBMITTED",
  "ADMIN_TRANSCRIBED",
  "ADMIN_STORE_NOTE",
] as const;
export type ReviewEntryMethod = (typeof REVIEW_ENTRY_METHODS)[number];

export const REVIEW_STATUSES = ["PENDING", "APPROVED", "REJECTED", "HIDDEN"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

// ─── Etiketlər (admin UI) ─────────────────────────────────────────────────────

export const WINNER_SOURCE_LABELS: Record<WinnerSource, string> = {
  WEBSITE_ENTRY: "Sayt iştirakçısı",
  INSTAGRAM: "Instagram",
  WHATSAPP: "WhatsApp",
  TELEGRAM: "Telegram",
  OFFLINE: "Offline / fiziki",
  MANUAL_OTHER: "Digər (manual)",
};
export function winnerSourceLabel(v: string): string {
  return WINNER_SOURCE_LABELS[v as WinnerSource] ?? v;
}

export const SELECTION_METHOD_LABELS: Record<SelectionMethod, string> = {
  RANDOM: "Random",
  MANUAL: "Manual",
  EXTERNAL: "Xarici qalib",
};
export function selectionMethodLabel(v: string): string {
  return SELECTION_METHOD_LABELS[v as SelectionMethod] ?? v;
}

export const REVIEW_SOURCE_LABELS: Record<ReviewSource, string> = {
  WEBSITE: "Sayt",
  WHATSAPP: "WhatsApp",
  INSTAGRAM: "Instagram",
  TELEGRAM: "Telegram",
  EMAIL: "E-mail",
  STORE_NOTE: "Mağaza qeydi",
};
export function reviewSourceLabel(v: string): string {
  return REVIEW_SOURCE_LABELS[v as ReviewSource] ?? v;
}

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  PENDING: "Gözləyir",
  APPROVED: "Təsdiqlənib",
  REJECTED: "Rədd edilib",
  HIDDEN: "Gizli",
};
export function reviewStatusLabel(v: string): string {
  return REVIEW_STATUS_LABELS[v as ReviewStatus] ?? v;
}

// ─── İctimai şəffaflıq etiketi ────────────────────────────────────────────────

/** Mağaza açıqlaması bloku başlığı (qalib rəyi kimi göstərilmir). */
export const STORE_NOTE_HEADING = "Honsell Store açıqlaması";

/**
 * İctimai səhifədə rəyin mənbəyini şəffaf göstərən etiket. STORE_NOTE ayrıca
 * blokda göstərilir (aşağıdakı isStoreNote true olduqda bu funksiya çağırılmır).
 */
export function reviewProvenanceLabel(entryMethod: string, source: string): string {
  void source;
  if (entryMethod === "USER_SUBMITTED") return "Qalib tərəfindən göndərilib";
  // ADMIN_TRANSCRIBED — real qalibin real (icazəli) sözləridir; ictimai göstərimdə
  // "admin köçürüb" qeydi göstərilmir (adi testimonial kimi). Daxili provenance
  // admin panelində və audit-də qalır.
  if (entryMethod === "ADMIN_STORE_NOTE") return STORE_NOTE_HEADING;
  return "";
}

/** ADMIN_STORE_NOTE qalib testimonialı kimi göstərilməməlidir. */
export function isStoreNote(entryMethod: string): boolean {
  return entryMethod === "ADMIN_STORE_NOTE";
}

// ─── Saf köməkçilər (validasiya / sanitizasiya / görünürlük) ──────────────────

/** Reytinqi 1–5 arasına sıxır; keçərsizdə null. */
export function clampRating(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  if (r < 1 || r > 5) return null;
  return r;
}

/**
 * Rəy mətnini təhlükəsizləşdirir: HTML teqlərini və control simvollarını çıxarır,
 * boşluqları normallaşdırır, uzunluğu məhdudlaşdırır. React onsuz da qaçış edir,
 * bu isə əlavə müdafiə (stored XSS / teq inyeksiyasına qarşı).
 */
export function sanitizeReviewText(input: unknown, maxLen = 4000): string {
  let s = typeof input === "string" ? input : "";
  // HTML teqlərini sil.
  s = s.replace(/<[^>]*>/g, "");
  // Control simvolları (tab \x09 və newline \x0A xaric) sil.
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  // Üç və daha çox ardıcıl boş sətri ikiyə endir.
  s = s.replace(/\n{3,}/g, "\n\n").trim();
  if (s.length > maxLen) s = s.slice(0, maxLen).trim();
  return s;
}

/**
 * Rəy ictimai səhifədə göstərilə bilərmi? Üç şərtin HAMISI:
 * status = APPROVED, isPublic = true, hasPublishingConsent = true.
 */
export function isReviewPubliclyVisible(r: {
  status: string;
  isPublic: boolean;
  hasPublishingConsent: boolean;
}): boolean {
  return r.status === "APPROVED" && r.isPublic === true && r.hasPublishingConsent === true;
}

/**
 * Qalib limiti hesablanması. Mövcud qalib sayı + əlavə ediləcək say
 * `winnersCount`-u keçirsə false qaytarır (transaction daxilində yoxlanılır).
 */
export function withinWinnerLimit(current: number, adding: number, limit: number): boolean {
  return current + adding <= limit;
}

export const WINNER_LIMIT_MESSAGE = "Bu çəkiliş üçün nəzərdə tutulan qalib sayı tamamlanıb.";

// ─── İctimai görünüş forması ──────────────────────────────────────────────────

/** İctimai API-nin heç vaxt qaytarmamalı olduğu həssas sahələr (telefon/email). */
export type PublicWinnerReview = {
  winnerName: string;
  avatarUrl: string | null;
  instagramUsername: string | null;
  text: string;
  rating: number | null;
  imageUrl: string | null;
  videoUrl: string | null;
  entryMethod: string;
  source: string;
  provenanceLabel: string;
  isStoreNote: boolean;
  createdAt: string | null;
};
