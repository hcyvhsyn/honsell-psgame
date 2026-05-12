import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Home, WalletCards } from "lucide-react";

export const metadata: Metadata = {
  title: "Ödəniş uğurlu oldu",
  robots: { index: false, follow: false },
};

export default function EpointSuccessPage({
  searchParams,
}: {
  searchParams?: { order_id?: string; transaction?: string };
}) {
  const orderId = searchParams?.order_id ?? searchParams?.transaction ?? null;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16 text-zinc-100">
      <section className="w-full max-w-lg rounded-2xl border border-emerald-500/25 bg-zinc-950/80 p-8 text-center shadow-2xl shadow-emerald-950/20">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-white">
          Ödəniş uğurla tamamlandı
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Epoint ödənişi qəbul etdi. Nəticə serverə çatdıqdan sonra balans və ya
          sifariş statusu avtomatik yenilənəcək.
        </p>
        {orderId && (
          <p className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-400">
            Sifariş: {orderId}
          </p>
        )}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/profile/wallet"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400"
          >
            <WalletCards className="h-4 w-4" />
            Balansa bax
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500"
          >
            <Home className="h-4 w-4" />
            Ana səhifə
          </Link>
        </div>
      </section>
    </main>
  );
}
