import SiteHeader from "@/components/SiteHeader";
import CartView, { type PsnOption } from "@/components/CartView";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const user = await getCurrentUser();

  let psnAccounts: PsnOption[] = [];
  if (user) {
    psnAccounts = (
      await prisma.psnAccount.findMany({
        where: { userId: user.id },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        select: { id: true, label: true, psnEmail: true, isDefault: true },
      })
    ).map((a) => ({ ...a }));
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
        />
      </section>
    </main>
  );
}
