import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { LayoutGrid } from "lucide-react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import { SITE_URL, SITE_NAME } from "@/lib/site";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Kolleksiyalar — Tematik PlayStation Oyun Siyahıları",
  description:
    "Honsell PS Store-da seçilmiş tematik PlayStation oyun kolleksiyaları: RPG, çoxoyunçu, PS5 eksklüziv, indie və daha çox.",
  alternates: { canonical: "/kolleksiyalar" },
  openGraph: {
    title: "PlayStation Oyun Kolleksiyaları | Honsell PS Store",
    description: "Tematik kolleksiyalarla maraqlandığın janrı tap.",
    url: "/kolleksiyalar",
  },
};

const getCollections = unstable_cache(
  async () => {
    return prisma.collection.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: {
        _count: { select: { games: true } },
        games: {
          orderBy: { position: "asc" },
          take: 1,
          include: { game: { select: { imageUrl: true, heroImageUrl: true } } },
        },
      },
    });
  },
  ["collections-index"],
  { revalidate: 1800, tags: ["collections"] }
);

export default async function CollectionsIndexPage() {
  const collections = await getCollections().catch(() => []);

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "PlayStation oyun kolleksiyaları",
    numberOfItems: collections.length,
    itemListElement: collections.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/kolleksiya/${encodeURIComponent(c.slug)}`,
      name: c.title,
    })),
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <SiteHeaderServer />

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-indigo-600/15 via-fuchsia-700/10 to-zinc-900/40 p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-200">
            <LayoutGrid className="h-3.5 w-3.5" />
            Kolleksiyalar
          </div>
          <h1 className="mt-4 text-3xl font-black text-white sm:text-4xl">
            PlayStation Oyun Kolleksiyaları
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Janr, mövzu və ya təcrübəyə görə qruplaşdırılmış oyun siyahıları. {SITE_NAME} kuratorları tərəfindən seçilib.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
        {collections.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 py-20 text-center text-zinc-500">
            Hələ heç bir kolleksiya yaradılmayıb.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {collections.map((c) => {
              const cover =
                c.imageUrl ??
                c.games[0]?.game.heroImageUrl ??
                c.games[0]?.game.imageUrl ??
                null;
              return (
                <Link
                  key={c.id}
                  href={`/kolleksiya/${c.slug}`}
                  className="group relative aspect-[5/3] overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 transition hover:-translate-y-1 hover:border-indigo-500/40"
                >
                  {cover ? (
                    <Image
                      src={cover}
                      alt={c.title}
                      fill
                      sizes="(max-width: 1024px) 100vw, 33vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/20 to-fuchsia-700/20" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">Kolleksiya</p>
                    <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">{c.title}</h2>
                    <p className="mt-1 text-sm text-zinc-300">{c._count.games} oyun</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
