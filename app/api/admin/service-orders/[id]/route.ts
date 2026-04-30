import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  if (action !== "SUCCESS" && action !== "FAILED") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const tx = await prisma.transaction.findUnique({ where: { id: params.id } });
  if (!tx || tx.type !== "SERVICE_PURCHASE" || tx.status !== "PENDING") {
    return NextResponse.json({ error: "Not found or not pending" }, { status: 404 });
  }

  await prisma.$transaction(async (ptx) => {
    // If failed, refund the amount (amountAznCents is negative for purchases, so we add its absolute value)
    if (action === "FAILED") {
      const refundCents = Math.abs(tx.amountAznCents);
      await ptx.user.update({
        where: { id: tx.userId },
        data: { walletBalance: { increment: refundCents } },
      });
    }

    await ptx.transaction.update({
      where: { id: tx.id },
      data: { status: action },
    });
  });

  return NextResponse.json({ ok: true });
}
