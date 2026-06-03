// Qeydiyyatda "Bizi haradan eşitdiniz?" sualının seçimləri. Həm RegisterForm
// (client), həm register API (server), həm də admin bildiriş e-poçtu eyni
// dəyər və etiketlərdən istifadə etsin deyə tək mənbədə saxlanılır.

export const HEARD_ABOUT_OPTIONS = [
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "FRIEND", label: "Dost tövsiyəsi" },
  { value: "OTHER", label: "Digər" },
] as const;

export type HeardAboutSource = (typeof HEARD_ABOUT_OPTIONS)[number]["value"];

const VALUE_SET = new Set<string>(HEARD_ABOUT_OPTIONS.map((o) => o.value));

/** Daxil olan dəyər icazə verilən seçimlərdən biridirsə onu, deyilsə null qaytarır. */
export function normalizeHeardAboutSource(raw: unknown): HeardAboutSource | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toUpperCase();
  return VALUE_SET.has(v) ? (v as HeardAboutSource) : null;
}

/** Saxlanmış dəyərin oxunaqlı etiketi (admin paneli / e-poçt üçün). */
export function heardAboutLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return HEARD_ABOUT_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
