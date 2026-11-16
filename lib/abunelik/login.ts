import type { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { getClientIp } from "@/lib/clientInfo";
import { findUsersByPhone9 } from "@/lib/abunelik/phone";
import { ABUNELIK_COOKIE, createPhoneToken, phoneCookieOptions, sessionCookieOptions } from "@/lib/abunelik/session";

/**
 * Telefon sübut olunduqdan sonra (OTP kodu və ya WhatsApp birbaşa giriş linki) sayt hesabı:
 *   - artıq daxil olubsa → həmin hesab saxlanılır ("session");
 *   - nömrəyə TƏK aktiv (admin olmayan) hesab uyğun gəlirsə → ona daxil edilir ("linked");
 *   - yoxdursa → "none" (hesab ödəniş anında yaradılır);
 *   - bir neçə hesab → "ambiguous" (ödəniş üçün şifrə ilə giriş).
 */
export type PhoneLoginAccount = "session" | "linked" | "none" | "ambiguous";
export type PhoneLogin = { account: PhoneLoginAccount; uid: string | null; loginUserId: string | null };

export async function resolvePhoneLogin(phone: { e164: string; phone9: string }): Promise<PhoneLogin> {
  const sessionUid = cookies().get(SESSION_COOKIE_NAME)?.value || null;
  const current = sessionUid ? await prisma.user.findUnique({ where: { id: sessionUid } }) : null;
  if (current && !current.disabled) {
    if (!current.phone) await prisma.user.update({ where: { id: current.id }, data: { phone: phone.e164 } });
    return { account: "session", uid: current.id, loginUserId: null };
  }
  const candidates = (await findUsersByPhone9(phone.phone9)).filter((u) => !u.disabled && u.role !== "ADMIN");
  if (candidates.length === 1) return { account: "linked", uid: candidates[0].id, loginUserId: candidates[0].id };
  return { account: candidates.length === 0 ? "none" : "ambiguous", uid: null, loginUserId: null };
}

/** Telefon cookie-si + (lazımdırsa) sayt sessiyası. */
export async function applyPhoneLogin(
  res: NextResponse,
  req: Request,
  phone: { e164: string; phone9: string },
  login: PhoneLogin,
): Promise<void> {
  res.cookies.set(ABUNELIK_COOKIE, createPhoneToken({ e164: phone.e164, phone9: phone.phone9, uid: login.uid }), phoneCookieOptions);
  if (!login.loginUserId) return;
  const ip = getClientIp(req);
  await prisma.user.update({
    where: { id: login.loginUserId },
    data: {
      lastLoginAt: new Date(),
      lastLoginIp: ip === "unknown" ? null : ip,
      lastUserAgent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
      loginCount: { increment: 1 },
    },
  });
  res.cookies.set(SESSION_COOKIE_NAME, login.loginUserId, sessionCookieOptions);
}
