import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateReferralCode, requireAdmin } from "@/lib/auth";
import {
  SET_PASSWORD_TTL_HOURS,
  sendSetPasswordEmail,
} from "@/lib/resend";

export const runtime = "nodejs";

const APP_BASE_URL = "https://honsell.store";

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const name = body.name ? String(body.name).trim() : null;
  const phone = body.phone ? String(body.phone).trim() : null;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Düzgün e-poçt daxil edin" },
      { status: 400 }
    );
  }
  if (!name) {
    return NextResponse.json(
      { error: "Ad Soyad tələb olunur" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "Bu e-poçt artıq mövcuddur" },
      { status: 409 }
    );
  }

  const setPasswordToken = randomBytes(32).toString("hex");
  const setPasswordTokenExpiresAt = new Date(
    Date.now() + SET_PASSWORD_TTL_HOURS * 60 * 60 * 1000
  );

  let referralCode = generateReferralCode();
  for (let i = 0; i < 5; i++) {
    const clash = await prisma.user.findUnique({
      where: { referralCode },
      select: { id: true },
    });
    if (!clash) break;
    referralCode = generateReferralCode();
  }

  // Placeholder password hash — overwritten when the user completes
  // /set-password. Stored as a non-loginable sentinel since `passwordHash`
  // is required by the schema.
  const placeholderHash = `pending:${randomBytes(16).toString("hex")}`;

  const user = await prisma.user.create({
    data: {
      email,
      name,
      phone,
      passwordHash: placeholderHash,
      referralCode,
      emailVerified: false,
      setPasswordToken,
      setPasswordTokenExpiresAt,
    },
    select: { id: true, email: true, name: true },
  });

  const setPasswordUrl = `${APP_BASE_URL}/set-password?token=${setPasswordToken}`;

  try {
    await sendSetPasswordEmail({
      email: user.email,
      userName: user.name ?? user.email.split("@")[0],
      setPasswordUrl,
      expiresInHours: SET_PASSWORD_TTL_HOURS,
    });
  } catch (err) {
    console.error("[admin/users POST] sendSetPasswordEmail failed", err);
    return NextResponse.json(
      {
        error:
          "İstifadəçi yaradıldı, amma email göndərmək mümkün olmadı. Yenidən göndər düyməsindən istifadə et.",
        userId: user.id,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    userId: user.id,
    email: user.email,
    expiresInHours: SET_PASSWORD_TTL_HOURS,
  });
}
