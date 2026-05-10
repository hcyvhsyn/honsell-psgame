import type { Metadata } from "next";
import { Briefcase } from "lucide-react";
import { prisma } from "@/lib/prisma";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import PlatformsPublicSection from "@/components/PlatformsPublicSection";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "İş Platformaları — Honsell",
  description: "LinkedIn Premium, Notion, Figma və digər iş alətləri üçün abunəliklər.",
  alternates: { canonical: "/work" },
};

export default async function WorkPage() {
  const products = await prisma.serviceProduct.findMany({
    where: { type: "PLATFORM", isActive: true },
    orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
  });
  const filtered = products.filter((p) => {
    const m = (p.metadata as Record<string, unknown> | null) ?? {};
    return String(m.category ?? "") === "WORK";
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeaderServer />
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <header className="mb-8 flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-xl border border-amber-400/30 bg-amber-400/15 text-amber-200">
            <Briefcase className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-3xl font-black text-white sm:text-4xl">İş Platformaları</h1>
            <p className="mt-1 text-sm text-zinc-400">
              LinkedIn Premium, Notion, Figma və digər iş alətləri üçün abunəliklər. Sifarişdən
              sonra admin tərəfindən hesab məlumatları emailinə göndərilir.
            </p>
          </div>
        </header>
        <PlatformsPublicSection products={filtered} />
      </section>
    </main>
  );
}
