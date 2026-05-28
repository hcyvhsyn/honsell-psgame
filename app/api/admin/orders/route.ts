import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const statusParam = (req.nextUrl.searchParams.get("status") ?? "").toUpperCase();

  if (statusParam === "FAILED") {
    const cancelled = await prisma.transaction.findMany({
      where: {
        status: "FAILED",
        OR: [
          { type: "PURCHASE", gameId: { not: null } },
          { type: "SERVICE_PURCHASE" },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        user: { select: { id: true, email: true, name: true, phone: true } },
        game: { select: { id: true, title: true, imageUrl: true, platform: true } },
        serviceProduct: { select: { id: true, title: true, type: true, metadata: true } },
      },
    });

    return NextResponse.json({ cancelledOrders: cancelled });
  }

  const [
    gameOrders,
    psPlusOrders,
    eaPlayOrders,
    giftCardOrders,
    accountCreationOrders,
    epicAccountCreationOrders,
    streamingPlatformOrders,
    honsellOrders,
  ] = await Promise.all([
      prisma.transaction.findMany({
        where: { type: "PURCHASE", status: "PENDING", gameId: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 120,
        include: {
          user: { select: { id: true, email: true, name: true, phone: true } },
          game: {
            select: { id: true, title: true, imageUrl: true, platform: true, productUrl: true, store: true },
          },
          psnAccount: {
            select: { id: true, label: true, psnEmail: true, psnPassword: true, psModel: true },
          },
          epicAccount: {
            select: { id: true, label: true, epicEmail: true, epicPassword: true, displayName: true },
          },
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
          user: { select: { id: true, email: true, name: true, phone: true } },
          serviceProduct: { select: { id: true, title: true, metadata: true, type: true } },
          psnAccount: {
            select: { id: true, label: true, psnEmail: true, psnPassword: true, psModel: true },
          },
        },
      }),
      prisma.transaction.findMany({
        where: {
          type: "SERVICE_PURCHASE",
          status: "PENDING",
          serviceProduct: { type: "EA_PLAY" },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
        include: {
          user: { select: { id: true, email: true, name: true, phone: true } },
          serviceProduct: { select: { id: true, title: true, metadata: true, type: true } },
          psnAccount: {
            select: { id: true, label: true, psnEmail: true, psnPassword: true, psModel: true },
          },
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
      prisma.transaction.findMany({
        where: {
          type: "SERVICE_PURCHASE",
          status: "PENDING",
          serviceProduct: { type: "EPIC_ACCOUNT_CREATION" },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
        include: {
          user: { select: { id: true, email: true, name: true, phone: true } },
          serviceProduct: { select: { id: true, title: true, type: true } },
        },
      }),
      prisma.transaction.findMany({
        where: {
          type: "SERVICE_PURCHASE",
          status: "PENDING",
          serviceProduct: { type: { in: ["STREAMING", "PLATFORM"] } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
        include: {
          user: { select: { id: true, email: true, name: true, phone: true } },
          serviceProduct: { select: { id: true, title: true, type: true, metadata: true } },
        },
      }),
      prisma.honsellGiftCard.findMany({
        where: { status: "PENDING" },
        orderBy: { purchasedAt: "desc" },
        take: 200,
        select: {
          id: true,
          amountAznCents: true,
          purchasedAt: true,
          expiresAt: true,
          purchaseTransactionId: true,
          purchasedBy: { select: { id: true, email: true, name: true, phone: true } },
        },
      }),
    ]);

  const streamingOrders = streamingPlatformOrders.filter(
    (o) => o.serviceProduct?.type === "STREAMING",
  );

  function platformCategory(o: (typeof streamingPlatformOrders)[number]): string {
    const meta = (o.serviceProduct?.metadata as Record<string, unknown> | null) ?? {};
    return String(meta.category ?? "");
  }

  const aiOrders = streamingPlatformOrders.filter(
    (o) => o.serviceProduct?.type === "PLATFORM" && platformCategory(o) === "AI",
  );
  const musicOrders = streamingPlatformOrders.filter(
    (o) => o.serviceProduct?.type === "PLATFORM" && platformCategory(o) === "MUSIC",
  );
  const workOrders = streamingPlatformOrders.filter(
    (o) => o.serviceProduct?.type === "PLATFORM" && platformCategory(o) === "WORK",
  );

  return NextResponse.json({
    gameOrders,
    psPlusOrders,
    eaPlayOrders,
    giftCardOrders,
    accountCreationOrders,
    epicAccountCreationOrders,
    streamingOrders,
    aiOrders,
    musicOrders,
    workOrders,
    honsellOrders,
  });
}
