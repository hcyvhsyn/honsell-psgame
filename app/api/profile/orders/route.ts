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

  type OrderRow = {
    id: string;
    type: string;
    status: string;
    createdAt: Date;
    amountAznCents: number;
    game: { id: string; title: string; imageUrl: string | null; platform: string | null; productType: string } | null;
    serviceProduct?: { title: string; type: string } | null;
    serviceCode?: { code: string } | null;
    psnAccount: { id: string; label: string; psnEmail: string } | null;
  };

  let rows: OrderRow[] = [];
  try {
    rows = (await prisma.transaction.findMany({
      where: { userId: user.id, type: { in: ["PURCHASE", "SERVICE_PURCHASE"] } },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        game: {
          select: { id: true, title: true, imageUrl: true, platform: true, productType: true },
        },
        serviceProduct: { select: { title: true, type: true } },
        serviceCode: { select: { code: true } },
        psnAccount: { select: { id: true, label: true, psnEmail: true } },
      },
    })) as unknown as OrderRow[];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Transaction.serviceProductId") || msg.includes("serviceProductId")) {
      rows = (await prisma.transaction.findMany({
        where: { userId: user.id, type: "PURCHASE" },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          game: {
            select: { id: true, title: true, imageUrl: true, platform: true, productType: true },
          },
          psnAccount: { select: { id: true, label: true, psnEmail: true } },
        },
      })) as unknown as OrderRow[];
    } else {
      throw err;
    }
  }

  const orders = rows.map((r) => ({
    id: r.id,
    type: r.type,
    paidAzn: Math.abs(r.amountAznCents) / 100,
    status: r.status,
    createdAt: r.createdAt,
    game: r.game,
    serviceProduct: r.serviceProduct,
    serviceCode: r.serviceCode?.code,
    psnAccount: r.psnAccount,
  }));

  return NextResponse.json({ orders });
}
