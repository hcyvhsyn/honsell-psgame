import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import EaPlayClient from "./EaPlayClient";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "EA Play Üzvlüyü — 1 və 12 aylıq (Türkiyə Bölgəsi)",
  description:
    "Azərbaycanda EA Play üzvlüyünü ən sərfəli qiymətə əldə edin. EA-nın oyun kolleksiyası, üzv mükafatları, 10% endirim — 1 və 12 aylıq paketlər mövcuddur.",
  alternates: { canonical: "/ea-play" },
  openGraph: {
    title: "EA Play Üzvlüyü Azərbaycan — 1 / 12 ay | Honsell PS Store",
    description:
      "EA Play üzvlüyünü ən ucuz qiymətə al. EA SPORTS FC, F1, The Sims, STAR WARS və 100+ digər oyun.",
    url: "/ea-play",
  },
};

export default async function EaPlayPage() {
  const plans = await prisma.serviceProduct.findMany({
    where: { isActive: true, type: "EA_PLAY" },
    orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeaderServer />

      <header className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
        <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
          EA Play Üzvlüyü
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          EA-nın oyun kolleksiyasına limitsiz giriş, yeni oyunların sınaq versiyaları (10 saat),
          aylıq üzv mükafatları və EA mağazasında 10% endirim. 1 və 12 aylıq paketlər.
        </p>
      </header>

      <section className="mx-auto max-w-7xl px-4 pb-14 pt-6 sm:px-6">
        <EaPlayClient
          plans={plans.map((p) => ({
            id: p.id,
            title: p.title,
            imageUrl: p.imageUrl,
            description: p.description,
            priceAznCents: p.priceAznCents,
            metadata: (p.metadata as Record<string, unknown> | null) ?? null,
          }))}
        />
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-2xl font-black text-white">100+ oyun</div>
            <p className="mt-1 text-sm text-zinc-400">
              EA SPORTS FC, F1, The Sims, STAR WARS, Battlefield, Apex Legends və başqaları
            </p>
          </div>
          <div>
            <div className="text-2xl font-black text-white">10 saat sınaq</div>
            <p className="mt-1 text-sm text-zinc-400">
              Yeni buraxılışları satın almazdan əvvəl 10 saata qədər oyna
            </p>
          </div>
          <div>
            <div className="text-2xl font-black text-white">10% endirim</div>
            <p className="mt-1 text-sm text-zinc-400">
              EA rəqəmsal mağazasında oyunlar, point paketləri və DLC üçün
            </p>
          </div>
          <div>
            <div className="text-2xl font-black text-white">Aylıq mükafat</div>
            <p className="mt-1 text-sm text-zinc-400">
              Ən son EA oyunlarında üzvlərə eksklüziv məzmun və daxili əşyalar
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
