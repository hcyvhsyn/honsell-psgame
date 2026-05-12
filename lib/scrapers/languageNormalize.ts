import type { LanguageCode } from "@/lib/streamingLanguages";

/**
 * Scraper-lərin gətirdiyi raw dil etiketlərini bizim 3 dilli (tr/ru/en)
 * sistemə map edir. Tanınmayan dillər atılır (filter).
 *
 * Niyə yalnız 3 dil? — bax `lib/streamingLanguages.ts`. AZ pazarında dublyaj
 * və altyazı seçimi məhz bu üç dil üzərindən qurulub; daha geniş set
 * UI-da dəyər yaratmır və DB-də şüur kirlədir.
 */

const TR_TOKENS = ["tr", "tur", "turkish", "türkçe", "turkce", "türk"];
const RU_TOKENS = ["ru", "rus", "russian", "русский", "русская", "rusca", "rusça"];
const EN_TOKENS = ["en", "eng", "english", "ingilizce", "ingilis", "ingilizce"];

export function normalizeLanguage(raw: string | null | undefined): LanguageCode | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  // ISO kodları çox vaxt "en-US", "tr-TR" formasındadır — ilk hissəni götür.
  const primary = s.split(/[-_,;\s/]/)[0]?.trim() ?? s;
  if (TR_TOKENS.includes(primary) || TR_TOKENS.some((t) => s.includes(t))) return "tr";
  if (RU_TOKENS.includes(primary) || RU_TOKENS.some((t) => s.includes(t))) return "ru";
  if (EN_TOKENS.includes(primary) || EN_TOKENS.some((t) => s.includes(t))) return "en";
  return null;
}

/** Bir massivi normalize edib unikal `LanguageCode[]` qaytarır (sıralama qorunur). */
export function normalizeLanguageList(raw: Array<string | null | undefined>): LanguageCode[] {
  const seen = new Set<LanguageCode>();
  const out: LanguageCode[] = [];
  for (const item of raw) {
    const code = normalizeLanguage(item);
    if (code && !seen.has(code)) {
      seen.add(code);
      out.push(code);
    }
  }
  return out;
}
