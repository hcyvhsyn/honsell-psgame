import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeaderServer";
import { getCurrentUser } from "@/lib/auth";
import { isAbunelikEnabled } from "@/lib/abunelik/session";
import AbunelikClient from "@/components/abunelik/AbunelikClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nömrə ilə daxil ol | Honsell",
  description: "WhatsApp nömrənizə gələn kodla daxil olun: abunəlikləriniz, giriş məlumatlarınız və onlayn yeniləmə profilinizdədir.",
  robots: { index: false, follow: false },
};

/**
 * /abunelik — YALNIZ giriş: nömrə + WhatsApp kodu → sayt hesabı (lib/abunelik/login.ts) → /profile/abunelikler.
 * Abunəliklər və giriş məlumatları burada GÖSTƏRİLMİR — yalnız profildə. Daxil olmuş istifadəçi profilə keçir
 * (köhnə linklər və ödəniş qayıdışı parametrləri ilə birlikdə).
 */
export default async function AbunelikPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const user = await getCurrentUser();
  if (user && !user.disabled) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) if (typeof v === "string") qs.set(k, v);
    const query = qs.toString();
    redirect(`/profile/abunelikler${query ? `?${query}` : ""}`);
  }
  const enabled = isAbunelikEnabled();
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_50%_-10%,rgba(124,58,237,0.08),transparent_34%),linear-gradient(180deg,rgba(247,246,251,0.55),rgba(247,246,251,0.96))] text-zinc-900 dark:bg-[radial-gradient(circle_at_50%_-10%,rgba(88,28,135,0.16),transparent_34%),linear-gradient(180deg,rgba(4,5,14,0.25),rgba(4,5,14,0.9))] dark:text-zinc-100">
      <SiteHeader />
      <main className="site-container py-6 sm:py-10">
        <div className="mx-auto max-w-3xl">
          {enabled ? (
            <AbunelikClient mode="login" initialVerified={false} />
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
