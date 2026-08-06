import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOtpCode, OTP_TTL_MINUTES } from "@/lib/resend";
import { deliverResetPasswordOtp } from "@/lib/otpDelivery";
import {
  findUserByIdentifier,
  identifierKey,
  readIdentifier,
} from "@/lib/authIdentifier";
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
  const captchaToken = typeof body.captchaToken === "string" ? body.captchaToken : "";

  // Müştəri kanalı özü seçir: e-poçt (email) və ya WhatsApp (phone).
  const id = readIdentifier(body);
  if (!id.ok) {
    return NextResponse.json({ error: id.error }, { status: 400 });
  }
  const key = identifierKey(id);

  const ip = getClientIp(req);

  // ── Captcha ────────────────────────────────────────────────────────────────
  const captcha = await verifyTurnstileToken(captchaToken, ip);
  if (!captcha.ok) {
    return NextResponse.json(
      { error: "Captcha doğrulaması alınmadı. Səhifəni yenilə və yenidən sına." },
      { status: 400 }
    );
  }

  // ── IP + dəqiqədə max 5 fərqli identifikator ───────────────────────────────
  const ipDistinct = await consumeDistinctRateLimit({
    key: `forgot-password:ip:${ip}`,
    scope: "forgot-password",
    identifier: key,
    windowSeconds: 60,
    maxDistinct: 5,
  });
  if (!ipDistinct.ok) {
    return NextResponse.json(
      { error: rateLimitMessage(ipDistinct.retryAfterMinutes, ipDistinct.retryAfterSeconds) },
      { status: 429 }
    );
  }

  // ── İdentifikator + saatda max 3 dəfə ──────────────────────────────────────
  const perIdentifier = await consumeRateLimit({
    key: `forgot-password:id:${key}`,
    scope: "forgot-password",
    windowSeconds: 3600,
    max: 3,
  });
  if (!perIdentifier.ok) {
    return NextResponse.json(
      {
        error: rateLimitMessage(
          perIdentifier.retryAfterMinutes,
          perIdentifier.retryAfterSeconds
        ),
      },
      { status: 429 }
    );
  }

  const lookup = await findUserByIdentifier(id);

  // Bir nömrəyə iki hesab bağlıdırsa hansını sıfırladığımız məlum deyil — kod
  // göndərmək yanlış hesabı riskə salır, ona görə e-poçta yönləndiririk.
  if (lookup.status === "ambiguous") {
    return NextResponse.json(
      {
        error:
          "Bu nömrə ilə birdən çox hesab tapıldı. Zəhmət olmasa e-poçt ilə davam et.",
      },
      { status: 409 }
    );
  }

  // Account enumeration qarşısı — hesab olub-olmamasına baxmayaraq eyni cavab.
  if (lookup.status === "none") {
    return NextResponse.json({
      ok: true,
      channel: id.channel,
      expiresInMinutes: OTP_TTL_MINUTES,
    });
  }

  const user = lookup.user;
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

  try {
    await deliverResetPasswordOtp({
      email: user.email,
      // Kod HƏMİŞƏ hesabda qeydli nömrəyə gedir, formadan gələn xam mətnə yox.
      phone: user.phone,
      userName: user.name ?? user.email.split("@")[0],
      code: otpCode,
      channel: id.channel,
    });
  } catch (err) {
    // Seçilmiş kanal işləmirsə səssizcə digərinə keçmirik — istifadəçi kodu
    // gözlədiyi yerdə axtarsın deyə səhvi açıq bildiririk.
    const message =
      err instanceof Error ? err.message : "Kod göndərilə bilmədi. Yenidən sına.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    channel: id.channel,
    expiresInMinutes: OTP_TTL_MINUTES,
  });
}
