import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getReferralCalculatorOptions } from "@/lib/referralCalculatorOptions";
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
