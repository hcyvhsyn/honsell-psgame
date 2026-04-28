import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { sendWelcomeEmail } from "@/lib/resend";

export const runtime = "nodejs";

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

  if (user.otpExpiresAt.getTime() < Date.now()) {
    return NextResponse.json(
      { error: "Kodun müddəti bitib. Yeni kod tələb et." },
      { status: 410 }
    );
  }

  if (user.otpCode !== code) {
    return NextResponse.json({ error: "Kod səhvdir" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      otpCode: null,
      otpExpiresAt: null,
    },
  });

  // Best-effort welcome email — don't fail verification if Resend hiccups.
  try {
    await sendWelcomeEmail(email, user.name ?? email.split("@")[0]);
  } catch (err) {
    console.error("welcome email failed", err);
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
