/**
 * Qiymət güdmə — client-safe tiplər və saf funksiyalar.
 *
 * ⚠️ Bu fayl `lib/prisma`-ya TOXUNMUR. Admin UI `"use client"`-dir; buradan
 * server modulu import etsə `next build` sınır (tsc keçsə də) — layihədə bu
 * tələ artıq bir neçə dəfə tutulub.
 */

/** Admin siyahısındaki bir güdmə sətri (API cavabı). */
export type PriceWatchRow = {
  id: string;
  phone: string;
  name: string | null;
  note: string | null;
  isActive: boolean;
  basePriceAznCents: number | null;
  notifyCount: number;
  lastNotifiedAt: string | null;
  createdAt: string;
  game: {
    id: string;
    productId: string;
    title: string;
    imageUrl: string | null;
    platform: string | null;
  };
  /** Hazırkı vitrin qiyməti — serverdə `computeDisplayPrice` ilə hesablanır. */
  currentPriceAzn: number | null;
  currentDiscountPct: number | null;
  /** Oyun hazırda endirimdədirsə true (admin "artıq düşüb" görsün). */
  isOnSale: boolean;
  /** Oyun deaktivdirsə mesaj getməyəcək — admin xəbərdarlıq görsün. */
  isGameInactive: boolean;
};

/** Güdmə sətrinin admin panelində göstərilən vəziyyəti. */
export type PriceWatchStatus = "PAUSED" | "GAME_INACTIVE" | "NOTIFIED" | "ON_SALE" | "WAITING";

/**
 * Vəziyyət sırası vacibdir: əvvəl mesajın getməsinə MANE olan səbəblər
 * (dayandırılmış / oyun deaktiv), sonra nəticə (göndərilmiş), sonra gözləmə.
 * Tərsi olsa admin "endirimdədir" görüb mesajın niyə getmədiyini anlamaz.
 */
export function priceWatchStatus(row: {
  isActive: boolean;
  isGameInactive: boolean;
  notifyCount: number;
  isOnSale: boolean;
}): PriceWatchStatus {
  if (!row.isActive) return "PAUSED";
  if (row.isGameInactive) return "GAME_INACTIVE";
  if (row.notifyCount > 0) return "NOTIFIED";
  if (row.isOnSale) return "ON_SALE";
  return "WAITING";
}

export const PRICE_WATCH_STATUS_LABEL: Record<PriceWatchStatus, string> = {
  PAUSED: "Dayandırılıb",
  GAME_INACTIVE: "Oyun deaktiv",
  NOTIFIED: "Xəbər verilib",
  ON_SALE: "Endirimdədir",
  WAITING: "Gözləyir",
};

export const PRICE_WATCH_STATUS_CLASS: Record<PriceWatchStatus, string> = {
  PAUSED: "bg-admin-chip2 text-zinc-600 ring-admin-line2",
  GAME_INACTIVE: "bg-amber-50 text-amber-700 ring-amber-200",
  NOTIFIED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  ON_SALE: "bg-sky-50 text-sky-700 ring-sky-200",
  WAITING: "bg-admin-chip text-zinc-600 ring-admin-line",
};

/**
 * Nömrənin göstərim formatı — E.164 saxlanılır, admin panelində oxunaqlı olur.
 * `+994501234567` → `+994 50 123 45 67`. Tanınmayan format olduğu kimi qalır.
 */
export function formatPhoneForDisplay(e164: string): string {
  const m = /^\+994(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(e164);
  if (!m) return e164;
  return `+994 ${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
}
