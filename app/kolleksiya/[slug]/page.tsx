import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, LayoutGrid } from "lucide-react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import GameCard, { type GameCardData } from "@/components/GameCard";
import { SITE_URL, SITE_NAME } from "@/lib/site";

export const revalidate = 3600;

const getCollectionBySlug = unstable_cache(
  async (slug: string) => {
    return prisma.collection.findUnique({
      where: { slug },
      include: {
        games: {
          orderBy: { position: "asc" },
          include: {
            game: true,
          },
        },
      },
    });
  },
  ["collection-by-slug"],
  { revalidate: 3600, tags: ["collections", "games"] }
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection || !collection.isActive) {
    return { title: "Kolleksiya tapılmadı", robots: { index: false } };
  }

  const description =
    collection.description ??
    `${collection.title} — Honsell PS Store-da seçilmiş PlayStation oyun kolleksiyası. Azərbaycanda ən sərfəli qiymətə.`;
  const canonical = `/kolleksiya/${encodeURIComponent(collection.slug)}`;

  return {
    title: collection.title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      title: collection.title,
      description,
      url: canonical,
      images: collection.imageUrl ? [{ url: collection.imageUrl, alt: collection.title }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: collection.title,
      description,
      images: collection.imageUrl ? [collection.imageUrl] : undefined,
    },
  };
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [collection, settings] = await Promise.all([getCollectionBySlug(slug), getSettings()]);
  if (!collection || !collection.isActive) notFound();

  const cards: GameCardData[] = collection.games
    .filter((cg) => cg.game.isActive)
    .map(({ game }) => {
      const price = computeDisplayPrice(game, settings);
      return {
        id: game.id,
        productId: game.productId,
        title: game.title,
        imageUrl: game.imageUrl,
        platform: game.platform,
        productType: game.productType,
        finalAzn: price.finalAzn,
        originalAzn: price.originalAzn,
        discountPct: price.discountPct,
        discountEndAt: game.discountEndAt ? game.discountEndAt.toISOString() : null,
      };
    });

  const canonicalUrl = `${SITE_URL}/kolleksiya/${encodeURIComponent(collection.slug)}`;

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: collection.title,
    description: collection.description ?? undefined,
    numberOfItems: cards.length,
    url: canonicalUrl,
    itemListElement: cards.slice(0, 24).map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/oyunlar/${encodeURIComponent(c.productId ?? "")}`,
      name: c.title,
      offers: {
        "@type": "Offer",
        priceCurrency: "AZN",
        price: c.finalAzn.toFixed(2),
        availability: "https://schema.org/InStock",
        seller: { "@type": "Organization", name: SITE_NAME },
      },
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Ana səhifə", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Kolleksiyalar", item: `${SITE_URL}/oyunlar` },
      { "@type": "ListItem", position: 3, name: collection.title, item: canonicalUrl },
    ],
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <SiteHeaderServer />

      <section className="relative">
        {collection.imageUrl && (
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <Image
              src={collection.imageUrl}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0F] via-[#0A0A0F]/85 to-[#0A0A0F]/40" />
          </div>
        )}

        <div className="mx-auto max-w-7xl px-4 pt-6 pb-10 sm:px-6 sm:pt-10 sm:pb-14">
          <Link
            href="/oyunlar"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Bütün oyunlar
          </Link>

          <div className="mt-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-200">
              <LayoutGrid className="h-3.5 w-3.5" />
              Kolleksiya
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">
              {collection.title}
            </h1>
            {collection.description && (
              <p className="mt-3 max-w-2xl text-sm text-zinc-300 sm:text-base">{collection.description}</p>
            )}
            <p className="mt-2 text-xs text-zinc-500">
              {cards.length} oyun
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
        {cards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 py-20 text-center text-zinc-500">
            Bu kolleksiyada hələ oyun yoxdur.
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cards.map((g, i) => (
              <GameCard key={g.id} game={g} priority={i < 4} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
