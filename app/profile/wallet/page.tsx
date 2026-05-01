import { Banknote, UserRound, Sparkles } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import WalletDepositForm from "@/components/WalletDepositForm";

export const dynamic = "force-dynamic";

export default async function ProfileWalletPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const commissionLifetimeCents = await prisma.transaction
    .aggregate({
      where: { beneficiaryId: user.id, type: "COMMISSION" },
      _sum: { amountAznCents: true },
    })
    .then((a) => a._sum.amountAznCents ?? 0);

  const walletAzn = user.walletBalance / 100;
  const cashbackBalAzn = (user.cashbackBalanceCents ?? 0) / 100;
  const referralSpendableAzn = user.referralBalanceCents / 100;
  const commissionLifetimeAzn = commissionLifetimeCents / 100;

  return (
    <section className="flex flex-col items-center">
      <h2 className="mb-10 mt-6 text-[32px] font-bold tracking-tight text-white">
        Balans
      </h2>

      <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-3">
        <div className="relative flex flex-col items-center overflow-hidden rounded-[24px] border border-white/5 bg-[#111116] p-8 shadow-2xl">
          <div className="absolute top-1/3 h-40 w-40 -translate-y-1/2 rounded-full bg-[#5a189a]/50 blur-[60px]" />

          <div className="relative mb-4 mt-2">
            <Banknote className="h-8 w-8 text-white" strokeWidth={1.5} />
          </div>

          <p className="relative mt-2 text-[15px] font-medium text-zinc-300">Cüzdan balansı</p>
          <p className="relative mt-2 text-3xl font-bold text-white">{walletAzn.toFixed(2)} ₼</p>
          <p className="relative mt-3 max-w-[280px] text-center text-[11px] text-zinc-500">
            Depozit və əsas ödəniş balansı — alış üçün seçilir.
          </p>
        </div>

        <div className="relative flex flex-col items-center overflow-hidden rounded-[24px] border border-amber-500/20 bg-[#111116] p-8 shadow-2xl">
          <div className="absolute top-1/3 h-40 w-40 -translate-y-1/2 rounded-full bg-amber-500/20 blur-[60px]" />

          <div className="relative mb-4 mt-2">
            <Sparkles className="h-8 w-8 text-amber-400" strokeWidth={1.5} />
          </div>

          <p className="relative mt-2 text-[15px] font-medium text-zinc-300">Cashback balansı</p>
          <p className="relative mt-2 text-3xl font-bold text-amber-100">{cashbackBalAzn.toFixed(2)} ₼</p>
          <p className="relative mt-3 max-w-[280px] text-center text-[11px] text-zinc-500">
            Loyalty təbəqənə görə hər uğurlu alışdan sonra faiz burada toplanır.
          </p>
        </div>

        <div className="relative flex flex-col items-center overflow-hidden rounded-[24px] border border-white/5 bg-[#111116] p-8 shadow-2xl">
          <div className="absolute top-1/3 h-40 w-40 -translate-y-1/2 rounded-full bg-[#5a189a]/50 blur-[60px]" />

          <div className="relative mb-4 mt-2">
            <UserRound className="h-8 w-8 text-white" strokeWidth={1.5} />
          </div>

          <p className="relative mt-2 text-[15px] font-medium text-zinc-300">Referal balansı</p>
          <p className="relative mt-2 text-3xl font-bold text-white">{referralSpendableAzn.toFixed(2)} ₼</p>
          <p className="relative mt-3 max-w-[280px] text-center text-[11px] text-zinc-500">
            Hazırda alış üçün istifadə edə biləcəyiniz referal məbləği. Ömrü boyu əldə edilən komissiya (tarix üzrə):{" "}
            {commissionLifetimeAzn.toFixed(2)} ₼
          </p>
        </div>
      </div>

      <div className="mt-12 w-full border-t border-white/5 pt-10">
        <WalletDepositForm authed />
      </div>
    </section>
  );
}
