import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertCircle,
  Home,
  RefreshCw,
  CreditCard,
  HelpCircle,
  ArrowRight,
  XCircle,
} from "lucide-react";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Ödəniş alınmadı",
  robots: { index: false, follow: false },
};

export default function EpointErrorPage({
  searchParams,
}: {
  searchParams?: {
    order_id?: string;
    transaction?: string;
    message?: string;
    order_code?: string;
  };
}) {
  const orderId = searchParams?.order_id ?? searchParams?.transaction ?? null;
  const message = searchParams?.message ?? null;

  return (
    <>
      <SiteHeaderServer />
      <main className="relative isolate overflow-hidden bg-zinc-950 text-zinc-100">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, rgba(244, 63, 94, 0.18), transparent 70%), radial-gradient(40% 40% at 80% 80%, rgba(124, 58, 237, 0.18), transparent 70%), radial-gradient(40% 40% at 10% 90%, rgba(244, 63, 94, 0.12), transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage:
              "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          }}
        />

        <section className="mx-auto flex min-h-[calc(100vh-200px)] max-w-3xl flex-col items-center justify-center px-4 py-16 sm:py-24">
          <div className="relative">
            <span className="absolute inset-0 -z-10 rounded-full bg-rose-500/20 blur-2xl" />
            <div className="flex h-24 w-24 items-center justify-center rounded-full border border-rose-400/40 bg-gradient-to-br from-rose-400/30 to-rose-600/20 shadow-[0_0_60px_-12px_rgba(244,63,94,0.6)]">
              <XCircle className="h-12 w-12 text-rose-300" strokeWidth={2.2} />
            </div>
          </div>

          <span className="mt-8 inline-flex items-center gap-2 rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-200">
            <AlertCircle className="h-3.5 w-3.5" />
            Ödəniş alınmadı
          </span>

          <h1 className="mt-5 text-center text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Ödəniş tamamlanmadı
          </h1>
          <p className="mt-4 max-w-xl text-center text-base leading-7 text-zinc-400">
            Bank əməliyyatı uğursuz oldu və ya ödəniş yarımçıq saxlanıldı.
            Heç bir məbləğ tutulmadı — kart məlumatlarını yoxlayıb yenidən cəhd
            edə bilərsiniz.
          </p>

          {message && (
            <div className="mt-6 w-full max-w-md rounded-xl border border-rose-400/20 bg-rose-500/[0.06] px-4 py-3 text-center text-sm text-rose-100/90">
              {message}
            </div>
          )}

          {orderId && (
            <div className="mt-6 w-full max-w-md rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                <CreditCard className="h-3.5 w-3.5" />
                Tranzaksiya
              </div>
              <div className="mt-1.5 truncate font-mono text-xs text-zinc-300">
                {orderId}
              </div>
            </div>
          )}

          <div className="mt-10 grid w-full max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                <CreditCard className="h-4 w-4 text-indigo-300" />
                Kartı yoxlayın
              </div>
              <p className="mt-1.5 text-xs leading-5 text-zinc-500">
                Balans, müddət və CVV doğru olduğuna əmin olun.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                <HelpCircle className="h-4 w-4 text-indigo-300" />
                3D Secure
              </div>
              <p className="mt-1.5 text-xs leading-5 text-zinc-500">
                Bank SMS təsdiqi vaxtında girilməyibsə, ödəniş ləğv olunur.
              </p>
            </div>
          </div>

          <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row">
            <Link
              href="/profile/wallet"
              className="group inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-rose-400 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-500/25 transition hover:from-rose-400 hover:to-rose-300"
            >
              <RefreshCw className="h-4 w-4" />
              Yenidən cəhd et
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-zinc-200 backdrop-blur transition hover:border-white/20 hover:bg-white/[0.06]"
            >
              <Home className="h-4 w-4" />
              Ana səhifə
            </Link>
          </div>

          <p className="mt-10 max-w-md text-center text-xs leading-6 text-zinc-500">
            Məbləğ kartdan tutulubsa amma sifariş hələ də gəlməyibsə, bir neçə
            dəqiqə gözləyin və ya dəstək komandası ilə əlaqə saxlayın.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
