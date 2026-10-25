import SiteHeader from "@/components/SiteHeaderServer";
import CartView, { type PsnOption } from "@/components/CartView";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const user = await getCurrentUser();

  let psnAccounts: PsnOption[] = [];

  if (user) {
    const accounts = await prisma.psnAccount.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        label: true,
        psnEmail: true,
        psModel: true,
        isDefault: true,
      },
    });
    psnAccounts = accounts.map((a) => ({ ...a }));
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeader />
      <section className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Səbətin</h1>
        <CartView
          isAuthed={!!user}
          walletBalanceAzn={user ? user.walletBalance / 100 : 0}
          psnAccounts={psnAccounts}
          referralCode={user?.referralCode ?? null}
        />
      </section>
    </main>
  );
}
