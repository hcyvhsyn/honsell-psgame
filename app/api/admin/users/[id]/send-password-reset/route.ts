import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAdminAction } from "@/lib/adminAudit";
import { generateOtpCode, OTP_TTL_MINUTES } from "@/lib/resend";
import { deliverResetPasswordOtp } from "@/lib/otpDelivery";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, email: true, phone: true, name: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

  await deliverResetPasswordOtp({
    email: user.email,
    phone: user.phone,
    userName: user.name ?? user.email.split("@")[0],
    code: otpCode,
  });

  await logAdminAction({
    actorId: admin.id,
    targetUserId: params.id,
    action: "user.password.reset.send",
    details: { email: user.email },
  });

  return NextResponse.json({ ok: true, expiresInMinutes: OTP_TTL_MINUTES });
}
