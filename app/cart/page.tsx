import SiteHeader from "@/components/SiteHeaderServer";
import CartView, { type PsnOption, type EpicOption } from "@/components/CartView";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getLoyaltyTier } from "@/lib/loyalty";
import { getLifetimeSpendAznForLoyalty } from "@/lib/loyaltyCashback";
import { getOrCreateEpicAccountProduct } from "@/lib/epicAccount";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const user = await getCurrentUser();

  let psnAccounts: PsnOption[] = [];
  let epicAccounts: EpicOption[] = [];
  let loyaltyCashbackPct = 0;

  const epicProduct = await getOrCreateEpicAccountProduct();
  const epicAccountProduct = {
    id: epicProduct.id,
    title: epicProduct.title,
    imageUrl: epicProduct.imageUrl,
    priceAznCents: epicProduct.priceAznCents,
  };

  if (user) {
    const [accounts, epics, spentAzn] = await Promise.all([
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
      getLifetimeSpendAznForLoyalty(prisma, user.id),
    ]);
    psnAccounts = accounts.map((a) => ({ ...a }));
    epicAccounts = epics.map((a) => ({ ...a }));
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
          psnAccounts={psnAccounts}
          epicAccounts={epicAccounts}
          epicAccountProduct={epicAccountProduct}
          loyaltyCashbackPct={loyaltyCashbackPct}
          referralCode={user?.referralCode ?? null}
        />
      </section>
    </main>
  );
}
