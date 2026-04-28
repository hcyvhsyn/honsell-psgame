import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import PsnAccountsManager, {
  type PsnAccountSummary,
} from "@/components/PsnAccountsManager";

export const dynamic = "force-dynamic";

export default async function PsnAccountsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const accounts: PsnAccountSummary[] = (
    await prisma.psnAccount.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        label: true,
        psnEmail: true,
        psnPassword: true,
        isDefault: true,
      },
    })
  ).map((a) => ({ ...a }));

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold">PSN hesabları</h2>
        <p className="text-sm text-zinc-400">
          Oyunların çatdırılacağı PlayStation hesablarını əlavə et. Sifariş
          zamanı əsas hesab avtomatik seçilir — başqa hesab üçün alarkən onu
          seçə bilərsən.
        </p>
      </header>
      <PsnAccountsManager initial={accounts} />
    </section>
  );
}
