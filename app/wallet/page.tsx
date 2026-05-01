import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeaderServer";
import WalletDepositForm from "@/components/WalletDepositForm";
import { getCurrentUser } from "@/lib/auth";
import { Wallet } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const user = await getCurrentUser();

  // Authenticated users get the wallet inside the profile shell so the sidebar
  // stays visible while they top up.
  if (user) redirect("/profile/wallet");

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeader />
      <section className="mx-auto max-w-xl px-6 py-10">
        <div className="mb-6 flex items-center gap-3">
          <Wallet className="h-6 w-6 text-indigo-400" />
          <h1 className="text-2xl font-semibold tracking-tight">Cüzdan</h1>
        </div>
        <WalletDepositForm authed={false} />
      </section>
    </main>
  );
}
