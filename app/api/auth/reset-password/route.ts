import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const code = String(body.code ?? "").trim();
  const password = String(body.password ?? "");

  if (!email || !code || !password) {
    return NextResponse.json(
      { error: "Bütün sahələr tələb olunur" },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Şifrə ən azı 8 simvol olmalıdır" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (
    !user ||
    !user.emailVerified ||
    !user.otpCode ||
    !user.otpExpiresAt
  ) {
    return NextResponse.json(
      { error: "Kod yanlış və ya müddəti bitib" },
      { status: 400 }
    );
  }
  if (user.otpCode !== code) {
    return NextResponse.json({ error: "Kod yanlışdır" }, { status: 400 });
  }
  if (user.otpExpiresAt < new Date()) {
    return NextResponse.json(
      { error: "Kodun müddəti bitib" },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: hashPassword(password),
      otpCode: null,
      otpExpiresAt: null,
    },
  });

  return NextResponse.json({ ok: true });
}
