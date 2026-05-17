import type { Metadata } from "next";
import { Brain } from "lucide-react";
import { prisma } from "@/lib/prisma";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import PlatformsPublicSection from "@/components/PlatformsPublicSection";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Süni İntellekt Abunəlikləri — Honsell",
  description: "ChatGPT Plus, Claude Plus və digər süni intellekt abunəlikləri.",
  alternates: { canonical: "/ai" },
};

export default async function AiPage() {
  const products = await prisma.serviceProduct.findMany({
    where: { type: "PLATFORM", isActive: true },
    orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
  });
  const filtered = products.filter((p) => {
    const m = (p.metadata as Record<string, unknown> | null) ?? {};
    return String(m.category ?? "") === "AI";
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeaderServer />
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <header className="mb-8 flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-xl border border-fuchsia-400/30 bg-fuchsia-400/15 text-fuchsia-200">
            <Brain className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-3xl font-black text-white sm:text-4xl">Süni İntellekt</h1>
            <p className="mt-1 text-sm text-zinc-400">
              ChatGPT Plus, Claude Plus və digər AI alətləri üçün hazır abunəliklər. Sifarişdən
              sonra admin tərəfindən hesab məlumatları emailinə göndərilir.
            </p>
          </div>
        </header>
        <PlatformsPublicSection products={filtered} />
      </section>
    </main>
  );
}
