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

  const [gameOrders, psPlusOrders, giftCardOrders, accountCreationOrders] =
    await Promise.all([
      prisma.transaction.findMany({
        where: { type: "PURCHASE", status: "PENDING", gameId: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 120,
        include: {
          user: { select: { id: true, email: true, name: true, phone: true } },
          game: { select: { id: true, title: true, imageUrl: true, platform: true } },
          psnAccount: { select: { id: true, label: true, psnEmail: true } },
        },
      }),
      prisma.transaction.findMany({
        where: {
          type: "SERVICE_PURCHASE",
          status: "PENDING",
          serviceProduct: { type: "PS_PLUS" },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
        include: {
          user: { select: { id: true, email: true, name: true } },
          serviceProduct: { select: { id: true, title: true, metadata: true, type: true } },
          psnAccount: { select: { id: true, label: true, psnEmail: true } },
        },
      }),
      prisma.transaction.findMany({
        where: {
          type: "SERVICE_PURCHASE",
          status: "PENDING",
          serviceProduct: { type: "TRY_BALANCE" },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
        include: {
          user: { select: { id: true, email: true, name: true } },
          serviceProduct: { select: { id: true, title: true, type: true } },
          serviceCode: { select: { id: true, code: true } },
        },
      }),
      prisma.transaction.findMany({
        where: {
          type: "SERVICE_PURCHASE",
          status: "PENDING",
          serviceProduct: { type: "ACCOUNT_CREATION" },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
        include: {
          user: { select: { id: true, email: true, name: true } },
          serviceProduct: { select: { id: true, title: true, type: true } },
        },
      }),
    ]);

  return NextResponse.json({
    gameOrders,
    psPlusOrders,
    giftCardOrders,
    accountCreationOrders,
  });
}

