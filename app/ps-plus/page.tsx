import { prisma } from "@/lib/prisma";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import PsPlusClient from "./PsPlusClient";

export const dynamic = "force-dynamic";

export default async function PsPlusPage() {
  const plans = await prisma.serviceProduct.findMany({
    where: { isActive: true, type: "PS_PLUS" },
    orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeaderServer />

      <section className="mx-auto max-w-7xl px-4 pb-14 pt-6 sm:px-6">
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
