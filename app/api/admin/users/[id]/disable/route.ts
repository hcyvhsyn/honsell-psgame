import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAdminAction } from "@/lib/adminAudit";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (admin.id === params.id) {
    return NextResponse.json({ error: "Öz hesabınızı bloklaya bilməzsiniz" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const disable = Boolean(body.disable);
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 500) : null;

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: { role: true },
  });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (disable && target.role === "ADMIN") {
    return NextResponse.json({ error: "Admin hesabını bloklamaq olmaz" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: params.id },
    data: disable
      ? { disabled: true, disabledAt: new Date(), disabledReason: reason }
      : { disabled: false, disabledAt: null, disabledReason: null },
  });

  await logAdminAction({
    actorId: admin.id,
    targetUserId: params.id,
    action: disable ? "user.disable" : "user.enable",
    details: disable ? { reason } : null,
  });

  return NextResponse.json({ ok: true });
}
