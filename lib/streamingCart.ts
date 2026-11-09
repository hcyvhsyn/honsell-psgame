import type { StreamingCartDetails } from "@/lib/cart";
import { NETFLIX_ACCOUNT_SERVICE_CODE, NETFLIX_CABINET_SERVICE_CODES } from "@/lib/storeScope";
import { productAccessMode } from "@/lib/streamingAccess";

export function validateStreamingDetails(d: StreamingCartDetails): string | null {
  const mail = (d.gmail ?? "").trim().toLowerCase();
  if (!mail) return "Gmail ünvanı daxil edin.";
  if (!/^[^\s@]+@gmail\.com$/.test(mail)) return "Yalnız Gmail ünvanı (@gmail.com) qəbul edilir.";
  return null;
}

export const STREAMING_SERVICE_LABELS: Record<string, string> = {
  HBO_MAX: "HBO Max",
  GAIN: "Gain",
  YOUTUBE_PREMIUM: "YouTube Premium",
  NETFLIX: "Netflix",
  NETFLIX_VVIP: "Netflix Hesab",
  PRIME_VIDEO: "Prime Video",
};

export const STREAMING_SERVICES = ["HBO_MAX", "GAIN", "YOUTUBE_PREMIUM", "NETFLIX", "NETFLIX_VVIP", "PRIME_VIDEO"] as const;
export type StreamingService = (typeof STREAMING_SERVICES)[number];

/**
 * Bu streaming xidmətləri müştərinin ÖZ Netflix hesabına aktivləşir:
 * - alışda Netflix e-poçtu (hər provayder, yalnız @gmail.com deyil) və şifrəsi tələb olunur —
 *   CRM onları provayderə ötürür (`lib/crmNetflix.ts`),
 * - admin UPSERT məhsulu `deliveryMode: "GMAIL"` qoyur,
 * - stok hovuzu (kabinet mail/şifrə/pin) YOXDUR.
 * Kodlar metadata.service ilə uyğun gəlir (StreamingPlatform.code).
 *
 * ⚠️ Evimdə VIP (`NETFLIX_EVIMD_VIP`) bura DAXİL DEYİL: o, bizim hesabda otaqdır.
 *
 * Admin-dən qurulan "Şəxsi hesab" planları (HBO Max və s.) kodla yox, paket metadata-sı ilə
 * tanınır (`accessMode: "PERSONAL"`, lib/streamingAccess.ts) — ona görə funksiya paketin
 * `metadata`-sını da qəbul edir. Kod ötürülsə yalnız Netflix tanınır.
 */
export const CUSTOMER_EMAIL_STREAMING_SERVICES = new Set<string>([NETFLIX_ACCOUNT_SERVICE_CODE]);

export function streamingUsesCustomerEmail(
  codeOrMetadata: string | null | undefined | Record<string, unknown>,
): boolean {
  if (codeOrMetadata && typeof codeOrMetadata === "object") {
    const code = String(codeOrMetadata.service ?? "").toUpperCase();
    if (CUSTOMER_EMAIL_STREAMING_SERVICES.has(code)) return true;
    // Netflix otağı köhnə DB dəyərinə baxmayaraq heç vaxt müştəri hesabı istəmir.
    if (NETFLIX_CABINET_SERVICE_CODES.includes(code)) return false;
    return productAccessMode(codeOrMetadata) === "PERSONAL";
  }
  return CUSTOMER_EMAIL_STREAMING_SERVICES.has(String(codeOrMetadata ?? "").toUpperCase());
}

/** Müştəri hesabı formasındakı ad: "Netflix hesab e-poçtu" / "Hesab e-poçtu". */
export function streamingCustomerAccountLabel(metadata: Record<string, unknown> | null | undefined): string {
  const code = String(metadata?.service ?? "").toUpperCase();
  return code === NETFLIX_ACCOUNT_SERVICE_CODE ? "Netflix hesab" : "Hesab";
}

/**
 * Sifarişin çatdırılma rejimi. Tanınan Netflix kodlarında qərarı KOD verir, `metadata.deliveryMode`
 * yox: DB-də köhnə Evimdə VIP sətirlərində `deliveryMode: "GMAIL"` qala bilər və müştəridən
 * lazımsız e-poçt istənərdi. Qalan xidmətlər metadata-nı oxuyur.
 */
