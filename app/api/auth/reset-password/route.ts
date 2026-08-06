import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { rateLimitMessage } from "@/lib/rateLimit";
import { findUserByIdentifier, readIdentifier } from "@/lib/authIdentifier";

export const runtime = "nodejs";

const MAX_OTP_ATTEMPTS = 5;
const OTP_LOCK_MINUTES = 15;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const code = String(body.code ?? "").trim();
  const password = String(body.password ?? "");

  // Kanal /forgot-password-dakı ilə EYNİ məntiqlə oxunur: müştəri e-poçtla
  // başlayıbsa email, nömrə ilə başlayıbsa phone göndərir. Ayrı məntiq yazılsa
  // 1-ci mərhələdə tapılan hesab 2-ci mərhələdə tapılmaya bilər.
  const id = readIdentifier(body);
  if (!id.ok) {
    return NextResponse.json({ error: id.error }, { status: 400 });
  }
  if (!code || !password) {
    return NextResponse.json(
      { error: "Bütün sahələr tələb olunur" },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Şifrə ən azı 8 simvol olmalıdır" },
      { status: 400 }
    );
  }

  const lookup = await findUserByIdentifier(id);
  const found = lookup.status === "found" ? lookup.user : null;
  const user = found
    ? await prisma.user.findUnique({ where: { id: found.id } })
    : null;
  if (!user || !user.otpCode || !user.otpExpiresAt) {
    return NextResponse.json(
      { error: "Kod yanlış və ya müddəti bitib" },
      { status: 400 }
    );
  }

  // Lockout aktivdirsə dərhal 429
  if (user.otpLockedUntil && user.otpLockedUntil.getTime() > Date.now()) {
    const retryAfterSeconds = Math.ceil(
      (user.otpLockedUntil.getTime() - Date.now()) / 1000
    );
    const retryAfterMinutes = Math.ceil(retryAfterSeconds / 60);
    return NextResponse.json(
      { error: rateLimitMessage(retryAfterMinutes, retryAfterSeconds) },
      { status: 429 }
    );
  }

  if (user.otpExpiresAt < new Date()) {
    return NextResponse.json({ error: "Kodun müddəti bitib" }, { status: 400 });
  }

  if (user.otpCode !== code) {
    const nextAttempts = (user.otpAttempts ?? 0) + 1;
    if (nextAttempts >= MAX_OTP_ATTEMPTS) {
      const lockUntil = new Date(Date.now() + OTP_LOCK_MINUTES * 60_000);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          otpAttempts: nextAttempts,
          otpLockedUntil: lockUntil,
          otpCode: null,
          otpExpiresAt: null,
        },
      });
      return NextResponse.json(
        { error: rateLimitMessage(OTP_LOCK_MINUTES, OTP_LOCK_MINUTES * 60) },
        { status: 429 }
      );
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { otpAttempts: nextAttempts },
    });
    const remaining = MAX_OTP_ATTEMPTS - nextAttempts;
    return NextResponse.json(
      { error: `Kod yanlışdır. ${remaining} cəhd qaldı.` },
      { status: 400 }
    );
  }

  // `emailVerified` bu layihədə "HESAB təsdiqlənib" mənasını daşıyır, hərfi
  // "e-poçt sübut olundu" deyil: qeydiyyat OTP-si də yalnız WhatsApp ilə gedir
  // və `/api/auth/verify-otp` həmin koddan sonra eyni sahəni true edir. Ona görə
  // kod WhatsApp-dan gəlsə də burada true yazılır — əks halda nömrə ilə şifrəni
  // yeniləyən istifadəçi login-də (`!user.emailVerified`) bloklanardı.
  // Köhnə set-password token-i də təmizlənir ki, sıfırlamadan sonra işləməsin.
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: hashPassword(password),
      emailVerified: true,
      otpCode: null,
      otpExpiresAt: null,
      otpAttempts: 0,
      otpLockedUntil: null,
      setPasswordToken: null,
      setPasswordTokenExpiresAt: null,
    },
  });

  return NextResponse.json({ ok: true });
}
