import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/pricing";
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

  const settings = await getSettings();
  // İstifadəçilərə göstəriləcək "təxmini %" — oyunlar üçün referralProfitSharePct
  // (cost izlənir, profitin payı), streaming üçün referralStreamingProfitSharePct
  // (final qiymətdən faiz). Promo bannerdə daha sadə görünür: streaming faizi
  // çox vaxt daha yüksək göstərici verir, ona görə promo dəyəri kimi onu seçirik.
  const promoPct = Math.round(
    Math.max(settings.referralStreamingProfitSharePct ?? 0, settings.affiliateRatePct ?? 0)
  );

  return (
    <>
      <ReferralPromoBar
        code={user?.referralCode ?? null}
        sharePct={promoPct > 0 ? promoPct : 5}
        earnedAzn={user ? earnedAzn : undefined}
      />
      <SiteHeader
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