export function streamingDeliveryMode(metadata: unknown): "CODE" | "GMAIL" {
  const meta = (metadata as Record<string, unknown> | null) ?? {};
  const code = String(meta.service ?? "").toUpperCase();
  if (streamingUsesCustomerEmail(code)) return "GMAIL";
  if (NETFLIX_CABINET_SERVICE_CODES.includes(code)) return "CODE";
  // Admin planı: rejim çatdırılmanı təyin edir (metadata.deliveryMode köhnə qala bilər).
  const mode = productAccessMode(meta);
  if (mode) return mode === "PERSONAL" ? "GMAIL" : "CODE";
  return String(meta.deliveryMode ?? "CODE") === "GMAIL" ? "GMAIL" : "CODE";
}

export const STREAMING_DURATIONS = [1, 2, 3, 6, 12] as const;

/**
 * Hər streaming xidmətinin URL slug-u və SEO/UI məlumatları.
 * Yeni xidmət əlavə etdikdə: STREAMING_SERVICES + LABELS + bu obyekt yenilənməlidir
 * və lazımdırsa StreamingClient-də SERVICE_THEME-yə də əlavə edilməlidir.
 */
export type StreamingServiceCategory = "STREAMING" | "MUSIC";

export type StreamingServiceMeta = {
  // Dinamik platformalar (DB-dən gələn yeni xidmətlər) üçün string saxlanır.
  // Statik defaults üçün dəyər həmişə bir StreamingService kodudur.
  code: string;
  slug: string;
  label: string;
  category: StreamingServiceCategory;
  /** Bir cümlə — kart sub-mətni və meta description üçün. */
  tagline: string;
  /** Hero açıqlaması — service page-ində istifadə olunur. */
  description: string;
  /** Platforma hero şəkli (DB-dən). Statik defaults-da yoxdur. */
  heroImageUrl?: string | null;
  /** Plan sətiridirsə üst xidmətin kodu (lib/streamingAccess.ts). */
  parentCode?: string | null;
  /** Plan rejimi: PERSONAL | SHARED. Üst xidmətdə null. */
  accessMode?: string | null;
  /** Vitrində plan adı. */
  tierName?: string;
};

export const STREAMING_SERVICE_META: Record<StreamingService, StreamingServiceMeta> = {
  HBO_MAX: {
    code: "HBO_MAX",
    slug: "hbo-max",
    label: "HBO Max",
    category: "STREAMING",
    tagline: "Premium serial və film abunəliyi",
    description:
      "HBO Max — Game of Thrones, House of the Dragon, The Last of Us və daha çox premium kontentə tam giriş. Aylıq və illik paketlər mövcuddur, ödənişdən sonra giriş məlumatları sənə email ilə göndərilir.",
  },
  GAIN: {
    code: "GAIN",
    slug: "gain",
    label: "Gain",
    category: "STREAMING",
    tagline: "Türkiyənin yerli streaming platforması",
    description:
      "Gain — Türkiyə yerli streaming xidməti. Türk dizi və filmlərini, eksklüziv yerli istehsalları Azərbaycandan rahat izlə. 1, 3, 6 və 12 aylıq paketlər ən sərfəli qiymətə.",
  },
  YOUTUBE_PREMIUM: {
    code: "YOUTUBE_PREMIUM",
    slug: "youtube",
    label: "YouTube Premium",
    category: "MUSIC",
    tagline: "Reklamsız video + YouTube Music",
    description:
      "YouTube Premium — reklamsız video izləmə, fonlu oxutma və YouTube Music daxil olmaqla tam paket. Sifariş zamanı Gmail ünvanını qeyd edirsən, abunəlik həmin hesaba qoşulur.",
  },
  NETFLIX: {
    code: "NETFLIX",
    slug: "netflix",
    label: "Netflix",
    category: "STREAMING",
    tagline: "Dünyanın ən böyük streaming kataloqu",
    description:
      "Netflix — beynəlxalq orijinallar, filmlər və seriallar üçün dünyanın ən geniş streaming platforması. Aylıq və illik abunəlik paketləri ən sərfəli qiymətə.",
  },
  NETFLIX_VVIP: {
    code: "NETFLIX_VVIP",
    slug: "netflix-hesab",
    label: "Netflix Hesab",
    category: "STREAMING",
    tagline: "Öz Netflix hesabına Basic / Standart / Premium plan",
    description:
      "Netflix Hesab — abunəlik birbaşa SƏNİN öz Netflix hesabına aktivləşdirilir. Basic, Standart və Premium planlardan birini seç, alışda Netflix hesabının mailini və şifrəsini qeyd et — plan hesabına qoşulur.",
  },
  PRIME_VIDEO: {
    code: "PRIME_VIDEO",
    slug: "prime",
    label: "Prime Video",
    category: "STREAMING",
    tagline: "Amazon Prime Video film və serial abunəliyi",
    description:
      "Prime Video — Amazon-un film və serial platforması. The Boys, Reacher, Fallout və daha çox eksklüziv kontentə tam giriş. Aylıq və illik paketlər mövcuddur, ödənişdən sonra giriş məlumatları sənə email ilə göndərilir.",
  },
};

