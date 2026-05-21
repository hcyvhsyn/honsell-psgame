import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Globe, LayoutTemplate, Smartphone } from "lucide-react";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import SiteFooter from "@/components/SiteFooter";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Xidmətlər — Honsell",
  description:
    "Bizneslər üçün satış yönümlü website hazırlanması və digər rəqəmsal xidmətlər.",
  alternates: { canonical: "/xidmetler" },
};

export default function XidmetlerPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeaderServer />

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <header className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-400">
            Xidmətlər
          </p>
          <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
            Rəqəmsal həllər və layihə xidmətləri
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Honsell yalnız rəqəmsal məhsul satışı ilə deyil, biznesinizin
            online görünüşü üçün də işləyir. Aşağıdakı xidmətlər layihə əsaslı
            qaydada hazırlanır.
          </p>
        </header>

        <div className="grid gap-6 sm:grid-cols-2">
          <Link
            href="/xidmetler/website"
            className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900 p-6 transition hover:border-violet-500/60"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30">
                <Globe className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-white">Website Hazırlanması</h2>
                <p className="text-xs text-zinc-500">
                  150 AZN-dən başlayaraq
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm text-zinc-300">
              Biznesiniz üçün satış yönümlü, mobil uyğun və modern website
              hazırlayırıq.
            </p>
            <ul className="mt-4 space-y-1.5 text-xs text-zinc-400">
              <li className="flex items-center gap-2">
                <LayoutTemplate className="h-3.5 w-3.5 text-violet-400" />
                Landing, biznes saytları, e-commerce
              </li>
              <li className="flex items-center gap-2">
                <Smartphone className="h-3.5 w-3.5 text-violet-400" />
                Mobil uyğun və SEO-friendly
              </li>
            </ul>
            <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-violet-300 transition group-hover:text-violet-200">
              Layihə üçün müraciət et
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </div>
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
