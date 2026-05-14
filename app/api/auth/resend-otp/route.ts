import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOtpCode, OTP_TTL_MINUTES } from "@/lib/resend";
import { deliverSignupOtp } from "@/lib/otpDelivery";
import { checkCooldown, consumeRateLimit, rateLimitMessage } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "E-poçt tələb olunur" }, { status: 400 });
  }

  // ── Per-email cooldown (60s) — istənilən email üçün, hesab olub-olmaması
  // önəmli deyil; enumeration üçün eyni cavabı veririk ─────────────────────────
  const cooldownKey = `resend-otp:email:${email}`;
  const cooldown = await checkCooldown({ key: cooldownKey, cooldownSeconds: 60 });
  if (!cooldown.ok) {
    return NextResponse.json(
      { error: rateLimitMessage(cooldown.retryAfterMinutes, cooldown.retryAfterSeconds) },
      { status: 429 }
    );
  }

  // ── Per-email saatlıq limit (5/saat) ───────────────────────────────────────
  const hourly = await consumeRateLimit({
    key: cooldownKey,
    scope: "resend-otp",
    windowSeconds: 3600,
    max: 5,
  });
  if (!hourly.ok) {
    return NextResponse.json(
      { error: rateLimitMessage(hourly.retryAfterMinutes, hourly.retryAfterSeconds) },
      { status: 429 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ ok: true, expiresInMinutes: OTP_TTL_MINUTES });
  }

  if (user.emailVerified) {
    return NextResponse.json({ error: "E-poçt artıq təsdiqlənib" }, { status: 400 });
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

  const channel = await deliverSignupOtp({
    email,
    phone: user.phone,
    userName: user.name ?? email.split("@")[0],
    code: otpCode,
  });

  return NextResponse.json({ ok: true, expiresInMinutes: OTP_TTL_MINUTES, channel });
}
