import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getReferralCalculatorOptions } from "@/lib/referralCalculatorOptions";
import type { ProductCategoryNavAsset } from "@/lib/categoryAssets";
import SiteHeader from "./SiteHeader";
import ReferralPromoBar from "./ReferralPromoBar";

export default async function SiteHeaderServer() {
  const user = await getCurrentUser();

  let earnedAzn = 0;
  if (user) {
    const agg = await prisma.transaction.aggregate({
      where: { beneficiaryId: user.id, type: "COMMISSION" },
      _sum: { amountAznCents: true },
    });
    earnedAzn = (agg._sum.amountAznCents ?? 0) / 100;
  }

  const referralOptions = await getReferralCalculatorOptions();
  const promoPct = Math.round(Math.max(0, ...referralOptions.map((option) => option.ratePct)));
  let categoryAssets: ProductCategoryNavAsset[] | null = null;
  try {
    const categoryAssetDelegate = (
      prisma as typeof prisma & {
        categoryAsset?: {
          findMany: (args: {
            orderBy: [{ sortOrder: "asc" }, { label: "asc" }];
            select: {
              key: true;
              href: true;
              label: true;
              description: true;
              imageUrl: true;
              isActive: true;
              sortOrder: true;
            };
          }) => Promise<ProductCategoryNavAsset[]>;
        };
      }
    ).categoryAsset;
    const assets = await categoryAssetDelegate?.findMany({
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: {
        key: true,
        href: true,
        label: true,
        description: true,
        imageUrl: true,
        isActive: true,
        sortOrder: true,
      },
    });
    categoryAssets = assets && assets.length > 0 ? assets.filter((asset) => asset.isActive) : null;
  } catch {
    categoryAssets = null;
  }

  return (
    <>
      <ReferralPromoBar
        code={user?.referralCode ?? null}
        sharePct={promoPct > 0 ? promoPct : 5}
        earnedAzn={user ? earnedAzn : undefined}
      />
      <SiteHeader
        categoryAssets={categoryAssets}
        user={
          user
            ? {
                name: user.name,
                walletBalance: user.walletBalance,
                cashbackBalanceCents: user.cashbackBalanceCents ?? 0,
              }
            : null
        }
      />
    </>
  );
}
