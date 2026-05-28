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
    <section className="flex flex-col">
      <h2 className="mb-4 text-2xl font-bold tracking-tight text-white">
        Balans
      </h2>

      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-white/5 bg-[#111116] p-4 shadow-xl">
          <div className="absolute -left-4 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-[#5a189a]/40 blur-[50px]" />
          <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/5 text-white ring-1 ring-white/10">
            <Banknote className="h-5 w-5" strokeWidth={1.5} />
          </span>
          <div className="relative min-w-0">
            <p className="text-xs font-medium text-zinc-400">Cüzdan balansı</p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums text-white">{walletAzn.toFixed(2)} ₼</p>
          </div>
        </div>

        <div className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-amber-500/20 bg-[#111116] p-4 shadow-xl">
          <div className="absolute -left-4 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-amber-500/15 blur-[50px]" />
          <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/25">
            <Sparkles className="h-5 w-5" strokeWidth={1.5} />
          </span>
          <div className="relative min-w-0">
            <p className="text-xs font-medium text-zinc-400">Cashback balansı</p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums text-amber-100">{cashbackBalAzn.toFixed(2)} ₼</p>
          </div>
        </div>

        <div className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-white/5 bg-[#111116] p-4 shadow-xl">
          <div className="absolute -left-4 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-[#5a189a]/40 blur-[50px]" />
          <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/5 text-white ring-1 ring-white/10">
            <UserRound className="h-5 w-5" strokeWidth={1.5} />
          </span>
          <div className="relative min-w-0">
            <p className="text-xs font-medium text-zinc-400">Referal balansı</p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums text-white">{referralSpendableAzn.toFixed(2)} ₼</p>
            <p className="mt-0.5 truncate text-[11px] text-zinc-500">
              Ömürlük komissiya: {commissionLifetimeAzn.toFixed(2)} ₼
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 w-full">
        <WalletDepositForm authed />
      </div>
    </section>
  );
}
