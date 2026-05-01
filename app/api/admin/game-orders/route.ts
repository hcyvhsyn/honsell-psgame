import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.transaction.findMany({
    where: { type: "PURCHASE", gameId: { not: null } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 120,
    include: {
      user: { select: { id: true, email: true, name: true, phone: true } },
      game: { select: { id: true, title: true, imageUrl: true, platform: true } },
      psnAccount: { select: { id: true, label: true, psnEmail: true } },
    },
  });

  return NextResponse.json(rows);
}
