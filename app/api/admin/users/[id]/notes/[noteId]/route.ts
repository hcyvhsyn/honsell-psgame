import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; noteId: string } }
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.adminNote.deleteMany({
    where: { id: params.noteId, targetUserId: params.id },
  });

  return NextResponse.json({ ok: true });
}
