import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  const walletBalance = Number(body.walletBalance);
  const cashbackBalanceCents = Number(body.cashbackBalanceCents);
  const referralBalanceCents = Number(body.referralBalanceCents);

  if (
    !Number.isFinite(walletBalance) ||
    !Number.isFinite(cashbackBalanceCents) ||
    !Number.isFinite(referralBalanceCents)
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (walletBalance < 0 || cashbackBalanceCents < 0 || referralBalanceCents < 0) {
    return NextResponse.json({ error: "Balances cannot be negative" }, { status: 400 });
  }

  const current = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      walletBalance: true,
      cashbackBalanceCents: true,
      referralBalanceCents: true,
    },
  });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const deltaWallet = Math.round(walletBalance - current.walletBalance);

  await prisma.$transaction(async (ptx) => {
    await ptx.user.update({
      where: { id: params.id },
      data: {
        walletBalance: Math.round(walletBalance),
        cashbackBalanceCents: Math.round(cashbackBalanceCents),
        referralBalanceCents: Math.round(referralBalanceCents),
      },
      select: { id: true },
    });

    if (deltaWallet !== 0) {
      await ptx.transaction.create({
        data: {
          userId: params.id,
          type: "DEPOSIT",
          status: "SUCCESS",
          amountAznCents: deltaWallet,
          metadata: JSON.stringify({
            kind: "ADMIN_ADJUST",
            field: "walletBalance",
            prev: current.walletBalance,
            next: Math.round(walletBalance),
          }),
        },
      });
    }
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, role: true, email: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user.role === "ADMIN") {
    return NextResponse.json({ error: "Admin istifadəçisini silmək olmaz." }, { status: 400 });
  }

  await prisma.$transaction(async (ptx) => {
    // detach referrals
    await ptx.user.updateMany({
      where: { referredById: params.id },
      data: { referredById: null },
    });

    // remove transactions (including commission rows referencing this user)
    await ptx.transaction.deleteMany({
      where: { OR: [{ userId: params.id }, { beneficiaryId: params.id }] },
    });

    // remove psn accounts
    await ptx.psnAccount.deleteMany({ where: { userId: params.id } });

    await ptx.user.delete({ where: { id: params.id } });
  });

  return NextResponse.json({ ok: true });
}

