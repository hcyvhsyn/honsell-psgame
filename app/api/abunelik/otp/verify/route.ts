import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeAzPhone } from "@/lib/abunelik/phone";
import { isAbunelikConfigured, isAbunelikEnabled } from "@/lib/abunelik/session";
import { OTP_MAX_ATTEMPTS, OTP_PURPOSE, otpMatches } from "@/lib/abunelik/otp";
import { applyPhoneLogin, resolvePhoneLogin } from "@/lib/abunelik/login";

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

  // ── Sayt hesabı (lib/abunelik/login.ts — WhatsApp birbaşa giriş linki ilə ortaq) ──
  const login = await resolvePhoneLogin(phone);
  const res = NextResponse.json({ ok: true, account: login.account });
  await applyPhoneLogin(res, req, phone, login);
  return res;
}
