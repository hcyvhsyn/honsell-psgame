import type { Metadata } from "next";
import { Music as MusicIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import PlatformsPublicSection from "@/components/PlatformsPublicSection";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Musiqi Platformaları — Honsell",
  description: "Spotify, Apple Music və digər musiqi platformaları üçün abunəliklər.",
  alternates: { canonical: "/music" },
};

export default async function MusicPage() {
  const products = await prisma.serviceProduct.findMany({
    where: { type: "PLATFORM", isActive: true },
    orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
  });
  const filtered = products.filter((p) => {
    const m = (p.metadata as Record<string, unknown> | null) ?? {};
    return String(m.category ?? "") === "MUSIC";
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeaderServer />
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <header className="mb-8 flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-xl border border-emerald-400/30 bg-emerald-400/15 text-emerald-200">
            <MusicIcon className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-3xl font-black text-white sm:text-4xl">Musiqi Platformaları</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Spotify, Apple Music və digər musiqi xidmətləri üçün abunəliklər. Sifarişdən sonra
              admin tərəfindən hesab məlumatları emailinə göndərilir.
            </p>
          </div>
        </header>
        <PlatformsPublicSection products={filtered} />
      </section>
    </main>
  );
}
