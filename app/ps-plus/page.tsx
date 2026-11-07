import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import PsPlusClient from "./PsPlusClient";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "PS Plus Üzvlüyü — Essential, Extra, Deluxe (Türkiyə Bölgəsi)",
  description:
    "Azərbaycanda PS Plus Essential, Extra və Deluxe üzvlüklərini ən sərfəli qiymətə əldə edin. 1, 3 və 12 aylıq abunəliklər, anında aktivləşmə.",
  alternates: { canonical: "/ps-plus" },
  openGraph: {
    title: "PS Plus Üzvlüyü Azərbaycan — Essential / Extra / Deluxe | Honsell Store",
    description:
      "PS Plus üzvlüyünü ən ucuz qiymətə al. Essential, Extra və Deluxe — bütün tier-lər mövcuddur.",
    url: "/ps-plus",
  },
};

export default async function PsPlusPage() {
  const plans = await prisma.serviceProduct.findMany({
    where: { isActive: true, type: "PS_PLUS" },
    orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeaderServer />

      <header className="site-container pt-8">
        <h1 className="text-3xl font-black tracking-tight text-zinc-950 dark:text-white sm:text-4xl">PS Plus</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Essential, Extra və Deluxe · Türkiyə bölgəsi · 1, 3 və 12 ay
        </p>
      </header>

      <section className="site-container pb-14 pt-8">
        <PsPlusClient
          plans={plans.map((p) => ({
            id: p.id,
            title: p.title,
            imageUrl: p.imageUrl,
            priceAznCents: p.priceAznCents,
            metadata: (p.metadata as Record<string, unknown> | null) ?? null,
          }))}
        />
      </section>
    </main>
  );
}
