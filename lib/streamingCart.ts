import type { StreamingCartDetails } from "@/lib/cart";

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
 * - alışda şəxsi e-poçt tələb olunur (hər provayder, yalnız @gmail.com deyil),
 * - admin UPSERT məhsulu `deliveryMode: "GMAIL"` qoyur,
 * - stok hovuzu (kabinet mail/şifrə/pin) YOXDUR.
 * Kodlar metadata.service ilə uyğun gəlir (StreamingPlatform.code).
 */
export const CUSTOMER_EMAIL_STREAMING_SERVICES = new Set<string>([
  "NETFLIX_VVIP",
  "NETFLIX_EVIMD_VIP", // Netflix Evimdə VIP (/streaming/netflix-evimde-vip)
]);

export function streamingUsesCustomerEmail(code: string | null | undefined): boolean {
  return CUSTOMER_EMAIL_STREAMING_SERVICES.has(String(code ?? "").toUpperCase());
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
      "Netflix Hesab — abunəlik birbaşa SƏNİN öz Netflix hesabına aktivləşdirilir. Basic, Standart və Premium planlardan birini seç, ödənişdən sonra şəxsi mail ünvanını qeyd et — admin hesabına planı qoşur.",
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
