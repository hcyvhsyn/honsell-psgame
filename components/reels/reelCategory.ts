import type { ReelCategory } from "./types";

/**
 * Feed kateqoriyası seçiminin cihazda saxlanması (localStorage).
 *
 * NİYƏ SERVER BİLMİR: `/reels` statik/edge-keşlənən qalmalıdır, ona görə səhifədə
 * `cookies()` oxumaq olmaz. Seçim yalnız client-də mövcuddur — bu, `lib/theme.tsx`
 * və `lib/favorites.tsx`-dəki eyni şablondur.
 */
export const REEL_CATEGORY_STORAGE_KEY = "honsell:reels-feed";

export const REEL_CATEGORY_LABELS: Record<ReelCategory, string> = {
  GAME: "Oyun",
  STREAMING: "Film & Serial",
  ALL: "Hamısı",
  SAVED: "Saxladıqlarım",
};

/** Saxlanmış seçim; yoxdursa/oxunmursa `null` (→ ilk giriş sualı göstərilir). */
export function readStoredReelCategory(): ReelCategory | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(REEL_CATEGORY_STORAGE_KEY);
    return raw === "GAME" || raw === "STREAMING" || raw === "ALL" ? raw : null;
  } catch {
    // localStorage bloklana bilər (private mode, quraşdırma) — seçim soruşulur.
    return null;
  }
}

export function storeReelCategory(category: ReelCategory): void {
  try {
    window.localStorage.setItem(REEL_CATEGORY_STORAGE_KEY, category);
  } catch {
    /* yazıla bilmirsə seçim yalnız bu sessiyada qalır */
  }
}
