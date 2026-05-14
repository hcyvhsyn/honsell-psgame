import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { rateLimitMessage } from "@/lib/rateLimit";

export const runtime = "nodejs";

const MAX_OTP_ATTEMPTS = 5;
const OTP_LOCK_MINUTES = 15;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const code = String(body.code ?? "").trim();
  const password = String(body.password ?? "");

  if (!email || !code || !password) {
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

  const user = await prisma.user.findUnique({ where: { email } });
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

  // Receiving the OTP proves email ownership, so verify the email here too —
  // covers self-signups that never confirmed and admin-created accounts that
  // never opened their /set-password link. Also clear any stale set-password
  // token so it can't be reused after a password reset.
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
