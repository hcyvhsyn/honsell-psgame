import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, generateReferralCode } from "@/lib/auth";
import { SET_PASSWORD_TTL_HOURS, sendSetPasswordEmail } from "@/lib/resend";
import { SITE_URL } from "@/lib/site";
import {
  ABUNELIK_COOKIE,
  createPhoneToken,
  isAbunelikEnabled,
  phoneCookieOptions,
  readVerifiedPhone,
  sessionCookieOptions,
} from "@/lib/abunelik/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function uniqueReferralCode(): Promise<string> {
  let code = generateReferralCode();
  for (let i = 0; i < 5; i++) {
    const clash = await prisma.user.findUnique({ where: { referralCode: code } });
    if (!clash) break;
    code = generateReferralCode();
  }
  return code;
}

/**
 * POST /api/abunelik/account  { name, email }
 * Telefonu OTP ilə təsdiqlənmiş, sayt hesabı olmayan müştəri üçün şifrəsiz hesab (/rey axını kimi):
 * `passwordHash: "pending:<hex>"`, şifrə təyin linki e-poçta gedir. Ödəniş üçün lazımdır
 * (Transaction.userId məcburidir). Telefon artıq OTP ilə təsdiqlənib → emailVerified=true (mağaza
 * semantikasında "hesab təsdiqlənib" deməkdir, /rey ilə eyni).
 */
export async function POST(req: Request) {
  if (!isAbunelikEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const phone = readVerifiedPhone();
  if (!phone) return NextResponse.json({ error: "Sessiya bitib. Nömrənizlə yenidən daxil olun." }, { status: 401 });
  if (cookies().get(SESSION_COOKIE_NAME)?.value) {
    return NextResponse.json({ error: "Artıq hesabınıza daxil olmusunuz." }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as { name?: string; email?: string } | null;
  const name = String(body?.name ?? "").trim().slice(0, 80);
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (name.length < 2) return NextResponse.json({ error: "Adınızı yazın." }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "E-poçtu düzgün yazın." }, { status: 400 });

  const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) {
    return NextResponse.json(
      { error: "Bu e-poçtla hesab artıq var. Həmin hesaba daxil olun.", code: "EMAIL_EXISTS", loginUrl: "/login?next=/abunelik" },
      { status: 409 },
    );
  }

  const setPasswordToken = crypto.randomBytes(24).toString("base64url");
  const user = await prisma.user.create({
    data: {
      email,
      name,
      phone: phone.e164,
      passwordHash: `pending:${crypto.randomBytes(16).toString("hex")}`,
      emailVerified: true,
      referralCode: await uniqueReferralCode(),
      setPasswordToken,
      setPasswordTokenExpiresAt: new Date(Date.now() + SET_PASSWORD_TTL_HOURS * 60 * 60 * 1000),
    },
    select: { id: true },
  });

  const setPasswordUrl = `${SITE_URL}/set-password?token=${setPasswordToken}`;
  sendSetPasswordEmail({ email, userName: name, setPasswordUrl }).catch((e) =>
    console.error("[abunelik:account] set-password e-poçtu", e),
  );

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, user.id, sessionCookieOptions);
  res.cookies.set(ABUNELIK_COOKIE, createPhoneToken({ e164: phone.e164, phone9: phone.phone9, uid: user.id }), phoneCookieOptions);
  return res;
}
