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
  const action = String(body.action ?? "");
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const deposit = await prisma.transaction.findUnique({
    where: { id: params.id },
  });
  if (!deposit || deposit.type !== "DEPOSIT") {
    return NextResponse.json({ error: "Deposit not found" }, { status: 404 });
  }
  if (deposit.status !== "PENDING") {
    return NextResponse.json(
      { error: `Deposit is already ${deposit.status.toLowerCase()}` },
      { status: 409 }
    );
  }

  if (action === "reject") {
    await prisma.transaction.update({
      where: { id: deposit.id },
      data: { status: "FAILED" },
    });
    return NextResponse.json({ ok: true, status: "FAILED" });
  }

  // Approve: credit wallet + flip status atomically.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: deposit.userId },
      data: { walletBalance: { increment: deposit.amountAznCents } },
    }),
    prisma.transaction.update({
      where: { id: deposit.id },
      data: { status: "SUCCESS" },
    }),
  ]);

  return NextResponse.json({ ok: true, status: "SUCCESS" });
}
