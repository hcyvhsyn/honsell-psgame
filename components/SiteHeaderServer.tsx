import { unstable_cache } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getReferralCalculatorOptions } from "@/lib/referralCalculatorOptions";
import type { ProductCategoryNavAsset } from "@/lib/categoryAssets";
import SiteHeader from "./SiteHeader";
import ReferralPromoBar from "./ReferralPromoBar";

/**
 * Header-in user-ə AİD OLMAYAN hissələri (kateqoriya navigasiyası + referral
 * promo faizi) bütün ziyarətçilər üçün eynidir — ona görə `unstable_cache` ilə
 * 10 dəqiqəlik keşdə saxlanır. Bu sorğular əvvəl HƏR səhifə açılışında Mumbai-yə
 * ardıcıl gedirdi (~1.8s + getSettings). İndi keşdən gəlir, demək olar 0ms.
 */
const getCachedPromoPct = unstable_cache(
  async () => {
    const referralOptions = await getReferralCalculatorOptions();
    return Math.round(Math.max(0, ...referralOptions.map((option) => option.ratePct)));
  },
  ["site-header:promo-pct"],
  { revalidate: 600, tags: ["site-header"] },
);

const getCachedCategoryAssets = unstable_cache(
  async (): Promise<ProductCategoryNavAsset[] | null> => {
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
      return assets && assets.length > 0 ? assets.filter((asset) => asset.isActive) : null;
    } catch {
      return null;
    }
  },
  ["site-header:category-assets"],
  { revalidate: 600, tags: ["site-header"] },
);

export default async function SiteHeaderServer() {
  // User-ə aid olmayan keşlənmiş sorğular user lookup ilə PARALEL gedir —
  // əvvəl 4 sorğu ardıcıl idi (~3.7s), indi user lookup + (keş hit ~0ms).
  const [user, categoryAssets, promoPct] = await Promise.all([
    getCurrentUser(),
    getCachedCategoryAssets(),
    getCachedPromoPct(),
  ]);

  let earnedAzn = 0;
  if (user) {
    const agg = await prisma.transaction.aggregate({
      where: { beneficiaryId: user.id, type: "COMMISSION" },
      _sum: { amountAznCents: true },
    });
    earnedAzn = (agg._sum.amountAznCents ?? 0) / 100;
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
