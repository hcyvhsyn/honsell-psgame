/**
 * Xidmət dəstləri — CLIENT-SAFE tiplər və saf məntiq.
 *
 * ⚠️ Bu fayl `lib/prisma`-ya (birbaşa və ya dolayı) TOXUNMAMALIDIR. Səbət və ana
 * səhifə rail-indəki `"use client"` komponentlər buradan import edir; server
 * tərəfi [lib/serviceBundles.ts](./serviceBundles.ts)-dədir. Client komponent
 * server faylını import etsə `next build` sınır (tsc keçsə də).
 */

import { streamingUsesCustomerEmail } from "@/lib/streamingCart";
import { formatAznCents } from "@/lib/gameBundleShared";

/** Səbətdəki xidmət dəsti sətrinin `productType` dəyəri. */
export const SERVICE_BUNDLE_PRODUCT_TYPE = "SERVICE_BUNDLE";

/**
 * Dəstə salına BİLMƏYƏN xidmət tipləri.
 *
 * Hesab açılışı (PSN/Epic) və Honsell hədiyyə kartı dəst məntiqinə uyğun gəlmir:
 * birincisi onsuz da başqa məhsulun ön şərtidir, ikincisi isə nominal dəyər daşıyır
 * (endirimli hədiyyə kartı = pul çap etmək). Qalan bütün tiplər icazəlidir — yeni
 * xidmət tipi (məs. VPN) əlavə olunanda dəst sistemi onu avtomatik qəbul edir.
 */
export const SERVICE_BUNDLE_EXCLUDED_TYPES = new Set<string>([
  "ACCOUNT_CREATION",
  "EPIC_ACCOUNT_CREATION",
  "HONSELL_GIFT_CARD",
]);

export function canBundleServiceType(type: string | null | undefined): boolean {
  return !SERVICE_BUNDLE_EXCLUDED_TYPES.has(String(type ?? ""));
}

/**
 * Xidmətin müştəridən NƏ tələb etdiyi.
 *   NONE           → heç nə (Netflix kod paketləri, PS Plus, TRY balans …)
 *   EMAIL          → tək e-poçt (STREAMING, `deliveryMode: "GMAIL"`)
 *   EMAIL_PASSWORD → e-poçt + şifrə (YouTube Premium, LinkedIn Premium)
 *   ACCOUNTS       → N ədəd e-poçt+şifrə cütü (Spotify Individual/Duo/Family)
 */
export type ServiceInputRequirement = {
  kind: "NONE" | "EMAIL" | "EMAIL_PASSWORD" | "ACCOUNTS";
  /** Yalnız ACCOUNTS: neçə hesab cütü tələb olunur. */
  accountSlots?: number;
  /** UI-də xananın etiketi. */
  emailLabel?: string;
  /** true → hər provayder qəbul olunur; false → yalnız @gmail.com. */
  allowAnyEmail?: boolean;
};

const NO_INPUT: ServiceInputRequirement = { kind: "NONE" };

/**
 * ⚠️ Bu funksiyanın məntiqi `app/api/cart/checkout/route.ts`-dəki STREAMING və
 * PLATFORM budaqları ilə EYNİ olmalıdır — server onsuz da yenidən validasiya edir,
 * ona görə fərq olsa müştəri səbətdə "hər şey qaydasındadır" görüb kassada 400 alır.
 * Yoxlama sırası da eynidir: əvvəl `accountSlots`, sonra kredensial tələbi.
 */
export function serviceInputRequirement(product: {
  type: string;
  metadata?: unknown;
}): ServiceInputRequirement {
  const meta = (product.metadata as Record<string, unknown> | null) ?? {};

  if (product.type === "STREAMING") {
    const deliveryMode = String(meta.deliveryMode ?? "CODE") === "GMAIL" ? "GMAIL" : "CODE";
    if (deliveryMode !== "GMAIL") return NO_INPUT;
    // Müştərinin öz hesabına qoşulan plan (Netflix VVIP, Evimdə VIP) —
    // e-poçt hər provayder ola bilər.
    const customerEmail = streamingUsesCustomerEmail(meta.service as string);
    return {
      kind: "EMAIL",
      allowAnyEmail: customerEmail,
      emailLabel: customerEmail ? "Netflix hesab e-poçtu" : "Gmail ünvanı",
    };
  }

  if (product.type === "PLATFORM") {
    const accountSlotsRaw = Number(meta.accountSlots);
    const accountSlots =
      Number.isInteger(accountSlotsRaw) && accountSlotsRaw >= 1 ? accountSlotsRaw : 0;
    if (accountSlots >= 1) {
      return { kind: "ACCOUNTS", accountSlots, allowAnyEmail: true, emailLabel: "Email" };
    }

    const category = String(meta.category ?? "");
    const musicBrand = String(meta.musicBrand ?? "");
    const planType = String(meta.planType ?? "");
    const isYoutube = category === "MUSIC" && musicBrand === "YOUTUBE_PREMIUM";
    const isLinkedIn = category === "WORK" && (planType === "CAREER" || planType === "BUSINESS");
    if (isYoutube) {
      return { kind: "EMAIL_PASSWORD", allowAnyEmail: false, emailLabel: "Gmail ünvanı" };
    }
    if (isLinkedIn) {
      return { kind: "EMAIL_PASSWORD", allowAnyEmail: true, emailLabel: "LinkedIn email ünvanı" };
    }
  }

  return NO_INPUT;
}

