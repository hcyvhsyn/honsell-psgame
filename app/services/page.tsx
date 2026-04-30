import SiteHeader from "@/components/SiteHeader";
import ServicesClient from "./ServicesClient";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import type { PsnOption } from "@/components/CartView";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const user = await getCurrentUser();

  const [products, psnAccountsData] = await Promise.all([
    prisma.serviceProduct.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: { select: { codes: { where: { isUsed: false } } } },
      },
    }),
    user
      ? prisma.psnAccount.findMany({
          where: { userId: user.id },
          orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  const psnAccounts: PsnOption[] = psnAccountsData.map((a) => ({
    id: a.id,
    label: a.label,
    psnEmail: a.psnEmail,
    psModel: a.psModel,
    isDefault: a.isDefault,
  }));

  // Profil dataları (Hesab açılışı formu üçün avtomatik doldurmaq)
  const userProfile = user
    ? {
        name: user.name ?? "",
        email: user.email,
        birthDate: user.birthDate ? user.birthDate.toISOString() : "",
        gender: user.gender ?? "",
      }
    : null;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeader />
      <ServicesClient
        products={products as unknown as React.ComponentProps<typeof ServicesClient>["products"]}
        isAuthed={!!user}
        walletBalanceAzn={user ? user.walletBalance / 100 : 0}
        psnAccounts={psnAccounts}
        userProfile={userProfile}
      />
    </main>
  );
}
