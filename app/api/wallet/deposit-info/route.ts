import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Returns the bank card details the customer should transfer to plus the
 * customer's pending deposit requests.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [settings, requests] = await Promise.all([
    prisma.settings.upsert({
      where: { id: "global" },
      update: {},
      create: { id: "global" },
    }),
    prisma.transaction.findMany({
      where: { userId: user.id, type: "DEPOSIT" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        amountAznCents: true,
        status: true,
        receiptUrl: true,
        createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    depositCardNumber: settings.depositCardNumber ?? null,
    depositCardHolder: settings.depositCardHolder ?? null,
    requests,
  });
}
