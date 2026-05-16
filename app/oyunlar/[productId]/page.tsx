import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ArrowLeft, ExternalLink, Gamepad2, Zap, ShieldCheck, Headset, BadgeCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import GameCard, { type GameCardData } from "@/components/GameCard";
import AddToCartButton from "./AddToCartButton";
import FavoriteButton from "@/components/FavoriteButton";
import ScreenshotGallery from "./ScreenshotGallery";
import GameReviewsSection from "./GameReviewsSection";
import { SITE_URL, SITE_NAME } from "@/lib/site";

export const revalidate = 3600;

const PRODUCT_TYPE_LABEL: Record<string, string> = {
  GAME: "Oyun",
  ADDON: "Əlavə paket",
  CURRENCY: "Sanal valyuta",
  OTHER: "Digər",
};

// Build a franchise prefix from a game title — e.g.
//   "Call of Duty®: Black Ops 4"  → "Call of"
//   "FIFA 23 — Ultimate Edition"  → "FIFA 23"
//   "God of War Ragnarök"         → "God of"
// Used to find sibling SKUs that share the same franchise root.
function buildFranchiseSeed(title: string): string | null {
  const cleaned = title.replace(/[™®©]/g, " ").trim();
  const tokens = cleaned.split(/[\s:_/–—-]+/).filter(Boolean);
  if (tokens.length === 0) return null;
  const seed = tokens.slice(0, Math.min(2, tokens.length)).join(" ").trim();
  return seed.length >= 3 ? seed : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ productId: string }>;
}): Promise<Metadata> {
  const { productId } = await params;
  const [game, settings] = await Promise.all([
    prisma.game.findUnique({
      where: { productId },
      select: {
        title: true,
        imageUrl: true,
        heroImageUrl: true,
        platform: true,
        productType: true,
        priceTryCents: true,
        discountTryCents: true,
        discountEndAt: true,
      },
    }),
    getSettings(),
  ]);
  if (!game) return { title: "Oyun tapılmadı", robots: { index: false } };

  const display = computeDisplayPrice(game, settings);
  const platforms = game.platform ? game.platform.split(",").join("/") : "PlayStation";
  const discountTag = display.discountPct ? ` (${display.discountPct}% endirim)` : "";
  const priceTag = `${display.finalAzn.toFixed(2)} ₼`;

  const title = `${game.title} — ${priceTag}${discountTag} | ${platforms}`;
  const description = `${game.title} ${platforms} oyununu Azərbaycanda ən sərfəli qiymətə (${priceTag}) al. Anında çatdırılma, etibarlı ödəniş, rəsmi PSN hesabına yüklənmə.`;
  const cover = game.heroImageUrl ?? game.imageUrl ?? undefined;
  const canonical = `/oyunlar/${encodeURIComponent(productId)}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      title,
      description,
      url: canonical,
      images: cover ? [{ url: cover, alt: game.title }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: cover ? [cover] : undefined,
    },
  };
}

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const settings = await getSettings();
  const currentUser = await getCurrentUser().catch(() => null);

  const game = await prisma.game.findUnique({
    where: { productId },
  });
  if (!game || !game.isActive) notFound();

  const display = computeDisplayPrice(game, settings);

  // Relevance for "You might also like":
  //   1) Same franchise — title shares its first 1–2 significant tokens (e.g. "Call of Duty …").
  //   2) Curated peers — games that appear together in the same Collection.
  //   3) Fallback — same productType + platform, recent.
  const franchiseSeed = buildFranchiseSeed(game.title);
  const myCollections = await prisma.collectionGame.findMany({
    where: { gameId: game.id, collection: { isActive: true } },
    select: { collectionId: true },
  });
  const myCollectionIds = myCollections.map((c) => c.collectionId);

  const platformContains = game.platform ? game.platform.split(",")[0] : null;

  const [byFranchise, byCollection, byFallback] = await Promise.all([
    franchiseSeed
      ? prisma.game.findMany({
          where: {
            isActive: true,
            productType: game.productType,
            id: { not: game.id },
            title: { startsWith: franchiseSeed, mode: "insensitive" },
          },
          orderBy: [{ isFeatured: "desc" }, { discountTryCents: "desc" }, { lastScrapedAt: "desc" }],
          take: 8,
        })
      : Promise.resolve([]),
    myCollectionIds.length
      ? prisma.game.findMany({
          where: {
            isActive: true,
            id: { not: game.id },
            collections: { some: { collectionId: { in: myCollectionIds } } },
          },
          orderBy: [{ isFeatured: "desc" }, { discountTryCents: "desc" }, { lastScrapedAt: "desc" }],
          take: 8,
        })
      : Promise.resolve([]),
    prisma.game.findMany({
      where: {
        isActive: true,
        productType: game.productType,
        id: { not: game.id },
        ...(platformContains ? { platform: { contains: platformContains } } : {}),
      },
      orderBy: [{ isFeatured: "desc" }, { discountTryCents: "desc" }, { lastScrapedAt: "desc" }],
      take: 8,
    }),
  ]);

  const seen = new Set<string>();
  const similar: typeof byFallback = [];
  for (const arr of [byFranchise, byCollection, byFallback]) {
    for (const g of arr) {
      if (seen.has(g.id)) continue;
      seen.add(g.id);
      similar.push(g);
      if (similar.length >= 8) break;
    }
    if (similar.length >= 8) break;
  }

  const similarCards: GameCardData[] = similar.map((g) => {
    const d = computeDisplayPrice(g, settings);
    return {
      id: g.id,
      productId: g.productId,
      title: g.title,
      imageUrl: g.imageUrl,
      platform: g.platform,
      productType: g.productType,
      finalAzn: d.finalAzn,
      originalAzn: d.originalAzn,
      discountPct: d.discountPct,
      discountEndAt: g.discountEndAt ? g.discountEndAt.toISOString() : null,
    };
  });

  const platforms = game.platform ? game.platform.split(",") : [];
  const screenshots = Array.isArray(game.screenshots)
    ? (game.screenshots as unknown[]).filter(
        (u): u is string => typeof u === "string" && u.length > 0
      )
    : [];

  const heroImage = game.heroImageUrl ?? game.imageUrl;
  const canonicalUrl = `${SITE_URL}/oyunlar/${encodeURIComponent(game.productId)}`;
  const productImages = [heroImage, game.imageUrl, ...screenshots]
    .filter((u): u is string => Boolean(u))
    .filter((u, i, arr) => arr.indexOf(u) === i);

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: game.title,
    description: `${game.title} — ${platforms.join("/") || "PlayStation"} oyununu Azərbaycanda ən sərfəli qiymətə.`,
    sku: game.productId,
    image: productImages,
    brand: { "@type": "Brand", name: "PlayStation" },
    category: PRODUCT_TYPE_LABEL[game.productType] ?? "Oyun",
    url: canonicalUrl,
    offers: {
      "@type": "Offer",
      url: canonicalUrl,
      priceCurrency: "AZN",
      price: display.finalAzn.toFixed(2),
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
      ...(game.discountEndAt && display.discountPct
        ? { priceValidUntil: game.discountEndAt.toISOString().slice(0, 10) }
        : {}),
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Ana səhifə", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Oyunlar", item: `${SITE_URL}/oyunlar` },
      { "@type": "ListItem", position: 3, name: game.title, item: canonicalUrl },
    ],
  };

  return (
    <main className="min-h-screen bg-[#0A0A0F] text-zinc-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <SiteHeaderServer />

      {/* Hero */}
      <section className="relative">
        {heroImage ? (
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <Image
              src={heroImage}
              alt={`${game.title} — ${platforms.join("/") || "PlayStation"} oyununun arxa fonu`}
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0F] via-[#0A0A0F]/80 to-[#0A0A0F]/40" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0F] via-transparent to-[#0A0A0F]/30" />
          </div>
        ) : (
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-zinc-900 to-[#0A0A0F]" />
        )}

        <div className="mx-auto max-w-[1536px] px-4 pt-6 pb-12 sm:px-6 sm:pt-10 sm:pb-20">
          <Link
            href="/oyunlar"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Bütün oyunlar
          </Link>

          <div className="mt-8 grid gap-8 sm:mt-12 lg:grid-cols-[240px_minmax(0,1fr)_400px]">
            {/* Cover */}
            {game.imageUrl && (
              <div className="hidden lg:block">
                <div className="overflow-hidden rounded-2xl border border-white/10 shadow-2xl ring-1 ring-black/40">
                  <Image
                    src={game.imageUrl}
                    alt={`${game.title} cover`}
                    width={480}
                    height={480}
                    sizes="240px"
                    className="h-auto w-full object-cover"
                  />
                </div>
              </div>
            )}

            <div>
              {game.editionLabel && (
                <span className="inline-block rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300 ring-1 ring-amber-500/40">
                  {game.editionLabel}
                </span>
              )}
              <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
                {game.title}
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                {platforms.map((p) => (
                  <span
                    key={p}
                    className="rounded-full border border-white/30 bg-black/30 px-3 py-1 text-xs font-semibold text-white backdrop-blur"
                  >
                    {p}
                  </span>
                ))}
                <span className="rounded-full bg-zinc-800/80 px-3 py-1 text-xs font-medium text-zinc-300 ring-1 ring-zinc-700">
                  {PRODUCT_TYPE_LABEL[game.productType] ?? game.productType}
                </span>
              </div>

              {/* Value props */}
              <ul className="mt-6 grid gap-3 sm:grid-cols-2 sm:gap-4">
                <li className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3.5 py-3 backdrop-blur">
                  <Zap className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" />
                  <div className="text-xs leading-snug text-zinc-300">
                    <div className="font-semibold text-zinc-100">Anında çatdırılma</div>
                    Sifariş təsdiqindən sonra dəqiqələr ərzində PSN hesabına yüklənir.
                  </div>
                </li>
                <li className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3.5 py-3 backdrop-blur">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <div className="text-xs leading-snug text-zinc-300">
                    <div className="font-semibold text-zinc-100">Lisenziya zəmanəti</div>
                    Rəsmi PS Store-dan, hesabınıza ömürlük bağlı qalır.
                  </div>
                </li>
                <li className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3.5 py-3 backdrop-blur">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  <div className="text-xs leading-snug text-zinc-300">
                    <div className="font-semibold text-zinc-100">Etibarlı ödəniş</div>
                    Yerli kart, balans və epoint ilə təhlükəsiz satınalma.
                  </div>
                </li>
                <li className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3.5 py-3 backdrop-blur">
                  <Headset className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                  <div className="text-xs leading-snug text-zinc-300">
                    <div className="font-semibold text-zinc-100">7/24 dəstək</div>
                    WhatsApp və telefon üzərindən canlı kömək.
                  </div>
                </li>
              </ul>
            </div>

            {/* Price card */}
            <aside className="rounded-2xl border border-zinc-800 bg-[#0A0A0A]/85 p-5 shadow-xl backdrop-blur sm:p-6">
              {display.discountPct != null && (
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[#6D28D9] px-2.5 py-1 text-xs font-bold text-white">
                  -{display.discountPct}% endirim
                </div>
              )}
              <div className="flex items-baseline gap-3">
                {display.originalAzn != null && (
                  <span className="relative text-base text-zinc-500">
                    {display.originalAzn.toFixed(2)}₼
                    <span
                      aria-hidden
                      className="pointer-events-none absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 -rotate-6 bg-rose-500"
                    />
                  </span>
                )}
                <span className="text-3xl font-bold tracking-tight text-white">
                  {display.finalAzn.toFixed(2)}₼
                </span>
              </div>

              {game.discountEndAt && display.discountPct != null && (
                <p className="mt-2 text-xs text-zinc-400">
                  Endirim bitir:{" "}
                  <span className="text-indigo-300">
                    {new Date(game.discountEndAt).toLocaleDateString("az-AZ", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </p>
              )}

              <div className="mt-5">
                <AddToCartButton
                  game={{
                    id: game.id,
                    title: game.title,
                    imageUrl: game.imageUrl,
                    finalAzn: display.finalAzn,
                    productType: game.productType,
                  }}
                />
              </div>

              <div className="mt-3">
                <FavoriteButton gameId={game.id} variant="detail" />
              </div>

              {game.productUrl && (
                <a
                  href={game.productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-2.5 text-xs font-medium text-zinc-300 hover:border-zinc-700 hover:text-white"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  PS Store-da bax
                </a>
              )}
            </aside>
          </div>
        </div>
      </section>

      {/* Trailer */}
      {game.trailerUrl && (
        <section className="mx-auto max-w-[1536px] px-4 pb-10 sm:px-6">
          <h2 className="mb-4 text-lg font-semibold text-zinc-200">Treyler</h2>
          <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-black">
            <video
              src={game.trailerUrl}
              poster={game.heroImageUrl ?? game.imageUrl ?? undefined}
              controls
              preload="metadata"
              playsInline
              className="aspect-video w-full"
            />
          </div>
        </section>
      )}

      {/* Screenshots */}
      {screenshots.length > 0 && (
        <section className="mx-auto max-w-[1536px] px-4 pb-10 sm:px-6">
          <h2 className="mb-4 text-lg font-semibold text-zinc-200">
            Ekran görüntüləri
          </h2>
          <ScreenshotGallery screenshots={screenshots} gameTitle={game.title} />
        </section>
      )}

      {/* Similar — surfaced above reviews so users actually see them */}
      {similarCards.length > 0 && (
        <section className="mx-auto max-w-[1536px] px-4 pb-10 sm:px-6">
          <div className="mb-5 flex items-center gap-2">
            <Gamepad2 className="h-5 w-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-zinc-200">
              Bunlar da xoşunuza gələ bilər
            </h2>
          </div>
          <ul className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {similarCards.slice(0, 6).map((g) => (
              <GameCard key={g.id} game={g} />
            ))}
          </ul>
        </section>
      )}

      {/* Reviews */}
      <GameReviewsSection
        game={{
          id: game.id,
          productId: game.productId,
          title: game.title,
          coverImageUrl: heroImage ?? game.imageUrl,
          finalAzn: display.finalAzn,
        }}
        viewerUserId={currentUser?.id ?? null}
      />
    </main>
  );
}
