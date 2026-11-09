/**
 * Streaming xidmət qrupları — "Şəxsi hesab" / "Paylaşımlı hesab" quruluşu.
 *
 * Bir xidmət (üst `StreamingPlatform`, `parentCode = null`) planlara bölünür. Hər plan ayrıca
 * `StreamingPlatform` sətridir (`parentCode` = üst xidmətin kodu) və iki rejimdən birindədir:
 *   - PERSONAL — abunəlik müştərinin ÖZ hesabına aktivləşir: alışda e-poçt + şifrə soruşulur
 *     (`metadata.deliveryMode = "GMAIL"`), stok yoxdur.
 *   - SHARED   — bizim hesabda müştəriyə otaq: giriş `StreamingStock`-dan verilir
 *     (`deliveryMode = "CODE"`), 1/2 nəfərlik paketlər.
 * Paketlər (`ServiceProduct`, `type = "STREAMING"`) `metadata.service` = plan kodu saxlayır; admin API
 * plan məlumatını (`accessMode`, `groupCode`, `storeSellable`) paket metadata-sına köçürür ki,
 * checkout / səbət / satış əhatəsi DB-yə getmədən SİNXRON qərar versin.
 *
 * Netflix bu quruluşdan əvvəl kodda qurulub (`lib/streamingGroups.ts`, `lib/crmNetflix.ts`) — onun
 * vitrini və CRM xəritəsi dəyişmir, admin yalnız eyni quruluşu göstərir və plan əlavə/silməni bağlayır.
 *
 * Client-safe SAF modul — prisma import ETMƏ.
 */
import { NETFLIX_ACCOUNT_SERVICE_CODE, NETFLIX_CABINET_SERVICE_CODES } from "@/lib/storeScope";

export type StreamingAccessMode = "PERSONAL" | "SHARED";
export const STREAMING_ACCESS_MODES: readonly StreamingAccessMode[] = ["PERSONAL", "SHARED"];

export const ACCESS_MODE_META: Record<
  StreamingAccessMode,
  {
    label: string;
    /** Admin bölməsinin alt mətni. */
    description: string;
    /** Vitrində `?secim=` dəyəri. */
    selection: string;
    /** Plan kodunun ortası — HBO_MAX_<SEXSI>_STANDART. */
    codeSegment: string;
  }
> = {
  PERSONAL: {
    label: "Şəxsi hesab",
    description: "Müştərinin öz hesabı. Alışda e-poçt və şifrə soruşulur, stok lazım deyil.",
    selection: "sexsi",
    codeSegment: "SEXSI",
  },
  SHARED: {
    label: "Paylaşımlı hesab",
    description: "Bizim hesabda müştəriyə otaq verilir. Giriş məlumatı stokdan götürülür.",
    selection: "paylasimli",
    codeSegment: "PAYLASIMLI",
  },
};

export function isStreamingAccessMode(value: unknown): value is StreamingAccessMode {
  return value === "PERSONAL" || value === "SHARED";
}

/** Vitrində `?secim=` → rejim. Netflix-in köhnə `kabinet` dəyəri də tanınır. */
export function accessModeFromSelection(selection: string | null | undefined): StreamingAccessMode | null {
  const s = String(selection ?? "").toLowerCase();
  if (s === ACCESS_MODE_META.PERSONAL.selection) return "PERSONAL";
  if (s === ACCESS_MODE_META.SHARED.selection || s === "kabinet") return "SHARED";
  return null;
}

/** Paket sırası və qiymət cədvəli. API də yalnız bunları qəbul edir. */
export const STREAMING_DURATION_OPTIONS: readonly number[] = [1, 2, 3, 6, 12];
export const STREAMING_SEAT_OPTIONS: readonly number[] = [1, 2];

/** Netflix qrupu kodda qurulub (CRM plan xəritəsi) — admin plan əlavə edə / silə / rejimini dəyişə bilməz. */
export const NETFLIX_GROUP_CODE = "NETFLIX";

export function isLockedStreamingGroup(code: string | null | undefined): boolean {
  return String(code ?? "").toUpperCase() === NETFLIX_GROUP_CODE;
}

/**
 * Platformanın qrup yeri. DB sütunları boş olsa da (miqrasiyadan əvvəlki / mock-seed mühiti)
 * Netflix planları koddan tanınır.
 */
export function resolvePlatformGroup(p: {
  code: string;
  parentCode?: string | null;
  accessMode?: string | null;
}): { parentCode: string | null; accessMode: StreamingAccessMode | null } {
  const code = p.code.toUpperCase();
  const parentCode = p.parentCode?.trim() ? p.parentCode.trim().toUpperCase() : null;
  const accessMode = isStreamingAccessMode(p.accessMode) ? p.accessMode : null;
  if (parentCode && accessMode) return { parentCode, accessMode };
  if (code === NETFLIX_ACCOUNT_SERVICE_CODE) return { parentCode: NETFLIX_GROUP_CODE, accessMode: "PERSONAL" };
  if (NETFLIX_CABINET_SERVICE_CODES.includes(code)) return { parentCode: NETFLIX_GROUP_CODE, accessMode: "SHARED" };
  return { parentCode, accessMode: parentCode ? accessMode ?? "SHARED" : null };
}

