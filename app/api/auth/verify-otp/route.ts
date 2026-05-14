import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { sendAdminNewUserNotification, sendWelcomeEmail } from "@/lib/resend";
import { rateLimitMessage } from "@/lib/rateLimit";

export const runtime = "nodejs";

const MAX_OTP_ATTEMPTS = 5;
const OTP_LOCK_MINUTES = 15;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const code = String(body.code ?? "").trim();

  if (!email || !/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: "E-poçt və 6 rəqəmli kod tələb olunur" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.otpCode || !user.otpExpiresAt) {
    return NextResponse.json(
      { error: "Bu e-poçt üçün aktiv təsdiq prosesi yoxdur" },
      { status: 404 }
    );
  }

  // ── Lockout aktivdirsə dərhal 429 ──────────────────────────────────────────
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

  if (user.otpExpiresAt.getTime() < Date.now()) {
    return NextResponse.json(
      { error: "Kodun müddəti bitib. Yeni kod tələb et." },
      { status: 410 }
    );
  }

  if (user.otpCode !== code) {
    // ── Səhv kod: counter artır, limitə çatdıqda kilidlə ─────────────────────
    const nextAttempts = (user.otpAttempts ?? 0) + 1;
    if (nextAttempts >= MAX_OTP_ATTEMPTS) {
      const lockUntil = new Date(Date.now() + OTP_LOCK_MINUTES * 60_000);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          otpAttempts: nextAttempts,
          otpLockedUntil: lockUntil,
          // Kodu sıfırla — istifadəçi yenidən tələb etməlidir.
          otpCode: null,
          otpExpiresAt: null,
        },
      });
      return NextResponse.json(
        {
          error: rateLimitMessage(OTP_LOCK_MINUTES, OTP_LOCK_MINUTES * 60),
        },
        { status: 429 }
      );
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { otpAttempts: nextAttempts },
    });
    const remaining = MAX_OTP_ATTEMPTS - nextAttempts;
    return NextResponse.json(
      { error: `Kod səhvdir. ${remaining} cəhd qaldı.` },
      { status: 401 }
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      otpCode: null,
      otpExpiresAt: null,
      otpAttempts: 0,
      otpLockedUntil: null,
    },
  });

  try {
    await sendWelcomeEmail(email, user.name ?? email.split("@")[0], user.referralCode);
  } catch (err) {
    console.error("welcome email failed", err);
  }

  try {
    await sendAdminNewUserNotification({
      userId: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
    });
  } catch (err) {
    console.error("admin new-user notify failed", err);
  }

  const res = NextResponse.json({
    ok: true,
    id: user.id,
    email: user.email,
    referralCode: user.referralCode,
  });
  res.cookies.set(SESSION_COOKIE_NAME, user.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
