import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOtpCode, OTP_TTL_MINUTES } from "@/lib/resend";
import { deliverResetPasswordOtp } from "@/lib/otpDelivery";
import { getClientIp } from "@/lib/clientInfo";
import {
  consumeDistinctRateLimit,
  consumeRateLimit,
  rateLimitMessage,
} from "@/lib/rateLimit";
import { verifyTurnstileToken } from "@/lib/turnstile";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const captchaToken = typeof body.captchaToken === "string" ? body.captchaToken : "";

  if (!email) {
    return NextResponse.json({ error: "E-poçt tələb olunur" }, { status: 400 });
  }

  const ip = getClientIp(req);

  // ── Captcha ────────────────────────────────────────────────────────────────
  const captcha = await verifyTurnstileToken(captchaToken, ip);
  if (!captcha.ok) {
    return NextResponse.json(
      { error: "Captcha doğrulaması alınmadı. Səhifəni yenilə və yenidən sına." },
      { status: 400 }
    );
  }

  // ── IP + dəqiqədə max 5 fərqli email ───────────────────────────────────────
  const ipDistinct = await consumeDistinctRateLimit({
    key: `forgot-password:ip:${ip}`,
    scope: "forgot-password",
    identifier: email,
    windowSeconds: 60,
    maxDistinct: 5,
  });
  if (!ipDistinct.ok) {
    return NextResponse.json(
      { error: rateLimitMessage(ipDistinct.retryAfterMinutes, ipDistinct.retryAfterSeconds) },
      { status: 429 }
    );
  }

  // ── Email + saatda max 3 dəfə ──────────────────────────────────────────────
  const emailHourly = await consumeRateLimit({
    key: `forgot-password:email:${email}`,
    scope: "forgot-password",
    windowSeconds: 3600,
    max: 3,
  });
  if (!emailHourly.ok) {
    return NextResponse.json(
      {
        error: rateLimitMessage(
          emailHourly.retryAfterMinutes,
          emailHourly.retryAfterSeconds
        ),
      },
      { status: 429 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Account enumeration qarşısı — hesab olub-olmamasına baxmayaraq eyni cavab.
  if (!user) {
    return NextResponse.json({ ok: true, expiresInMinutes: OTP_TTL_MINUTES });
  }

  const otpCode = generateOtpCode();
  const otpExpiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      otpCode,
      otpExpiresAt,
      otpAttempts: 0,
      otpLockedUntil: null,
    },
  });

  await deliverResetPasswordOtp({
    email,
    phone: user.phone,
    userName: user.name ?? email.split("@")[0],
    code: otpCode,
  });

  return NextResponse.json({ ok: true, expiresInMinutes: OTP_TTL_MINUTES });
}
