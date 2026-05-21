import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import LinkedInHero from "@/components/linkedin/LinkedInHero";
import LinkedInPlanSelector from "@/components/linkedin/LinkedInPlanSelector";
import LinkedInComparisonTable from "@/components/linkedin/LinkedInComparisonTable";
import LinkedInGuidance from "@/components/linkedin/LinkedInGuidance";
import LinkedInTrustSection from "@/components/linkedin/LinkedInTrustSection";
import LinkedInFAQ from "@/components/linkedin/LinkedInFAQ";
import { groupVariantsByPlan } from "@/lib/linkedin-plans";
import { getLinkedInVariants } from "@/lib/linkedin-plans.server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "LinkedIn Premium — Career & Business | Honsell",
  description:
    "LinkedIn Premium Career və Business abunəlikləri Azərbaycanda. 1, 3, 6 və 12 aylıq paketlər — öz hesabına aktivləşdirilir, 50%-ə qədər endirim.",
  alternates: { canonical: "/work/linkedin-premium" },
  openGraph: {
    title: "LinkedIn Premium — Career & Business",
    description:
      "Karyera və biznes üçün LinkedIn Premium abunəlikləri. Öz LinkedIn hesabına aktivləşdirilir, parol tələb olunmur.",
    url: "/work/linkedin-premium",
  },
};

export default async function LinkedInPremiumPage() {
  const [variants, faqs] = await Promise.all([
    getLinkedInVariants(),
    prisma.faqItem.findMany({
      where: { scope: "LINKEDIN_PREMIUM", isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, question: true, answer: true },
    }),
  ]);
  const groups = groupVariantsByPlan(variants);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeaderServer />

      <nav
        aria-label="Breadcrumb"
        className="mx-auto max-w-7xl px-4 pt-6 text-xs text-zinc-400 sm:px-6 lg:px-8"
      >
        <ol className="flex items-center gap-1.5">
          <li>
            <Link href="/" className="transition hover:text-white">
              Ana səhifə
            </Link>
          </li>
          <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />
          <li>
            <Link href="/work" className="transition hover:text-white">
              İş Platformaları
            </Link>
          </li>
          <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />
          <li className="font-semibold text-zinc-200">LinkedIn Premium</li>
        </ol>
      </nav>

      <div className="mx-auto max-w-7xl space-y-14 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <LinkedInHero />

        <section id="plans" className="scroll-mt-20">
          <header className="mb-6 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-300">Planlar</p>
            <h2 className="mt-2 text-3xl font-black text-white sm:text-4xl">
              Hansı plan sənin üçündür?
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Müddəti seç — qiymət və endirim avtomatik yenilənir.
            </p>
          </header>
          <LinkedInPlanSelector groups={groups} />
        </section>

        <LinkedInGuidance />

        <LinkedInComparisonTable />

        <LinkedInTrustSection />

        <LinkedInFAQ items={faqs} />

        {/* Final CTA */}
        <section className="overflow-hidden rounded-3xl border border-sky-400/25 bg-gradient-to-r from-sky-600/15 via-blue-600/10 to-indigo-600/15 px-6 py-10 text-center shadow-2xl sm:px-10 sm:py-14">
          <h2 className="text-3xl font-black text-white sm:text-4xl">
            LinkedIn-də fərqlən
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-300 sm:text-base">
            Career və ya Business — sənin üçün doğru olan planı seç və bir neçə saat ərzində Premium ol.
          </p>
          <a
            href="#plans"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-3 text-sm font-black text-white shadow-[0_12px_30px_rgba(37,99,235,0.4)] transition hover:from-sky-400 hover:to-blue-500"
          >
            Planı seç
            <ArrowRight className="h-4 w-4" />
          </a>
        </section>
      </div>
    </main>
  );
}
