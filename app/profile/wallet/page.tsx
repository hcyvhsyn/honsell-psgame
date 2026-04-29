import { Wallet } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import WalletDepositForm from "@/components/WalletDepositForm";

export const dynamic = "force-dynamic";

export default async function ProfileWalletPage() {
  const user = await getCurrentUser();
  if (!user) return null; // profile layout already redirects

  return (
    <section className="space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/40">
            <Wallet className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Cüzdan</h2>
            <p className="text-sm text-zinc-400">
              Balans yüklə və köçürmə tarixçəsinə bax.
            </p>
          </div>
        </div>

        <div className="hidden rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-right sm:block">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Cari balans
          </p>
          <p className="mt-0.5 text-xl font-bold tabular-nums text-white">
            {(user.walletBalance / 100).toFixed(2)}{" "}
            <span className="text-xs font-medium text-zinc-400">AZN</span>
          </p>
        </div>
      </header>

      <WalletDepositForm authed />
    </section>
  );
}
