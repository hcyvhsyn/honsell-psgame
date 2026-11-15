import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeaderServer";
import { isAbunelikEnabled, readVerifiedPhone } from "@/lib/abunelik/session";
import AbunelikClient from "./AbunelikClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Abunəliklərim — Netflix, Spotify, PS Plus | Honsell",
  description: "Nömrənizlə daxil olun: aktiv abunəliklərinizi, hesab məlumatlarınızı görün və onlayn yeniləyin.",
  robots: { index: false, follow: false },
};

/**
 * /abunelik — CRM müştəriləri üçün: nömrə + WhatsApp kodu ilə giriş, abunəliklər (aktiv + son 45 gün),
 * hesab məlumatları, CRM qiyməti ilə kartla yeniləmə. Data CRM-dən (lib/crmRenewals.ts), telefon imzalı
 * cookie-dən (lib/abunelik/session.ts).
 */
export default function AbunelikPage() {
  const enabled = isAbunelikEnabled();
  const verified = enabled ? readVerifiedPhone() : null;
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_50%_-10%,rgba(124,58,237,0.08),transparent_34%),linear-gradient(180deg,rgba(247,246,251,0.55),rgba(247,246,251,0.96))] text-zinc-900 dark:bg-[radial-gradient(circle_at_50%_-10%,rgba(88,28,135,0.16),transparent_34%),linear-gradient(180deg,rgba(4,5,14,0.25),rgba(4,5,14,0.9))] dark:text-zinc-100">
      <SiteHeader />
      <main className="site-container py-6 sm:py-10">
        <div className="mx-auto max-w-3xl">
          {enabled ? (
            <AbunelikClient initialVerified={verified != null} />
          ) : (
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-white/5 dark:bg-[#111116]">
              <h1 className="text-xl font-bold">Abunəliklərim</h1>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Tezliklə burada abunəliklərinizi görüb onlayn yeniləyə biləcəksiniz.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
