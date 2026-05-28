import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import InGameCreditClient from "@/components/InGameCreditClient";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Point Blank TG paketləri — Honsell PS Store",
  description:
    "Point Blank üçün TG (turqid/zəng) paketlərini sərfəli qiymətə əldə et. Rəsmi e-pin kodları və sürətli çatdırılma.",
  alternates: { canonical: "/point-blank" },
  openGraph: {
    title: "Point Blank TG Azərbaycan | Honsell PS Store",
    description:
      "Point Blank TG paketləri — rəsmi e-pin kodları ilə anlıq çatdırılma.",
    url: "/point-blank",
  },
};

export default async function PointBlankPage() {
  const plans = await prisma.serviceProduct.findMany({
    where: { isActive: true, type: "POINT_BLANK_TG" },
    orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeaderServer />

      <header className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
          Point Blank TG
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Point Blank-da silah, kostyum, klan üzvlüyü və oyun-içi alış-verişlər
          üçün TG (turqid) paketləri. Rəsmi kodlar, etibarlı satıcı.
        </p>
      </header>

      <section className="mx-auto max-w-7xl px-4 pb-14 pt-6 sm:px-6 lg:px-8">
        <InGameCreditClient
          plans={plans.map((p) => ({
            id: p.id,
            title: p.title,
            priceAznCents: p.priceAznCents,
            description: p.description,
            imageUrl: p.imageUrl,
            metadata:
              (p.metadata as { amount?: number; currency?: string } | null) ?? null,
          }))}
          productType="POINT_BLANK_TG"
          brand="Point Blank"
          currencyLabel="TG"
          brandSubtitle="Point Blank TG paketləri — silah, kostyum, klan üzvlüyü və bütün oyun-içi alış-verişlər üçün."
        />
      </section>
    </main>
  );
}
