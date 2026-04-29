import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateOtpCode,
  OTP_TTL_MINUTES,
  sendResetPasswordEmail,
} from "@/lib/resend";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "E-poçt tələb olunur" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Don't leak account existence or verification state — always succeed.
  // Reset is only meaningful for verified accounts; an unverified account
  // should finish registration first via the OTP flow.
  if (!user || !user.emailVerified) {
    return NextResponse.json({ ok: true, expiresInMinutes: OTP_TTL_MINUTES });
  }

  const otpCode = generateOtpCode();
  const otpExpiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

  await prisma.user.update({
    where: { id: user.id },
    data: { otpCode, otpExpiresAt },
  });

  await sendResetPasswordEmail(
    email,
    user.name ?? email.split("@")[0],
    otpCode
  );

  return NextResponse.json({ ok: true, expiresInMinutes: OTP_TTL_MINUTES });
}
