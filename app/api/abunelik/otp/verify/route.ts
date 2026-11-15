import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { findUsersByPhone9, normalizeAzPhone } from "@/lib/abunelik/phone";
import {
  ABUNELIK_COOKIE,
  createPhoneToken,
  isAbunelikConfigured,
  isAbunelikEnabled,
  phoneCookieOptions,
  sessionCookieOptions,
} from "@/lib/abunelik/session";
import { OTP_MAX_ATTEMPTS, OTP_PURPOSE, otpMatches } from "@/lib/abunelik/otp";
import { getClientIp } from "@/lib/clientInfo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/abunelik/otp/verify  { phone, code }
 * Kod doğrudursa imzalı telefon cookie-si qoyulur. Sayt hesabı:
 *   - artıq daxil olubsa → həmin hesab saxlanılır;
 *   - nömrəyə TƏK aktiv (admin olmayan) hesab uyğun gəlirsə → ona daxil edilir;
 *   - yoxdursa → `account: "none"` (hesab ödəniş anında yaradılır);
 *   - bir neçə hesab → `account: "ambiguous"` (ödəniş üçün şifrə ilə giriş).
 */
export async function POST(req: Request) {
  if (!isAbunelikEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isAbunelikConfigured()) return NextResponse.json({ error: "Giriş müvəqqəti əlçatmazdır." }, { status: 503 });

  const body = (await req.json().catch(() => null)) as { phone?: string; code?: string } | null;
  const phone = normalizeAzPhone(body?.phone);
  const code = String(body?.code ?? "").replace(/\D/g, "");
  if (!phone || code.length !== 6) {
    return NextResponse.json({ error: "Nömrə və ya kod düzgün deyil." }, { status: 400 });
  }

  const otp = await prisma.phoneOtp.findFirst({
    where: {
      phoneE164: phone.e164,
      purpose: OTP_PURPOSE,
      consumedAt: null,
      expiresAt: { gt: new Date() },
      attempts: { lt: OTP_MAX_ATTEMPTS },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) {
    return NextResponse.json({ error: "Kod yanlışdır və ya vaxtı bitib. Yeni kod istəyin." }, { status: 401 });
  }
  const bumped = await prisma.phoneOtp.updateMany({
    where: { id: otp.id, consumedAt: null, attempts: { lt: OTP_MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  if (bumped.count !== 1) {
    return NextResponse.json({ error: "Çox sayda cəhd. Yeni kod istəyin." }, { status: 401 });
  }
  if (!otpMatches(phone.e164, code, otp.codeHash)) {
    const left = OTP_MAX_ATTEMPTS - (otp.attempts + 1);
    return NextResponse.json(
      { error: left > 0 ? `Kod yanlışdır. ${left} cəhd qaldı.` : "Çox sayda yanlış cəhd. Yeni kod istəyin." },
      { status: 401 },
    );
  }
  const consumed = await prisma.phoneOtp.updateMany({
    where: { id: otp.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumed.count !== 1) {
    return NextResponse.json({ error: "Kod artıq istifadə olunub. Yeni kod istəyin." }, { status: 401 });
  }

  // ── Sayt hesabı ──
  const sessionUid = cookies().get(SESSION_COOKIE_NAME)?.value || null;
  const current = sessionUid ? await prisma.user.findUnique({ where: { id: sessionUid } }) : null;

  let uid: string | null = null;
  let account: "session" | "linked" | "none" | "ambiguous";
  let loginUserId: string | null = null;
  if (current && !current.disabled) {
    uid = current.id;
    account = "session";
    if (!current.phone) await prisma.user.update({ where: { id: current.id }, data: { phone: phone.e164 } });
  } else {
    const candidates = (await findUsersByPhone9(phone.phone9)).filter((u) => !u.disabled && u.role !== "ADMIN");
    if (candidates.length === 1) {
      uid = candidates[0].id;
      loginUserId = uid;
      account = "linked";
    } else {
      account = candidates.length === 0 ? "none" : "ambiguous";
    }
  }

  const res = NextResponse.json({ ok: true, account });
  res.cookies.set(ABUNELIK_COOKIE, createPhoneToken({ e164: phone.e164, phone9: phone.phone9, uid }), phoneCookieOptions);
  if (loginUserId) {
    await prisma.user.update({
      where: { id: loginUserId },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: getClientIp(req) === "unknown" ? null : getClientIp(req),
        lastUserAgent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
        loginCount: { increment: 1 },
      },
    });
    res.cookies.set(SESSION_COOKIE_NAME, loginUserId, sessionCookieOptions);
  }
  return res;
}
