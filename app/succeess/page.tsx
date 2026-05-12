import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle2,
  Home,
  WalletCards,
  Receipt,
  ShieldCheck,
  Clock,
  ArrowRight,
} from "lucide-react";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import SiteFooter from "@/components/SiteFooter";
import ClearCartOnMount from "./ClearCartOnMount";

export const metadata: Metadata = {
  title: "Ödəniş uğurlu oldu",
  robots: { index: false, follow: false },
};

export default function EpointSuccessPage({
  searchParams,
}: {
  searchParams?: { order_id?: string; transaction?: string; order_code?: string };
}) {
  const orderId = searchParams?.order_id ?? searchParams?.transaction ?? null;
  const orderCode = searchParams?.order_code ?? null;
  const isCartOrder = Boolean(orderCode);

  return (
    <>
      <SiteHeaderServer />
      <main className="relative isolate overflow-hidden bg-zinc-950 text-zinc-100">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, rgba(16, 185, 129, 0.18), transparent 70%), radial-gradient(40% 40% at 80% 80%, rgba(124, 58, 237, 0.18), transparent 70%), radial-gradient(40% 40% at 10% 90%, rgba(99, 102, 241, 0.14), transparent 70%)",
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

        <ClearCartOnMount active={isCartOrder} />

        <section className="mx-auto flex min-h-[calc(100vh-200px)] max-w-3xl flex-col items-center justify-center px-4 py-16 sm:py-24">
          <div className="relative">
            <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-emerald-400/30" />
            <span className="absolute inset-0 -z-10 rounded-full bg-emerald-500/20 blur-2xl" />
            <div className="flex h-24 w-24 items-center justify-center rounded-full border border-emerald-400/40 bg-gradient-to-br from-emerald-400/30 to-emerald-600/20 shadow-[0_0_60px_-12px_rgba(16,185,129,0.6)]">
              <CheckCircle2 className="h-12 w-12 text-emerald-300" strokeWidth={2.2} />
            </div>
          </div>

          <span className="mt-8 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            Epoint təsdiqlədi
          </span>

          <h1 className="mt-5 text-center text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Ödəniş uğurla tamamlandı
          </h1>
          <p className="mt-4 max-w-xl text-center text-base leading-7 text-zinc-400">
            {isCartOrder
              ? "Sifarişiniz qəbul edildi. Komandamız çatdırılma üçün dərhal işə başlayacaq və status dəyişdikdə bildiriş alacaqsınız."
              : "Balansınız bir neçə saniyə ərzində avtomatik artırılacaq. Əgər balans hələ də yenilənməyibsə, səhifəni yeniləyin."}
          </p>

          {(orderId || orderCode) && (
            <div className="mt-8 grid w-full max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
              {orderCode && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] px-4 py-3 backdrop-blur">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-300/80">
                    <Receipt className="h-3.5 w-3.5" />
                    Sifariş kodu
                  </div>
                  <div className="mt-1.5 truncate font-mono text-sm font-semibold text-emerald-100">
                    {orderCode}
                  </div>
                </div>
              )}
              {orderId && (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    <Clock className="h-3.5 w-3.5" />
                    Tranzaksiya
                  </div>
                  <div className="mt-1.5 truncate font-mono text-xs text-zinc-300">
                    {orderId}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-10 flex w-full max-w-md flex-col gap-3 sm:flex-row">
            <Link
              href={isCartOrder ? "/profile" : "/profile/wallet"}
              className="group inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:from-emerald-400 hover:to-emerald-300"
            >
              {isCartOrder ? (
                <>
                  <Receipt className="h-4 w-4" />
                  Sifarişlərim
                </>
              ) : (
                <>
                  <WalletCards className="h-4 w-4" />
                  Balansa bax
                </>
              )}
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
            Hər hansı problem yaranarsa Honsell dəstək komandası ilə əlaqə saxlayın.
            Sifariş kodunuzu hazır saxlayın.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
