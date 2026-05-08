import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

export const runtime = "nodejs";

// GET — verify a set-password token (used by the page to decide whether to
// render the form or an "expired link" state).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  if (!token) {
    return NextResponse.json({ ok: false, error: "Token yoxdur" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { setPasswordToken: token },
    select: {
      id: true,
      email: true,
      name: true,
      setPasswordTokenExpiresAt: true,
    },
  });

  if (!user || !user.setPasswordTokenExpiresAt) {
    return NextResponse.json(
      { ok: false, error: "Link etibarsızdır" },
      { status: 404 }
    );
  }
  if (user.setPasswordTokenExpiresAt.getTime() <= Date.now()) {
    return NextResponse.json(
      { ok: false, error: "Linkin müddəti bitib" },
      { status: 410 }
    );
  }

  return NextResponse.json({
    ok: true,
    email: user.email,
    name: user.name,
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = String(body.token ?? "").trim();
  const password = String(body.password ?? "");

  if (!token) {
    return NextResponse.json({ error: "Token yoxdur" }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: "Şifrə ən azı 8 simvol olmalıdır" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { setPasswordToken: token },
    select: { id: true, setPasswordTokenExpiresAt: true },
  });

  if (!user || !user.setPasswordTokenExpiresAt) {
    return NextResponse.json({ error: "Link etibarsızdır" }, { status: 404 });
  }
  if (user.setPasswordTokenExpiresAt.getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "Linkin müddəti bitib" },
      { status: 410 }
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: hashPassword(password),
      emailVerified: true,
      setPasswordToken: null,
      setPasswordTokenExpiresAt: null,
      otpCode: null,
      otpExpiresAt: null,
    },
  });

  return NextResponse.json({ ok: true });
}
