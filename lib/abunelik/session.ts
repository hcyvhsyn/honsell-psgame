import { getCurrentUser } from "@/lib/auth";

export { createPhoneToken, verifyPhoneToken, isAbunelikConfigured, ABUNELIK_TTL_SECONDS } from "@/lib/abunelik/token";
export { sessionCookieOptions } from "@/lib/auth";

/**
 * CRM abunəlikləri (giriş məlumatları daxil) YALNIZ saytda daxil olmuş istifadəçiyə, profil bölməsində
 * (/profile/abunelikler) göstərilir və YALNIZ onun WhatsApp ilə sübut olunmuş nömrəsi ilə çəkilir
 * (`User.verifiedPhone`) — `User.phone` ilə YOX (profil səhifəsindən kodsuz dəyişir).
 *
 * Nömrə sübutu: CRM-in WhatsApp birbaşa giriş linki, /abunelik WhatsApp kodu, WhatsApp kodu ilə qeydiyyat
 * təsdiqi. Sübut `VERIFIED_PHONE_TTL_DAYS` gün etibarlıdır (nömrə başqasına keçə bilər) — CRM-in həftəlik
 * linki aktiv müştəri üçün onu özü yeniləyir, yoxsa profil səhifəsi kodu yenidən istəyir.
 * Sessiya cookie-si imzalıdır (lib/auth.ts).
 */
export const VERIFIED_PHONE_TTL_DAYS = 90;

/** Köhnə ayrıca telefon cookie-si — artıq yazılmır, çıxışda silinir. */
export const ABUNELIK_COOKIE = "honsell_abunelik";

export type VerifiedPhone = { e164: string; phone9: string; uid: string };

export function isPhoneVerificationFresh(at: Date | null | undefined): boolean {
  return !!at && Date.now() - at.getTime() < VERIFIED_PHONE_TTL_DAYS * 24 * 60 * 60 * 1000;
}

/** Cari daxil olmuş istifadəçinin sübut olunmuş nömrəsi (route handler / server komponenti). */
export async function resolveVerifiedPhone(): Promise<VerifiedPhone | null> {
  const user = await getCurrentUser();
  if (!user || user.disabled || !user.verifiedPhone) return null;
  if (!isPhoneVerificationFresh(user.phoneVerifiedAt)) return null;
  const digits = user.verifiedPhone.replace(/\D/g, "");
  if (digits.length < 9) return null;
  return { e164: user.verifiedPhone, phone9: digits.slice(-9), uid: user.id };
}

/**
 * Funksiya açarı — DEFAULT AÇIQDIR; yalnız `ABUNELIK_ENABLED=0` söndürür (səhifə "Tezliklə", API-lər 404,
 * CRM-in WhatsApp linki 409 DISABLED alır və göndərilmir). Əvvəl `=1` tələb edirdi və prod-da təyin olunmadığı
 * üçün profildə abunəliklər görünmür, CRM linkləri də getmirdi.
 */
export function isAbunelikEnabled(): boolean {
  return process.env.ABUNELIK_ENABLED?.trim() !== "0";
}