/**
 * Dəst üzvünün müştəri məlumatı tam doldurulubmu — doldurulmayıbsa səbəb mətni.
 *
 * ⚠️ Qaydalar `parseStreamingBody` / `parsePlatformAccounts`
 * (`app/api/cart/checkout/route.ts`) ilə eyni saxlanmalıdır: server onsuz da
 * yenidən yoxlayır, fərq olsa müştəri "hər şey qaydasındadır" görüb kassada 400 alır.
 */
export function validateServiceBundleMemberDetails(
  requirement: ServiceInputRequirement,
  details:
    | {
        gmail?: string;
        password?: string;
        accounts?: { email: string; password: string }[];
      }
    | undefined,
): string | null {
  const anyEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const gmailOnly = /^[^\s@]+@gmail\.com$/;

  if (requirement.kind === "NONE") return null;

  if (requirement.kind === "ACCOUNTS") {
    const slots = requirement.accountSlots ?? 0;
    const accounts = details?.accounts ?? [];
    if (accounts.length !== slots) {
      return `Bu plan üçün ${slots} hesab (email və şifrə) tələb olunur.`;
    }
    for (let i = 0; i < accounts.length; i++) {
      const email = (accounts[i]?.email ?? "").trim().toLowerCase();
      if (!email || !anyEmail.test(email)) {
        return `${i + 1}-ci hesab üçün etibarlı email tələb olunur.`;
      }
      if (!accounts[i]?.password || accounts[i].password.length < 4) {
        return `${i + 1}-ci hesab üçün şifrə tələb olunur (ən az 4 simvol).`;
      }
    }
    return null;
  }

  const label = requirement.emailLabel ?? "Gmail ünvanı";
  const email = (details?.gmail ?? "").trim().toLowerCase();
  const regex = requirement.allowAnyEmail ? anyEmail : gmailOnly;
  if (!email || !regex.test(email)) {
    return `Etibarlı ${label}${requirement.allowAnyEmail ? "" : " (@gmail.com)"} tələb olunur.`;
  }
  if (requirement.kind === "EMAIL_PASSWORD" && (!details?.password || details.password.length < 4)) {
    return "Hesab şifrəsi tələb olunur (ən az 4 simvol).";
  }
  return null;
}

/** Dəst daxilində bir xidmətin qiymət sətri. Bütün məbləğlər AZN qəpiklə. */
export type ServiceBundleItemPrice = {
  serviceProductId: string;
  title: string;
  imageUrl: string | null;
  serviceType: string;
  /** Xidmətin adi vitrin qiyməti. */
  listAznCents: number;
  /** Dəst daxilindəki qiymət — heç vaxt `listAznCents`-dən böyük olmur. */
  bundleAznCents: number;
  requirement: ServiceInputRequirement;
};

export type ServiceBundlePricing = {
  items: ServiceBundleItemPrice[];
  listTotalAznCents: number;
  totalAznCents: number;
  savingsAznCents: number;
  /** Faktiki endirim faizi (yuvarlaqlaşdırılmış); qənaət yoxdursa 0. */
  discountPct: number;
};

/** Vitrin (ana səhifə rail-i) üçün client-safe dəst görünüşü. */
export type ServiceBundleCardData = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  imageUrl: string | null;
  badgeText: string | null;
  pricing: ServiceBundlePricing;
};

/** Sətirlərdən cəm/qənaət/faiz çıxarır. */
export function summarizeServiceBundle(
  items: ServiceBundleItemPrice[],
): Omit<ServiceBundlePricing, "items"> {
  const listTotalAznCents = items.reduce((s, i) => s + i.listAznCents, 0);
  const totalAznCents = items.reduce((s, i) => s + i.bundleAznCents, 0);
  const savingsAznCents = Math.max(0, listTotalAznCents - totalAznCents);
  const discountPct =
    listTotalAznCents > 0 ? Math.round((savingsAznCents / listTotalAznCents) * 100) : 0;
  return { listTotalAznCents, totalAznCents, savingsAznCents, discountPct };
}

/**
 * Dəstin səbət payload-ı. `finalAzn` yalnız göstərim üçündür — checkout serverdə
 * qiyməti dəst id-sinə görə yenidən hesablayır.
 *
 * `serviceBundleItems` müştəri məlumatlarının (gmail/şifrə/hesablar) saxlandığı
 * yerdir: səbətdə hər üzv ayrıca redaktə olunur.
 */
export function buildServiceBundleCartPayload(bundle: ServiceBundleCardData) {
  return {
    id: bundle.id,
    title: bundle.title,
    imageUrl: bundle.imageUrl ?? bundle.pricing.items[0]?.imageUrl ?? null,
    finalAzn: bundle.pricing.totalAznCents / 100,
    productType: SERVICE_BUNDLE_PRODUCT_TYPE,
    serviceBundleItems: bundle.pricing.items.map((i) => ({
      serviceProductId: i.serviceProductId,
      title: i.title,
      imageUrl: i.imageUrl,
      serviceType: i.serviceType,
      listAznCents: i.listAznCents,
      bundleAznCents: i.bundleAznCents,
      requirement: i.requirement,
    })),
  };
}

export { formatAznCents };
