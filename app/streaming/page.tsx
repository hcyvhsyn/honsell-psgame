import type { Metadata } from "next";
import { Tv } from "lucide-react";
import { prisma } from "@/lib/prisma";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import StreamingClient from "./StreamingClient";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Streaming Xidmətləri — HBO Max, Gain, YouTube Premium",
  description:
    "HBO Max, Gain və YouTube Premium abunəlikləri Azərbaycandan ən sərfəli qiymətə. 1, 2, 3, 6 və 12 aylıq paketlər.",
  alternates: { canonical: "/streaming" },
  openGraph: {
    title: "Streaming Abunəlikləri — HBO Max, Gain, YouTube Premium | Honsell",
    description:
      "Etibarlı streaming abunəlikləri — HBO Max, Gain və YouTube Premium. Anında çatdırılma.",
    url: "/streaming",
  },
};

export default async function StreamingPage() {
  const products = await prisma.serviceProduct.findMany({
    where: { isActive: true, type: "STREAMING" },
    orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
    include: { _count: { select: { codes: { where: { isUsed: false } } } } },
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeaderServer />
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="rounded-3xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-600/15 via-purple-700/10 to-zinc-900/40 p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-xs text-fuchsia-200">
            <Tv className="h-3.5 w-3.5" />
            Streaming xidmətləri
          </div>
          <h1 className="mt-4 text-3xl font-black text-white sm:text-4xl">
            HBO Max, Gain, YouTube Premium abunəlikləri
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            İstədiyin xidməti və abunəlik müddətini seç, ödənişi tamamla — məlumatları sənə tezliklə çatdıraq.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
        <StreamingClient
          products={products.map((p) => ({
            id: p.id,
            title: p.title,
            description: p.description,
            imageUrl: p.imageUrl,
            priceAznCents: p.priceAznCents,
            metadata: (p.metadata as Record<string, unknown> | null) ?? null,
            availableStock: p._count.codes,
          }))}
        />
      </section>
    </main>
  );
}
