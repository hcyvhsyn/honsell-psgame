import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import {
  ArrowLeft,
  BadgeCheck,
  BadgePercent,
  CalendarClock,
  ExternalLink,
  Gamepad2,
  Headset,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
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

  const savingsAzn =
    display.originalAzn != null
      ? Math.max(display.originalAzn - display.finalAzn, 0)
      : null;
  const discountEndLabel = game.discountEndAt
    ? new Date(game.discountEndAt).toLocaleDateString("az-AZ", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;
  const serviceHighlights = [
    {
      title: "Anında çatdırılma",
      text: "Sifariş təsdiqindən sonra PSN hesabına yüklənir.",
      Icon: Zap,
      iconClass: "text-indigo-600 dark:text-indigo-300",
    },
    {
      title: "Lisenziya zəmanəti",
      text: "Rəsmi PS Store-dan hesabınıza bağlı qalır.",
      Icon: ShieldCheck,
      iconClass: "text-emerald-600 dark:text-emerald-300",
    },
    {
      title: "Etibarlı ödəniş",
      text: "Yerli kart, balans və epoint ilə təhlükəsiz alış.",
      Icon: BadgeCheck,
      iconClass: "text-amber-600 dark:text-amber-300",
    },
    {
      title: "7/24 dəstək",
      text: "WhatsApp və telefon üzərindən canlı kömək.",
      Icon: Headset,
      iconClass: "text-rose-600 dark:text-rose-300",
    },
  ];

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950 dark:bg-[#0A0A0F] dark:text-zinc-100">
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
      <section className="relative overflow-hidden border-b border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-[#07070B]">
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
            <div className="absolute inset-0 bg-white/76 dark:bg-[#07070B]/82" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(124,58,237,0.16),transparent_34%),radial-gradient(circle_at_78%_20%,rgba(236,72,153,0.10),transparent_28%)] dark:bg-[radial-gradient(circle_at_18%_18%,rgba(124,58,237,0.34),transparent_34%),radial-gradient(circle_at_78%_20%,rgba(236,72,153,0.16),transparent_28%)]" />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-50 via-zinc-50/80 to-white/45 dark:from-[#0A0A0F] dark:via-[#0A0A0F]/70 dark:to-[#0A0A0F]/45" />
          </div>
        ) : (
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-900 dark:to-[#0A0A0F]" />
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/60 to-transparent" />

        <div className="mx-auto w-full max-w-7xl px-4 pb-10 pt-6 sm:px-6 sm:pb-16 sm:pt-10 lg:px-8">
          <Link
            href="/oyunlar"
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white/75 px-3 py-1.5 text-xs font-semibold text-zinc-600 shadow-sm transition hover:border-violet-200 hover:bg-white hover:text-zinc-950 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:border-white/20 dark:hover:bg-white/[0.07] dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Bütün oyunlar
          </Link>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_390px] xl:gap-8">
            <div className="relative overflow-hidden rounded-[28px] border border-zinc-200 bg-white/70 p-4 shadow-[0_28px_90px_-58px_rgba(88,28,135,0.45)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.045] dark:shadow-[0_28px_90px_-52px_rgba(124,58,237,0.75)] sm:p-6 lg:p-7">
              {heroImage && (
                <Image
                  src={heroImage}
                  alt=""
                  fill
                  sizes="(max-width: 1024px) 100vw, 800px"
                  className="object-cover opacity-15 dark:opacity-25"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/82 to-white/58 dark:from-[#0A0A0F]/90 dark:via-[#0A0A0F]/76 dark:to-[#0A0A0F]/42" />
              <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-violet-100/45 to-transparent dark:from-violet-950/30" />

              <div className="relative grid gap-6 md:grid-cols-[210px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)]">
                <div className="max-w-[220px] md:max-w-none">
                  {game.imageUrl ? (
                    <div className="relative overflow-hidden rounded-2xl border border-white bg-zinc-100 shadow-2xl shadow-violet-950/15 ring-1 ring-violet-200 dark:border-white/15 dark:bg-zinc-950 dark:shadow-black/50 dark:ring-violet-300/20">
                      <Image
                        src={game.imageUrl}
                        alt={`${game.title} cover`}
                        width={520}
                        height={520}
                        sizes="(max-width: 768px) 220px, 240px"
                        className="aspect-square w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="grid aspect-square w-full place-items-center rounded-2xl border border-zinc-200 bg-zinc-100 text-zinc-400 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-600">
                      <Gamepad2 className="h-12 w-12" />
                    </div>
                  )}
                </div>

                <div className="flex min-w-0 flex-col justify-center">
                  <div className="flex flex-wrap items-center gap-2">
                    {game.editionLabel && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100/75 px-3 py-1 text-xs font-bold text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
                        <Sparkles className="h-3.5 w-3.5" />
                        {game.editionLabel}
                      </span>
                    )}
                    <span className="rounded-full border border-zinc-200 bg-white/80 px-3 py-1 text-xs font-semibold text-zinc-700 shadow-sm dark:border-white/10 dark:bg-black/35 dark:text-zinc-300">
                      Rəqəmsal aktivasiya
                    </span>
                  </div>

                  <h1 className="mt-4 max-w-4xl text-4xl font-black leading-[0.95] tracking-tight text-zinc-950 dark:text-white sm:text-5xl lg:text-6xl">
                    {game.title}
                  </h1>

                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    {platforms.map((p) => (
                      <span
                        key={p}
                        className="rounded-full border border-zinc-200 bg-white/80 px-3 py-1 text-xs font-bold text-zinc-800 shadow-sm backdrop-blur dark:border-white/20 dark:bg-white/[0.07] dark:text-white"
                      >
                        {p}
                      </span>
                    ))}
                    <span className="rounded-full border border-zinc-200 bg-white/80 px-3 py-1 text-xs font-medium text-zinc-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-300">
                      {PRODUCT_TYPE_LABEL[game.productType] ?? game.productType}
                    </span>
                  </div>

                  <div className="mt-7 grid gap-3 sm:grid-cols-2">
                    {serviceHighlights.map(({ title, text, Icon, iconClass }) => (
                      <div
                        key={title}
                        className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white/78 px-4 py-3 shadow-[0_14px_40px_-34px_rgba(15,23,42,0.55)] backdrop-blur dark:border-white/10 dark:bg-black/25"
                      >
                        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconClass}`} />
                        <div className="min-w-0">
                          <p className="font-semibold text-zinc-950 dark:text-white">{title}</p>
                          <p className="mt-0.5 text-sm leading-snug text-zinc-600 dark:text-zinc-300">{text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Price card */}
            <aside className="relative overflow-hidden rounded-[28px] border border-violet-200 bg-white/86 p-5 shadow-[0_24px_80px_-58px_rgba(124,58,237,0.45)] backdrop-blur-xl dark:border-violet-400/20 dark:bg-zinc-950/90 dark:shadow-[0_24px_80px_-50px_rgba(124,58,237,0.9)] sm:p-6">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-violet-100/90 to-transparent dark:from-violet-600/20" />
              <div className="relative">
                <div className="flex flex-wrap items-center gap-2">
                  {display.discountPct != null ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-3 py-1 text-xs font-black text-white shadow-lg shadow-violet-900/30">
                      <BadgePercent className="h-3.5 w-3.5" />
                      -{display.discountPct}% endirim
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white/75 px-3 py-1 text-xs font-semibold text-zinc-700 shadow-sm dark:border-white/10 dark:bg-white/[0.05] dark:text-zinc-300">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      Aktiv təklif
                    </span>
                  )}
                  {savingsAzn != null && savingsAzn > 0 && (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">
                      {savingsAzn.toFixed(2)}₼ qənaət
                    </span>
                  )}
                </div>

                <div className="mt-6 rounded-2xl border border-zinc-200 bg-white/82 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-white/10 dark:bg-black/30">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-500">
                    Satış qiyməti
                  </p>
                  <div className="mt-2 flex flex-wrap items-end gap-3">
                    {display.originalAzn != null && (
                      <span className="relative mb-1 text-lg font-semibold text-zinc-500 dark:text-zinc-500">
                        {display.originalAzn.toFixed(2)}₼
                        <span
                          aria-hidden
                          className="pointer-events-none absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 -rotate-6 bg-rose-500"
                        />
                      </span>
                    )}
                    <span className="text-5xl font-black leading-none tracking-tight text-zinc-950 dark:text-white">
                      {display.finalAzn.toFixed(2)}₼
                    </span>
                  </div>

                  {discountEndLabel && display.discountPct != null && (
                    <p className="mt-4 inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                      <CalendarClock className="h-4 w-4 text-violet-600 dark:text-violet-300" />
                      Endirim bitir:
                      <span className="font-semibold text-violet-700 dark:text-violet-200">{discountEndLabel}</span>
                    </p>
                  )}
                </div>

                <div className="mt-5">
                  <AddToCartButton
                    game={{
                      id: game.id,
                      title: game.title,
                      imageUrl: game.imageUrl,
                      finalAzn: display.finalAzn,
                      productType: game.productType,
                    }}
                    discounted={display.discountPct != null}
                    discountEndAt={
                      display.discountPct != null && game.discountEndAt
                        ? game.discountEndAt.toISOString()
                        : null
                    }
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
                    className="mt-3 inline-flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-zinc-200 bg-white/75 px-5 text-base font-semibold text-zinc-700 transition hover:border-violet-300 hover:text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-300 dark:hover:border-violet-400/40 dark:hover:text-white"
                  >
                    <ExternalLink className="h-5 w-5" />
                    PS Store-da bax
                  </a>
                )}
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Trailer */}
      {game.trailerUrl && (
        <section className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-200">Treyler</h2>
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-black dark:border-zinc-800">
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
        <section className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-200">
            Ekran görüntüləri
          </h2>
          <ScreenshotGallery screenshots={screenshots} gameTitle={game.title} />
        </section>
      )}

      {/* Similar — surfaced above reviews so users actually see them */}
      {similarCards.length > 0 && (
        <section className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
          <div className="mb-5 flex items-center gap-2">
            <Gamepad2 className="h-5 w-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-200">
              Bunlar da xoşunuza gələ bilər
            </h2>
          </div>
          <ul className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {similarCards.slice(0, 6).map((g) => (
              <GameCard key={g.id} game={g} variant="compact" />
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
