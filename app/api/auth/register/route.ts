import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateReferralCode, hashPassword } from "@/lib/auth";
import { generateOtpCode, OTP_TTL_MINUTES } from "@/lib/resend";
import { deliverSignupOtp } from "@/lib/otpDelivery";
import { getClientIp, ensureDeviceId, readDeviceId } from "@/lib/clientInfo";
import {
  consumeDistinctRateLimit,
  consumeRateLimit,
  rateLimitMessage,
} from "@/lib/rateLimit";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { normalizeHeardAboutSource } from "@/lib/heardAbout";
import { normalizeFullName, MIN_NAME_LENGTH } from "@/lib/nameFormat";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    // Ad-soyad: registr normallaşdırılır (tam böyük/kiçik → "Ad Soyad").
    const name = normalizeFullName(body.name != null ? String(body.name) : "");
    const phone = body.phone ? String(body.phone).trim() : null;
    const captchaToken = typeof body.captchaToken === "string" ? body.captchaToken : "";
    const referralCode = body.referralCode
      ? String(body.referralCode).trim().toUpperCase()
      : null;
    const heardAboutSource = normalizeHeardAboutSource(body.heardAboutSource);

    if (!name) {
      return NextResponse.json({ error: "Ad Soyad tələb olunur" }, { status: 400 });
    }
    if (name.length < MIN_NAME_LENGTH) {
      return NextResponse.json(
        { error: `Ad Soyad ən azı ${MIN_NAME_LENGTH} simvol olmalıdır` },
        { status: 400 }
      );
    }
    if (!phone) {
      return NextResponse.json({ error: "Telefon nömrəsi tələb olunur" }, { status: 400 });
    }
    if (!email || !password || password.length < 8) {
      return NextResponse.json(
        { error: "E-poçt və şifrə (ən azı 8 simvol) tələb olunur" },
        { status: 400 }
      );
    }
    if (!heardAboutSource) {
      return NextResponse.json(
        { error: "Bizi haradan eşitdiyinizi seçin" },
        { status: 400 }
      );
    }

    const ip = getClientIp(req);
    const deviceId = await readDeviceId();

    // ── Captcha (Turnstile) ────────────────────────────────────────────────────
    const captcha = await verifyTurnstileToken(captchaToken, ip);
    if (!captcha.ok) {
      return NextResponse.json(
        { error: "Captcha doğrulaması alınmadı. Səhifəni yenilə və yenidən sına." },
        { status: 400 }
      );
    }

    // ── Rate limits ─────────────────────────────────────────────────────────────
    // 1) IP + 5 dəq ərzində max 2 fərqli telefon
    const ipDistinct = await consumeDistinctRateLimit({
      key: `register:ip:${ip}`,
      scope: "register",
      identifier: phone,
      windowSeconds: 300,
      maxDistinct: 2,
    });
    if (!ipDistinct.ok) {
      return NextResponse.json(
        { error: rateLimitMessage(ipDistinct.retryAfterMinutes, ipDistinct.retryAfterSeconds) },
        { status: 429 }
      );
    }

    // 2) Eyni cihaz cookie + 5 dəq ərzində max 2 fərqli telefon
    if (deviceId !== "anon") {
      const deviceDistinct = await consumeDistinctRateLimit({
        key: `register:device:${deviceId}`,
        scope: "register",
        identifier: phone,
        windowSeconds: 300,
        maxDistinct: 2,
      });
      if (!deviceDistinct.ok) {
        return NextResponse.json(
          {
            error: rateLimitMessage(
              deviceDistinct.retryAfterMinutes,
              deviceDistinct.retryAfterSeconds
            ),
          },
          { status: 429 }
        );
      }
    }

    // 3) IP + saatda max 5 qeydiyyat cəhdi
    const ipHourly = await consumeRateLimit({
      key: `register:ip-hourly:${ip}`,
      scope: "register",
      windowSeconds: 3600,
      max: 5,
    });
    if (!ipHourly.ok) {
      return NextResponse.json(
        { error: rateLimitMessage(ipHourly.retryAfterMinutes, ipHourly.retryAfterSeconds) },
        { status: 429 }
      );
    }

    // 4) Telefon + 24 saatda max 3 OTP
    const phoneDaily = await consumeRateLimit({
      key: `register:phone:${phone}`,
      scope: "register",
      windowSeconds: 86400,
      max: 3,
    });
    if (!phoneDaily.ok) {
      return NextResponse.json(
        {
          error: rateLimitMessage(
            phoneDaily.retryAfterMinutes,
            phoneDaily.retryAfterSeconds
          ),
        },
        { status: 429 }
      );
    }

    // ── Mövcud istifadəçi yoxlamaları ──────────────────────────────────────────
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.emailVerified) {
      return NextResponse.json({ error: "Bu e-poçt artıq istifadə olunur" }, { status: 409 });
    }

    if (existing && !existing.emailVerified) {
      return NextResponse.json(
        {
          error:
            "Bu e-poçtla hesabınız var. Şifrəni yenilə düyməsinə basaraq şifrənizi yeniləyin.",
          accountExists: true,
          needsPasswordReset: true,
          email,
        },
        { status: 409 }
      );
    }

    // Eyni telefon nömrəsi ilə başqa hesab varsa, yenisi yaradıla bilməz.
    const phoneOwner = await prisma.user.findFirst({ where: { phone } });
    if (phoneOwner) {
      if (phoneOwner.emailVerified) {
        return NextResponse.json(
          { error: "Bu telefon nömrəsi artıq istifadə olunur." },
          { status: 409 }
        );
      }
      return NextResponse.json(
        {
          error:
            "Bu telefon nömrəsi ilə tamamlanmamış hesab var. Şifrəni yenilə düyməsinə basaraq hesabı bərpa et.",
          accountExists: true,
          needsPasswordReset: true,
          email: phoneOwner.email,
        },
        { status: 409 }
      );
    }

    let referredById: string | null = null;
    if (referralCode) {
      const referrer = await prisma.user.findUnique({ where: { referralCode } });
      if (!referrer) {
        return NextResponse.json({ error: "Referal kodu səhvdir" }, { status: 400 });
      }
      referredById = referrer.id;
    }

    const otpCode = generateOtpCode();
    const otpExpiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

    let createdUserId: string | null = null;
    {
      let code = generateReferralCode();
      for (let i = 0; i < 5; i++) {
        const clash = await prisma.user.findUnique({ where: { referralCode: code } });
        if (!clash) break;
        code = generateReferralCode();
      }

      const created = await prisma.user.create({
        data: {
          email,
          name,
          phone,
          passwordHash: hashPassword(password),
          referralCode: code,
          referredById,
          heardAboutSource,
          otpCode,
          otpExpiresAt,
        },
      });
      createdUserId = created.id;
    }

    let channel;
    try {
      channel = await deliverSignupOtp({
        email,
        phone,
        userName: name ?? email.split("@")[0],
        code: otpCode,
      });
    } catch (deliveryError) {
      console.error("[register] OTP delivery failed:", deliveryError);
      if (createdUserId) {
        await prisma.user.delete({ where: { id: createdUserId } }).catch(() => {});
      }
      const message =
        deliveryError instanceof Error
          ? deliveryError.message
          : "WhatsApp təsdiq kodu göndərilə bilmədi. Bir az sonra yenidən cəhd et.";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const res = NextResponse.json({
      ok: true,
      email,
      expiresInMinutes: OTP_TTL_MINUTES,
      channel,
    });
    await ensureDeviceId(res); // yeni gələnlər üçün cihaz cookie-si təyin et
    return res;
  } catch (err) {
    console.error("[register] error:", err);
    const message = err instanceof Error ? err.message : "Server xətası";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
