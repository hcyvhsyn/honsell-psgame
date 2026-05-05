import type { Metadata } from "next";
import { Gift } from "lucide-react";
import { prisma } from "@/lib/prisma";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import HediyyeKartlariClient from "./HediyyeKartlariClient";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "PlayStation Hədiyyə Kartları — TRY Wallet Kodları",
  description:
    "Türkiyə PSN üçün hədiyyə kartları və wallet top-up kodları. Anında e-pin çatdırılması, etibarlı ödəniş, ən sərfəli kurs.",
  alternates: { canonical: "/hediyye-kartlari" },
  openGraph: {
    title: "PlayStation Hədiyyə Kartları — TRY Wallet Kodları | Honsell PS Store",
    description:
      "Türkiyə PSN wallet-i üçün anında e-pin kodlar. Ən sərfəli kursla TRY balansı.",
    url: "/hediyye-kartlari",
  },
};

export default async function HediyyeKartlariPage() {
  const cards = await prisma.serviceProduct.findMany({
    where: { isActive: true, type: "TRY_BALANCE" },
    orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
    include: { _count: { select: { codes: { where: { isUsed: false } } } } },
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeaderServer />
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-600/15 to-zinc-900/40 p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
            <Gift className="h-3.5 w-3.5" />
            Hədiyyə Kartları
          </div>
          <h1 className="mt-4 text-3xl font-black text-white sm:text-4xl">PlayStation Hədiyyə Kartları — TRY Wallet Top-up</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Türkiyə PSN hesabınız üçün hədiyyə kartları və wallet top-up kodları. Məbləği seç, ödənişi et və kodu anında əldə et.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
        <HediyyeKartlariClient
          cards={cards.map((c) => ({
            id: c.id,
            title: c.title,
            imageUrl: c.imageUrl,
            priceAznCents: c.priceAznCents,
            metadata: (c.metadata as Record<string, unknown> | null) ?? null,
            _count: { codes: c._count.codes },
          }))}
        />
      </section>
    </main>
  );
}