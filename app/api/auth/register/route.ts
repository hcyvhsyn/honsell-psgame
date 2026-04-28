import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateReferralCode, hashPassword } from "@/lib/auth";
import {
  generateOtpCode,
  OTP_TTL_MINUTES,
  sendOtpEmail,
} from "@/lib/resend";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const name = body.name ? String(body.name).trim() : null;
  const phone = body.phone ? String(body.phone).trim() : null;
  const referralCode = body.referralCode
    ? String(body.referralCode).trim().toUpperCase()
    : null;

  if (!name) {
    return NextResponse.json(
      { error: "Ad Soyad tələb olunur" },
      { status: 400 }
    );
  }
  if (!phone) {
    return NextResponse.json(
      { error: "Telefon nömrəsi tələb olunur" },
      { status: 400 }
    );
  }
  if (!email || !password || password.length < 8) {
    return NextResponse.json(
      { error: "E-poçt və şifrə (ən azı 8 simvol) tələb olunur" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.emailVerified) {
    return NextResponse.json({ error: "Bu e-poçt artıq istifadə olunur" }, { status: 409 });
  }

  let referredById: string | null = existing?.referredById ?? null;
  if (referralCode && !existing) {
    const referrer = await prisma.user.findUnique({
      where: { referralCode },
    });
    if (!referrer) {
      return NextResponse.json(
        { error: "Referal kodu səhvdir" },
        { status: 400 }
      );
    }
    referredById = referrer.id;
  }

  const otpCode = generateOtpCode();
  const otpExpiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

  if (existing) {
    // User signed up before but never verified — refresh the record so the
    // latest password / name takes effect, then re-send the code.
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name,
        phone,
        passwordHash: hashPassword(password),
        otpCode,
        otpExpiresAt,
      },
    });
  } else {
    let code = generateReferralCode();
    for (let i = 0; i < 5; i++) {
      const clash = await prisma.user.findUnique({
        where: { referralCode: code },
      });
      if (!clash) break;
      code = generateReferralCode();
    }

    await prisma.user.create({
      data: {
        email,
        name,
        phone,
        passwordHash: hashPassword(password),
        referralCode: code,
        referredById,
        otpCode,
        otpExpiresAt,
      },
    });
  }

  await sendOtpEmail(email, name ?? email.split("@")[0], otpCode);

  return NextResponse.json({
    ok: true,
    email,
    expiresInMinutes: OTP_TTL_MINUTES,
  });
  } catch (err) {
    console.error("[register] error:", err);
    const message = err instanceof Error ? err.message : "Server xətası";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