/** Paket metadata-sındakı plan rejimi (admin API köçürür). Rejimsiz köhnə paket → null. */
export function productAccessMode(metadata: unknown): StreamingAccessMode | null {
  if (!metadata || typeof metadata !== "object") return null;
  const v = (metadata as Record<string, unknown>).accessMode;
  return isStreamingAccessMode(v) ? v : null;
}

// ─── Plan bulletləri ────────────────────────────────────────────────────────

export type StreamingFeatureTone = "good" | "bad" | "warn" | "neutral";
export type StreamingFeature = { text: string; tone: StreamingFeatureTone };

export function parseStreamingFeatures(raw: unknown): StreamingFeature[] {
  if (!Array.isArray(raw)) return [];
  const out: StreamingFeature[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const text = String((item as Record<string, unknown>).text ?? "").trim();
    if (!text) continue;
    const t = String((item as Record<string, unknown>).tone ?? "neutral");
    out.push({ text: text.slice(0, 200), tone: t === "good" || t === "bad" || t === "warn" ? t : "neutral" });
  }
  return out.slice(0, 12);
}

const TONE_PREFIX: Record<StreamingFeatureTone, string> = { good: "+ ", bad: "- ", warn: "! ", neutral: "" };

/** Admin textarea-sı: hər sətir bir bullet; "+ " yaxşı, "- " mənfi, "! " xəbərdarlıq. */
export function featuresToText(features: StreamingFeature[]): string {
  return features.map((f) => `${TONE_PREFIX[f.tone]}${f.text}`).join("\n");
}

export function featuresFromText(text: string): StreamingFeature[] {
  const out: StreamingFeature[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^([+\-!])\s*(.*)$/.exec(line);
    const tone: StreamingFeatureTone = !m ? "neutral" : m[1] === "+" ? "good" : m[1] === "-" ? "bad" : "warn";
    const body = (m ? m[2] : line).trim();
    if (body) out.push({ text: body, tone });
  }
  return parseStreamingFeatures(out);
}

// ─── Kod / slug ─────────────────────────────────────────────────────────────

/** DB slug-ı ilə public URL fərqlənən platformalar (köhnə Netflix VVIP → netflix-hesab). */
const PUBLIC_SLUG_BY_DB_SLUG: Record<string, string> = {
  "netflix-vvip": "netflix-hesab",
};

const DB_SLUG_BY_PUBLIC_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(PUBLIC_SLUG_BY_DB_SLUG).map(([dbSlug, publicSlug]) => [publicSlug, dbSlug]),
);

export function getPublicStreamingSlug(slug: string): string {
  return PUBLIC_SLUG_BY_DB_SLUG[slug] ?? slug;
}

export function getDbStreamingSlug(slug: string): string {
  return DB_SLUG_BY_PUBLIC_SLUG[slug] ?? slug;
}

const AZ_LATIN: Record<string, string> = {
  ə: "e", Ə: "E", ı: "i", I: "I", İ: "I", ş: "s", Ş: "S", ç: "c", Ç: "C",
  ö: "o", Ö: "O", ü: "u", Ü: "U", ğ: "g", Ğ: "G",
};

function latin(value: string): string {
  return value.replace(/[əƏıİşŞçÇöÖüÜğĞ]/g, (ch) => AZ_LATIN[ch] ?? ch);
}

/** "Evimdə VIP" → "evimde-vip". */
export function streamingSlug(value: string): string {
  return latin(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** "HBO Max" → "HBO_MAX". */
export function streamingCode(value: string): string {
  return latin(value)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Yeni planın kodu: HBO_MAX + SHARED + "Standart" → HBO_MAX_PAYLASIMLI_STANDART. */
export function childPlatformCode(parentCode: string, mode: StreamingAccessMode, tierName: string): string {
  return [parentCode.toUpperCase(), ACCESS_MODE_META[mode].codeSegment, streamingCode(tierName)]
    .filter(Boolean)
    .join("_");
}

/** Yeni planın slug-ı: hbo-max + SHARED + "Standart" → hbo-max-paylasimli-standart. */
export function childPlatformSlug(parentSlug: string, mode: StreamingAccessMode, tierName: string): string {
  return [parentSlug, ACCESS_MODE_META[mode].selection, streamingSlug(tierName)].filter(Boolean).join("-");
}

/** Vitrində `?paket=` açarı: plan slug-ından üst xidmət + rejim prefiksi çıxarılır. */
export function tierKeyFromSlug(childSlug: string, parentSlug: string, mode: StreamingAccessMode): string {
  const prefix = `${parentSlug}-${ACCESS_MODE_META[mode].selection}-`;
  return childSlug.startsWith(prefix) && childSlug.length > prefix.length ? childSlug.slice(prefix.length) : childSlug;
}
