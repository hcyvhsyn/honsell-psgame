import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tx = await prisma.transaction.findUnique({
    where: { id: params.id },
    select: { id: true, serviceCodeId: true },
  });
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.$transaction(async (ptx) => {
    if (tx.serviceCodeId) {
      await ptx.serviceCode.update({
        where: { id: tx.serviceCodeId },
        data: { isUsed: false },
      });
    }
    await ptx.transaction.delete({ where: { id: params.id } });
  });

  return NextResponse.json({ ok: true });
}
