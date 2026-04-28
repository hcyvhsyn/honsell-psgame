import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

/** Lists the user's PURCHASE rows newest-first with the joined game + PSN account label. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit")) || 50));

  const rows = await prisma.transaction.findMany({
    where: { userId: user.id, type: "PURCHASE" },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      game: {
        select: { id: true, title: true, imageUrl: true, platform: true, productType: true },
      },
      psnAccount: { select: { id: true, label: true, psnEmail: true } },
    },
  });

  const orders = rows.map((r) => ({
    id: r.id,
    paidAzn: Math.abs(r.amountAznCents) / 100,
    status: r.status,
    createdAt: r.createdAt,
    game: r.game,
    psnAccount: r.psnAccount,
  }));

  return NextResponse.json({ orders });
}
