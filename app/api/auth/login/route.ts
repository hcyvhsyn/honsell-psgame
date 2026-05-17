import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!email || !password) {
    return NextResponse.json({ error: "E-poçt və şifrə tələb olunur" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "E-poçt və ya şifrə səhvdir" }, { status: 401 });
  }

  if (!user.emailVerified) {
    return NextResponse.json(
      { error: "E-poçt təsdiqlənməyib", needsVerification: true, email: user.email },
      { status: 403 }
    );
  }

  if (user.disabled) {
    return NextResponse.json(
      { error: "Bu hesab bloklanıb. Dəstək ilə əlaqə saxlayın." },
      { status: 403 }
    );
  }

  const xff = req.headers.get("x-forwarded-for");
  const ip = xff?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
  const ua = req.headers.get("user-agent")?.slice(0, 500) ?? null;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      lastLoginIp: ip,
      lastUserAgent: ua,
      loginCount: { increment: 1 },
    },
  });

  const res = NextResponse.json({ id: user.id, email: user.email });
  res.cookies.set(SESSION_COOKIE_NAME, user.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
