import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Package } from "lucide-react";
import { unstable_cache } from "next/cache";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import ProductImage from "@/components/ProductImage";
import { loadBundleBySlug } from "@/lib/gameBundles";
import { formatAznCents } from "@/lib/gameBundleShared";
import { SITE_URL, SITE_NAME } from "@/lib/site";
import { gameDetailHref } from "@/lib/gameSlug";
import AddBundleToCartButton from "./AddBundleToCartButton";

export const revalidate = 3600;

/**
 * Oyun paketi detal səhifəsi.
 *
 * `"games"` tag-ı da vacibdir: PERCENT rejimli paketin qiyməti tərkib
 * oyunlarının cari qiymətindən hesablanır, ona görə scrape/qiymət dəyişikliyi
 * bu səhifəni də köhnəldir (bax `revalidateGames()`).
 */
const getBundle = unstable_cache(
  async (slug: string) => loadBundleBySlug(slug),
  ["bundle-by-slug"],
  { revalidate: 3600, tags: ["bundles", "games"] },
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const bundle = await getBundle(slug);
  if (!bundle) return { title: "Paket tapılmadı", robots: { index: false } };

  const description =
    bundle.description ??
    `${bundle.title} — ${bundle.pricing.items.length} oyun bir paketdə, ${formatAznCents(bundle.pricing.totalAznCents)}. Honsell Store-da Azərbaycanda ən sərfəli qiymətə.`;
  const canonical = `/paket/${encodeURIComponent(bundle.slug)}`;
  const image = bundle.imageUrl ?? bundle.pricing.items[0]?.imageUrl ?? null;

  return {
    title: bundle.title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      title: bundle.title,
      description,
      url: canonical,
      images: image ? [{ url: image, alt: bundle.title }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: bundle.title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function BundlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const bundle = await getBundle(slug);
  // Satıla bilməyən paket (deaktiv, vaxtı bitmiş, tərkibində deaktiv oyun)
  // `loadBundleBySlug`-dan `null` gəlir.
  if (!bundle) notFound();

  const { pricing } = bundle;
  const canonicalUrl = `${SITE_URL}/paket/${encodeURIComponent(bundle.slug)}`;
  const heroImage = bundle.imageUrl ?? pricing.items[0]?.imageUrl ?? null;

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: bundle.title,
    description: bundle.description ?? undefined,
    image: heroImage ?? undefined,
    url: canonicalUrl,
    offers: {
      "@type": "Offer",
      priceCurrency: "AZN",
      price: (pricing.totalAznCents / 100).toFixed(2),
      availability: "https://schema.org/InStock",
      url: canonicalUrl,
      seller: { "@type": "Organization", name: SITE_NAME },
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Ana səhifə", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Oyunlar", item: `${SITE_URL}/oyunlar` },
      { "@type": "ListItem", position: 3, name: bundle.title, item: canonicalUrl },
    ],
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <SiteHeaderServer />

      <section className="relative">
        {heroImage && (
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <Image src={heroImage} alt="" fill priority sizes="100vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0F] via-[#0A0A0F]/85 to-[#0A0A0F]/40" />
          </div>
        )}

        <div className="site-container pb-10 pt-6 sm:pb-14 sm:pt-10">
          <Link
            href="/oyunlar"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Bütün oyunlar
          </Link>

          <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                  <Package className="h-3.5 w-3.5" />
                  Oyun paketi
                </span>
                {bundle.badgeText && (
                  <span className="rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-amber-950">
                    {bundle.badgeText}
                  </span>
                )}
              </div>

              <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">
                {bundle.title}
              </h1>
              {bundle.subtitle && (
                <p className="mt-2 text-base font-semibold text-emerald-300">{bundle.subtitle}</p>
              )}
              {bundle.description && (
                <p className="mt-3 max-w-2xl text-sm text-zinc-300 sm:text-base">
                  {bundle.description}
                </p>
              )}
              <p className="mt-2 text-xs text-zinc-500">{pricing.items.length} oyun</p>
            </div>

            {/* ─── Qiymət kartı + səbətə əlavə ────────────────────────────── */}
            <aside className="h-fit rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur lg:sticky lg:top-24">
              {pricing.savingsAznCents > 0 && (
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[11px] font-bold text-emerald-300">
                    -{pricing.discountPct}% endirim
                  </span>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-bold text-emerald-300">
                    {formatAznCents(pricing.savingsAznCents)} qənaət
                  </span>
                </div>
              )}
              {pricing.savingsAznCents > 0 && (
                <p className="text-sm text-zinc-500 line-through tabular-nums">
                  {formatAznCents(pricing.listTotalAznCents)}
                </p>
              )}
              <p className="text-4xl font-black tracking-tight text-white tabular-nums">
                {formatAznCents(pricing.totalAznCents)}
              </p>

              <AddBundleToCartButton bundle={bundle} />

              <p className="mt-3 text-[11px] leading-snug text-zinc-500">
                Paket səbətə tək məhsul kimi düşür. Ödənişdən sonra oyunların hər biri ayrıca
                hesabınıza yüklənir.
              </p>
            </aside>
          </div>
        </div>
      </section>

      {/* ─── Paketin tərkibi ─────────────────────────────────────────────── */}
      <section className="site-container pb-14">
        <h2 className="mb-4 text-lg font-black text-white sm:text-xl">Paketin tərkibi</h2>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pricing.items.map((item, i) => {
            const game = bundle.games.find((g) => g.id === item.gameId);
            const href = game
              ? gameDetailHref({ slug: game.slug, productId: game.productId })
              : null;
            const card = (
              <>
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-zinc-900">
                  <ProductImage
                    src={item.imageUrl}
                    alt={item.title}
                    sizes="(max-width: 640px) 100vw, 300px"
                    className="object-cover"
                    priority={i < 4}
                  />
                </div>
                <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-zinc-100">
                  {item.title}
                </p>
                <p className="mt-1 flex items-baseline gap-2 text-xs">
                  {item.bundleAznCents < item.listAznCents && (
                    <span className="text-zinc-500 line-through tabular-nums">
                      {formatAznCents(item.listAznCents)}
                    </span>
                  )}
                  <span className="font-bold text-emerald-400 tabular-nums">
                    {formatAznCents(item.bundleAznCents)}
                  </span>
                </p>
              </>
            );
            return (
              <li
                key={item.gameId}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-2.5 transition hover:border-zinc-700"
              >
                {href ? (
                  <Link href={href} className="block">
                    {card}
                  </Link>
                ) : (
                  card
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
