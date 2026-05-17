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

  const body = await req.json().catch(() => ({}));
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Qeyd boş ola bilməz" }, { status: 400 });
  }
  if (text.length > 5000) {
    return NextResponse.json({ error: "Maksimum 5000 simvol" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const note = await prisma.adminNote.create({
    data: {
      targetUserId: params.id,
      authorId: admin.id,
      body: text.slice(0, 5000),
    },
  });

  await logAdminAction({
    actorId: admin.id,
    targetUserId: params.id,
    action: "user.note.add",
    details: { noteId: note.id, length: text.length },
  });

  return NextResponse.json({ ok: true, id: note.id });
}
