import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const isFeatured = Boolean(body.isFeatured);

  const game = await prisma.game.update({
    where: { id: params.id },
    data: { isFeatured },
    select: { id: true, isFeatured: true },
  });

  return NextResponse.json(game);
}
