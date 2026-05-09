/**
 * Predefined dil kodları və azərbaycan adları — admin streaming title-lərinə
 * dublyaj/subtitr dilləri əlavə edərkən istifadə olunur.
 *
 * Bizim use-case üçün yalnız bu 3 dil əhəmiyyətlidir — Türk, Rus və İngilis.
 */
export type LanguageCode = "tr" | "ru" | "en";

export const LANGUAGE_OPTIONS: Array<{ code: LanguageCode; label: string }> = [
  { code: "tr", label: "Türk" },
  { code: "ru", label: "Rus" },
  { code: "en", label: "İngilis" },
];

const LABEL_BY_CODE = new Map(LANGUAGE_OPTIONS.map((l) => [l.code, l.label] as const));

export function languageLabel(code: string): string {
  return LABEL_BY_CODE.get(code as LanguageCode) ?? code.toUpperCase();
}

/**
 * Azərbaycan dilində manual tarix formatı — `toLocaleDateString("az-AZ")`-i
 * istifadə etmirik, çünki bəzi brauzerlərin ICU məlumatı tam olmur və SSR/CSR
 * arasında hydration mismatch yaradır.
 */
const AZ_MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr",
];

export function formatAzDate(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "";
  return `${dt.getDate()} ${AZ_MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
}

export function formatAzDateTime(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "";
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  return `${formatAzDate(dt)}, ${hh}:${mm}`;
}