export function getStreamingServiceBySlug(slug: string): StreamingServiceMeta | null {
  const all = Object.values(STREAMING_SERVICE_META);
  return all.find((s) => s.slug === slug) ?? null;
}

export function listStreamingServiceSlugs(): string[] {
  return Object.values(STREAMING_SERVICE_META).map((s) => s.slug);
}

/** Stok bazasında hər giriş üçün saxlanan struktur (ServiceCode.code-da JSON kimi). */
export type StreamingStockEntry = {
  accountEmail: string;
  accountPassword: string;
  slotName: string;
  pinCode: string;
};

export function parseStreamingStock(raw: string | null | undefined): StreamingStockEntry | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object") return null;
    const r = o as Record<string, unknown>;
    if (typeof r.accountEmail !== "string" || !r.accountEmail) return null;
    return {
      accountEmail: r.accountEmail,
      accountPassword: typeof r.accountPassword === "string" ? r.accountPassword : "",
      slotName: typeof r.slotName === "string" ? r.slotName : "",
      pinCode: typeof r.pinCode === "string" ? r.pinCode : "",
    };
  } catch {
    return null;
  }
}

export function serializeStreamingStock(e: StreamingStockEntry): string {
  return JSON.stringify({
    accountEmail: e.accountEmail.trim(),
    accountPassword: e.accountPassword,
    slotName: e.slotName.trim(),
    pinCode: e.pinCode.trim(),
  });
}

function fmtDateAz(d: Date): string {
  return d.toLocaleDateString("az-AZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function addMonths(d: Date, months: number): Date {
  const out = new Date(d);
  out.setMonth(out.getMonth() + months);
  return out;
}

/** Müştəriyə göndəriləcək çatdırılma mesajını qurur (plain text). */
export function buildStreamingDeliveryMessage(params: {
  providerLabel: string;
  entry: StreamingStockEntry;
  months: number;
  startDate: Date;
  endDate: Date;
  paymentAznCents: number;
}): string {
  const { providerLabel, entry, months, startDate, endDate, paymentAznCents } = params;
  const pinLine = entry.pinCode ? `🔢 PIN: ${entry.pinCode}` : "";
  return [
    `${providerLabel} abunəliyiniz aktivləşdirildi.`,
    "",
    `📧 Email: ${entry.accountEmail}`,
    `🔑 Şifrə: ${entry.accountPassword}`,
    "",
    `📺 Profil: ${entry.slotName}`,
    pinLine,
    "",
    `📅 Başlanğıc: ${fmtDateAz(startDate)}`,
    `📅 Bitmə: ${fmtDateAz(endDate)}`,
    `⏰ Müddət: ${months} ay`,
    `💰 Ödəniş: ${(paymentAznCents / 100).toFixed(2)} AZN`,
  ]
    // Əgər PIN yoxdursa "📺 Profil:"-dan sonra iki ardıcıl boş sətir qalır — birini sil.
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n");
}
