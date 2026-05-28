import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLoyaltyTier } from "@/lib/loyalty";
import { getOrCreateEpicAccountProduct } from "@/lib/epicAccount";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  const epicProduct = await getOrCreateEpicAccountProduct();
  const epicAccountProduct = {
    id: epicProduct.id,
    title: epicProduct.title,
    imageUrl: epicProduct.imageUrl,
    priceAznCents: epicProduct.priceAznCents,
  };
  if (!user) {
    return NextResponse.json({
      user: null,
      psnAccounts: [],
      epicAccounts: [],
      epicAccountProduct,
      loyalty: null,
    });
  }

  const [psnAccounts, epicAccounts, spentAgg] = await Promise.all([
    prisma.psnAccount.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        label: true,
        psnEmail: true,
        psModel: true,
        isDefault: true,
      },
    }),
    prisma.epicAccount.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        label: true,
        epicEmail: true,
        displayName: true,
        isDefault: true,
      },
    }),
    prisma.transaction.aggregate({
      where: { userId: user.id, type: "PURCHASE" },
      _sum: { amountAznCents: true },
    }),
  ]);

  const spentAzn = Math.abs(spentAgg._sum.amountAznCents ?? 0) / 100;
  const loyalty = getLoyaltyTier(spentAzn);

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      walletBalance: user.walletBalance,
      referralBalanceCents: user.referralBalanceCents,
      cashbackBalanceCents: user.cashbackBalanceCents ?? 0,
      referralCode: user.referralCode,
    },
    psnAccounts,
    epicAccounts,
    epicAccountProduct,
    loyalty,
  });
}
