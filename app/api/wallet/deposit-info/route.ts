import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

/** Returns the customer's Epoint wallet top-up history. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requests = await prisma.transaction.findMany({
    where: { userId: user.id, type: "DEPOSIT" },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      amountAznCents: true,
      status: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    requests,
  });
}
