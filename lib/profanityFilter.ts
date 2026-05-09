/**
 * Sadə pis söz filtri — Azərbaycan, türk və ingilis dillərində ən geniş yayılmış
 * söyüş və qaba sözlərin siyahısı. Niyə cüzi siyahıdır: bu filtr birinci xətdir,
 * sonra admin moderasiyası ikinci xətdir. Tam beynəlxalq filtr istəsən sonra
 * `bad-words` paketinə və ya 3rd-party API-yə keçə bilərsən.
 *
 * Sözlər kökdə yazılır; matching word-boundary ilə case-insensitive aparılır,
 * Latin və Kiril variasiyalarına görə əsas formaları əlavə edirik.
 */
const BANNED_WORDS: string[] = [
  // AZ — yaygın söyüşlər
  "götveren", "götverən", "gotveren", "qancıq", "qancig", "gotuna",
  "anasını", "anasini", "anan", "anavi", "ananı", "anami",
  "amcığı", "amcig", "amcığ", "amciyi",
  "siktir", "sikim", "sikək", "sikək", "sikici", "sikən", "siken",
  "yarrak", "yarraq", "qıçımı", "qicimi",
  // TR
  "amk", "aq", "amına", "amına", "amk", "amına koyim", "götü",
  "orospu", "piç", "puşt", "pust", "yarrak", "siktirgit",
  "salak", "götveren",
  // EN
  "fuck", "fucker", "fucking", "shit", "bitch", "asshole", "cunt",
  "dick", "pussy", "motherfucker", "bastard",
  // RU
  "блядь", "блять", "сука", "хуй", "пизда", "ебать",
];

// Word boundary uyğunlaşdırması — sözün başında və sonunda alfanümerik olmasın.
// Türkcə/azərbaycanca xüsusi simvolları (ə, ı, ş, ç və s.) sözə daxil hesab edirik.
const WORD_CHAR = "[A-Za-zçğıöşüÇĞİÖŞÜəƏА-Яа-яЁё0-9]";

const PATTERN_CACHE = new Map<string, RegExp>();
function patternFor(word: string): RegExp {
  const cached = PATTERN_CACHE.get(word);
  if (cached) return cached;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // (?<!word_char) word (?!word_char) — kök kimi davranan match-i tap
  const re = new RegExp(`(?<!${WORD_CHAR})${escaped}(?!${WORD_CHAR})`, "iu");
  PATTERN_CACHE.set(word, re);
  return re;
}

export function findProfanity(text: string): string | null {
  if (!text) return null;
  for (const w of BANNED_WORDS) {
    if (patternFor(w).test(text)) return w;
  }
  return null;
}

export function containsProfanity(text: string): boolean {
  return findProfanity(text) !== null;
}
