import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAdminAction } from "@/lib/adminAudit";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, emailVerified: true },
  });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (target.emailVerified) {
    return NextResponse.json({ error: "Email artıq təsdiqlənib" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: params.id },
    data: {
      emailVerified: true,
      otpCode: null,
      otpExpiresAt: null,
      otpAttempts: 0,
      otpLockedUntil: null,
    },
  });

  await logAdminAction({
    actorId: admin.id,
    targetUserId: params.id,
    action: "user.email.verify",
    details: { manual: true },
  });

  return NextResponse.json({ ok: true });
}
