import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { ABUNELIK_TTL_SECONDS, verifyPhoneToken } from "@/lib/abunelik/token";

export { createPhoneToken, verifyPhoneToken, isAbunelikConfigured, ABUNELIK_TTL_SECONDS } from "@/lib/abunelik/token";

/**
 * /abunelik "təsdiqlənmiş telefon" cookie-si: OTP ilə sübut olunmuş nömrə, HMAC ilə imzalı, 2 saat.
 * CRM datası (hesab məlumatları daxil) YALNIZ bu cookie-dəki nömrə ilə çəkilir — `User.phone` ilə yox
 * (o, profil səhifəsindən OTP-siz dəyişdirilə bilir) və xam `honsell_session` (User.id) ilə yox.
 *
 * `uid`: cookie verilən anda daxil olmuş sayt hesabı. Sonra BAŞQA hesab daxil olubsa cookie rədd edilir
 * (paylaşılan cihazda hesab dəyişəndə əvvəlki şəxsin abunəlikləri görünməsin).
 */
export const ABUNELIK_COOKIE = "honsell_abunelik";

/** Cari sorğunun təsdiqlənmiş telefonu (server komponenti / route handler). */
export function readVerifiedPhone(): { e164: string; phone9: string; uid: string | null } | null {
  const jar = cookies();
  const p = verifyPhoneToken(jar.get(ABUNELIK_COOKIE)?.value);
  if (!p) return null;
  const sessionUid = jar.get(SESSION_COOKIE_NAME)?.value || null;
  if (p.uid && sessionUid && p.uid !== sessionUid) return null;
  return { e164: p.e164, phone9: p.p9, uid: p.uid };
}

export const phoneCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: ABUNELIK_TTL_SECONDS,
};

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 30,
};

/** Funksiya açarı: ABUNELIK_ENABLED=1 olmadan səhifə "Tezliklə", API-lər 404. */
export function isAbunelikEnabled(): boolean {
  return process.env.ABUNELIK_ENABLED?.trim() === "1";
}
