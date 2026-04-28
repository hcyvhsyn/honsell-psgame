import SiteHeader from "@/components/SiteHeader";
import WalletDepositForm from "@/components/WalletDepositForm";
import { getCurrentUser } from "@/lib/auth";
import { Wallet } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const user = await getCurrentUser();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeader />
      <section className="mx-auto max-w-xl px-6 py-10">
        <div className="mb-6 flex items-center gap-3">
          <Wallet className="h-6 w-6 text-indigo-400" />
          <h1 className="text-2xl font-semibold tracking-tight">Cüzdan</h1>
        </div>

        {user && (
          <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Cari balans
            </p>
            <p className="mt-1 text-3xl font-semibold">
              {(user.walletBalance / 100).toFixed(2)} AZN
            </p>
          </div>
        )}

        <WalletDepositForm authed={!!user} />
      </section>
    </main>
  );
}
