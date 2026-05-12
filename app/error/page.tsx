import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, Home, RefreshCw } from "lucide-react";

export const metadata: Metadata = {
  title: "Ödəniş alınmadı",
  robots: { index: false, follow: false },
};

export default function EpointErrorPage({
  searchParams,
}: {
  searchParams?: { order_id?: string; transaction?: string; message?: string };
}) {
  const orderId = searchParams?.order_id ?? searchParams?.transaction ?? null;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16 text-zinc-100">
      <section className="w-full max-w-lg rounded-2xl border border-rose-500/25 bg-zinc-950/80 p-8 text-center shadow-2xl shadow-rose-950/20">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/15 text-rose-300">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-white">
          Ödəniş tamamlanmadı
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Bank əməliyyatı uğursuz qaytardı və ya istifadəçi ödənişi yarımçıq
          saxladı. Kart məlumatlarını yoxlayıb yenidən cəhd edə bilərsiniz.
        </p>
        {orderId && (
          <p className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-400">
            Sifariş: {orderId}
          </p>
        )}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/profile/wallet"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-400"
          >
            <RefreshCw className="h-4 w-4" />
            Yenidən cəhd et
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
