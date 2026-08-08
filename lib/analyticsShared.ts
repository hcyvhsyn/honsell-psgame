/**
 * Analitika — client və server arasında paylaşılan SAF hissə.
 *
 * ⚠️ BU FAYL HEÇ NƏ İMPORT ETMİR. Nə `lib/prisma`, nə `next/headers`, nə də
 * onlara toxunan başqa modul. Səbəb: bu faylı `lib/track.ts` oxuyur, onu isə
 * `lib/cart.tsx` (yəni `app/layout.tsx` vasitəsilə HƏR səhifə) oxuyur. Tranzitiv
 * `lib/prisma` import-u `next build`-i sındırır — özü də `tsc` təmiz keçdiyi üçün
 * xəta yalnız build mərhələsində üzə çıxır.
 */

// ─── Cookie adları ───────────────────────────────────────────────────────────
// HttpOnly DEYİL: brauzer yazır (VisitorTracker), server isə checkout route
// handler-ində oxuyur. Qısa adlar qəsdəndir — cookie hər request-də gedir.

/** Anonim ziyarətçi ID-si (400 gün). */
export const VISITOR_COOKIE = "hs_vid";
/** İlk toxunuş — bir dəfə yazılır, heç vaxt üzərinə yazılmır. */
export const FIRST_TOUCH_COOKIE = "hs_ft";
/** Son qeyri-birbaşa toxunuş. */
export const LAST_TOUCH_COOKIE = "hs_lt";
/** Cari seans ID-si (30 dəq sürüşən pəncərə). */
export const SESSION_COOKIE = "hs_sid";

export const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 400; // 400 gün
export const SESSION_IDLE_MS = 30 * 60 * 1000; // 30 dəqiqə

// ─── Beacon limitləri (server də, client də eyni rəqəmi işlədir) ─────────────
export const MAX_EVENTS_PER_BEACON = 20;
export const MAX_BEACON_BYTES = 8 * 1024;
export const MAX_PATH_LEN = 200;
export const MAX_CAMPAIGN_LEN = 100;
export const MAX_QUERY_LEN = 120;
export const MAX_ID_LEN = 64;

// ─── Event adları ────────────────────────────────────────────────────────────
// Sərbəst string birliyi — Prisma enum DEYİL (bu sxemdə heç bir enum yoxdur).

