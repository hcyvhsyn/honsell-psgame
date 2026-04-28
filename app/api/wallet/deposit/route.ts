import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Mock Epoint deposit. In production this would create a payment intent with
 * Epoint and only credit the wallet on the success webhook. For the skeleton
 * we validate the input shape and credit the wallet immediately.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const amountAzn = Number(body.amountAzn);
  const cardLast4 = String(body.cardNumber ?? "").replace(/\D/g, "").slice(-4);

  if (!Number.isFinite(amountAzn) || amountAzn <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }
  if (cardLast4.length !== 4) {
    return NextResponse.json({ error: "Invalid card details" }, { status: 400 });
  }

  const amountCents = Math.round(amountAzn * 100);

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id: user.id },
      data: { walletBalance: { increment: amountCents } },
    });
    await tx.transaction.create({
      data: {
        userId: user.id,
        type: "DEPOSIT",
        status: "SUCCESS",
        amountAznCents: amountCents,
        metadata: JSON.stringify({ gateway: "epoint-mock", cardLast4 }),
      },
    });
    return u;
  });

  return NextResponse.json({
    ok: true,
    walletBalance: updated.walletBalance / 100,
  });
}
