import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAdminAction } from "@/lib/adminAudit";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const role = String(body.role ?? "");
  if (role !== "ADMIN" && role !== "USER") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  if (admin.id === params.id && role !== "ADMIN") {
    return NextResponse.json(
      { error: "You cannot demote yourself." },
      { status: 400 }
    );
  }

  const prev = await prisma.user.findUnique({
    where: { id: params.id },
    select: { role: true },
  });

  const user = await prisma.user.update({
    where: { id: params.id },
    data: { role },
    select: { id: true, role: true },
  });

  if (prev && prev.role !== role) {
    await logAdminAction({
      actorId: admin.id,
      targetUserId: params.id,
      action: "user.role.update",
      details: { prev: prev.role, next: role },
    });
  }

  return NextResponse.json(user);
}