export const EVENT_NAMES = [
  "page_view",
  "view_item",
  "add_to_cart",
  "begin_checkout",
  "purchase",
  "search",
  "reel_view",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

const EVENT_NAME_SET = new Set<string>(EVENT_NAMES);

export function isEventName(v: unknown): v is EventName {
  return typeof v === "string" && EVENT_NAME_SET.has(v);
}

// ─── Kanallar ────────────────────────────────────────────────────────────────

export const CHANNELS = [
  "direct",
  "organic_google",
  "organic_other",
  "instagram",
  "tiktok",
  "facebook",
  "whatsapp",
  "telegram",
  "youtube",
  "email",
  "paid",
  "referral_site",
  "review_affiliate",
] as const;

export type Channel = (typeof CHANNELS)[number];

/** Admin panelində göstərilən oxunaqlı adlar. */
export const CHANNEL_LABELS: Record<Channel, string> = {
  direct: "Birbaşa",
  organic_google: "Google (axtarış)",
  organic_other: "Digər axtarış",
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  youtube: "YouTube",
  email: "E-poçt",
  paid: "Ödənişli reklam",
  referral_site: "Xarici sayt",
  review_affiliate: "Rəy affiliate",
};

export function channelLabel(value: string): string {
  return (CHANNEL_LABELS as Record<string, string>)[value] ?? value;
}

/** utm_source dəyərindən şəbəkəyə. */
const SOURCE_MAP: Record<string, Channel> = {
  instagram: "instagram",
  ig: "instagram",
  insta: "instagram",
  tiktok: "tiktok",
  tt: "tiktok",
  facebook: "facebook",
  fb: "facebook",
  meta: "facebook",
  whatsapp: "whatsapp",
  wa: "whatsapp",
  telegram: "telegram",
  tg: "telegram",
  youtube: "youtube",
  yt: "youtube",
  email: "email",
  mail: "email",
  newsletter: "email",
  resend: "email",
  google: "organic_google",
};

/** Referrer host → şəbəkə. Suffiks uyğunluğu ilə yoxlanılır. */
const REFERRER_MAP: Array<[string, Channel]> = [
  ["instagram.com", "instagram"],
  ["tiktok.com", "tiktok"],
  ["facebook.com", "facebook"],
  ["fb.watch", "facebook"],
  ["fb.me", "facebook"],
  ["wa.me", "whatsapp"],
  ["whatsapp.com", "whatsapp"],
  ["t.me", "telegram"],
  ["telegram.me", "telegram"],
  ["telegram.org", "telegram"],
  ["youtube.com", "youtube"],
  ["youtu.be", "youtube"],
  ["google.com", "organic_google"],
  ["google.az", "organic_google"],
  ["google.ru", "organic_google"],
  ["google.tr", "organic_google"],
  ["bing.com", "organic_other"],
  ["yandex.ru", "organic_other"],
  ["yandex.com", "organic_other"],
  ["yandex.az", "organic_other"],
  ["duckduckgo.com", "organic_other"],
  ["yahoo.com", "organic_other"],
  ["ecosia.org", "organic_other"],
];

const PAID_MEDIUMS = new Set([
  "cpc",
  "ppc",
  "paid",
  "paidsocial",
  "paid_social",
  "paid-social",
  "display",
  "banner",
  "cpm",
]);

/**
 * Medium ödənişli reklamı bildirirmi. `classifyChannel` kanalı ŞƏBƏKƏ kimi
 * qaytarır (məs. `instagram`), ödənişli/organik ayrımı isə saxlanılan `medium`
 * sahəsindədir — beləcə hesabatda "Instagram (reklam)" və "Instagram (organik)"
 * ayrıca göstərilə bilər, amma kanal büdcəsi bir yerdə qalır.
 */
export function isPaidMedium(medium: string | null | undefined): boolean {
  if (!medium) return false;
  return PAID_MEDIUMS.has(medium.trim().toLowerCase());
}

export type TouchInput = {
  utmSource?: string | null;
  utmMedium?: string | null;
  referrerHost?: string | null;
  hasVia?: boolean;
};

/**
 * Ziyarətin mənbəyini bir kanala yığır.
 *
 * Sıra vacibdir:
 *  1. `?via=` (rəy affiliate) — bu, saytın öz izləmə linkidir, hər şeydən üstündür.
 *  2. `utm_source` — reklamçının özünün dediyi mənbə.
 *  3. Ödənişli medium, amma tanınmayan mənbə → `paid`.
 *  4. Referrer host.
 *  5. Heç nə → `direct`.
 */
export function classifyChannel(input: TouchInput): Channel {
  if (input.hasVia) return "review_affiliate";

  const source = input.utmSource?.trim().toLowerCase() ?? "";
  if (source) {
    const mapped = SOURCE_MAP[source];
    if (mapped) return mapped;
  }

  if (isPaidMedium(input.utmMedium)) return "paid";

  // utm_source var, amma tanınmır — yenə də birbaşa deyil.
  if (source) return "referral_site";

  const host = normalizeHost(input.referrerHost);
  if (host) {
    for (const [suffix, channel] of REFERRER_MAP) {
      if (host === suffix || host.endsWith(`.${suffix}`)) return channel;
    }
    return "referral_site";
  }

  return "direct";
}

/** `www.` prefiksi atılmış, kiçik hərfli host. Boş dəyər → null. */
export function normalizeHost(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let host = raw.trim().toLowerCase();
  if (!host) return null;
  // Tam URL gəlibsə host-u çıxar.
  if (host.includes("://")) {
    try {
      host = new URL(host).hostname.toLowerCase();
    } catch {
      return null;
    }
  }
  if (host.startsWith("www.")) host = host.slice(4);
  return host || null;
}

/**
 * Yol normallaşdırması — query və hash atılır, kiçik hərfə salınır, kəsilir.
 * Hesabatda eyni səhifənin onlarla variantının ayrı sətir olmaması üçün.
 */
export function normalizePath(raw: string | null | undefined): string {
  if (!raw) return "/";
  let path = raw.trim();
  if (!path) return "/";
  const q = path.search(/[?#]/);
  if (q >= 0) path = path.slice(0, q);
  if (!path.startsWith("/")) path = `/${path}`;
  path = path.toLowerCase();
  // Sondakı slash-ı at (kök istisna) — `/oyunlar` və `/oyunlar/` eyni sətirdir.
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return truncate(path, MAX_PATH_LEN);
}

export function truncate(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

// ─── Toxunuş kodlaması ───────────────────────────────────────────────────────
// Cookie hər request-də gedir, ona görə JSON deyil, boru ilə ayrılmış format:
//   source|medium|campaign|referrerHost|landingPath|unixSeconds
// Dəyərlərdəki `|` təmizlənir (format pozulmasın deyə).

export type Touch = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  referrerHost: string | null;
  landingPath: string | null;
  at: number | null;
};

function cleanPart(v: string | null | undefined, max: number): string {
  if (!v) return "";
  return truncate(v.replace(/[|]/g, "").trim(), max);
}

export function encodeTouch(touch: Touch): string {
  return [
    cleanPart(touch.source, 60),
    cleanPart(touch.medium, 60),
    cleanPart(touch.campaign, MAX_CAMPAIGN_LEN),
    cleanPart(touch.referrerHost, 100),
    cleanPart(touch.landingPath, MAX_PATH_LEN),
    touch.at ? String(Math.floor(touch.at / 1000)) : "",
  ].join("|");
}

export function decodeTouch(raw: string | null | undefined): Touch | null {
  if (!raw) return null;
  const parts = raw.split("|");
  if (parts.length < 6) return null;
  const seconds = Number(parts[5]);
  return {
    source: parts[0] || null,
    medium: parts[1] || null,
    campaign: parts[2] || null,
    referrerHost: parts[3] || null,
    landingPath: parts[4] || null,
    at: Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null,
  };
}

/** Toxunuşdan kanal — `classifyChannel`-in saxlanılmış dəyər üçün qısa yolu. */
export function touchChannel(touch: Touch | null): Channel {
  if (!touch) return "direct";
  return classifyChannel({
    utmSource: touch.source,
    utmMedium: touch.medium,
    referrerHost: touch.referrerHost,
  });
}

// ─── ID validasiyası ─────────────────────────────────────────────────────────

/**
 * Client-dən gələn ID-lər (visitorId / sessionId / event id) heç vaxt DB-yə
 * yoxlanmadan yazılmır — uzunluq və simvol dəsti məhdudlaşdırılır.
 */
export function isSafeId(v: unknown): v is string {
  return (
    typeof v === "string" &&
    v.length > 0 &&
    v.length <= MAX_ID_LEN &&
    /^[A-Za-z0-9_-]+$/.test(v)
  );
}
