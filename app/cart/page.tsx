import SiteHeader from "@/components/SiteHeaderServer";
import CartView, { type PsnOption } from "@/components/CartView";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getLoyaltyTier } from "@/lib/loyalty";
import { getLifetimeSpendAznForLoyalty } from "@/lib/loyaltyCashback";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const user = await getCurrentUser();

  let psnAccounts: PsnOption[] = [];
  let loyaltyCashbackPct = 0;

  if (user) {
    const [accounts, spentAzn] = await Promise.all([
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
      getLifetimeSpendAznForLoyalty(prisma, user.id),
    ]);
    psnAccounts = accounts.map((a) => ({ ...a }));
    const tier = getLoyaltyTier(spentAzn);
    loyaltyCashbackPct = tier.cashbackPct;
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeader />
      <section className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Səbətin</h1>
        <CartView
          isAuthed={!!user}
          walletBalanceAzn={user ? user.walletBalance / 100 : 0}
          cashbackBalanceAzn={user ? (user.cashbackBalanceCents ?? 0) / 100 : 0}
          referralBalanceAzn={user ? user.referralBalanceCents / 100 : 0}
          psnAccounts={psnAccounts}
          loyaltyCashbackPct={loyaltyCashbackPct}
        />
      </section>
    </main>
  );
}
