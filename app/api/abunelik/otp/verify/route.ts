import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeAzPhone } from "@/lib/abunelik/phone";
import { isAbunelikConfigured, isAbunelikEnabled } from "@/lib/abunelik/session";
import { OTP_MAX_ATTEMPTS, OTP_PURPOSE, otpMatches } from "@/lib/abunelik/otp";
import { loginByPhone } from "@/lib/abunelik/login";
import { readSessionUserIdFromCookies, setSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/abunelik/otp/verify  { phone, code, attach? }
 * Kod doğrudursa nömrə sübut olunur (lib/abunelik/login.ts → loginByPhone):
 *   - `attach: true` (profildə "nömrəni təsdiqlə", daxil olmuş istifadəçi) → nömrə ÖZ hesabına bağlanır;
 *   - əks halda nömrəyə bağlı hesaba daxil edilir (yoxdursa telefon hesabı açılır);
 *   - bir neçə hesab → `account: "ambiguous"` (e-poçt + şifrə ilə giriş).
 * Cavab: `{ ok, account, redirect }`.
 */
export async function POST(req: Request) {
  if (!isAbunelikEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isAbunelikConfigured()) return NextResponse.json({ error: "Giriş müvəqqəti əlçatmazdır." }, { status: 503 });

  const body = (await req.json().catch(() => null)) as { phone?: string; code?: string; attach?: boolean } | null;
  const attach = body?.attach === true;
  if (attach && !readSessionUserIdFromCookies()) {
    return NextResponse.json({ error: "Sessiya bitib. Hesabınıza yenidən daxil olun." }, { status: 401 });
  }
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
  const login = await loginByPhone(req, phone, { attachToSession: attach });
  const redirect =
    login.account === "ambiguous" ? "/abunelik?giris=coxlu" : "/profile/abunelikler";
  const res = NextResponse.json({ ok: true, account: login.account, redirect });
  if (login.newSession && login.userId) setSessionCookie(res, login.userId);
  return res;
}
