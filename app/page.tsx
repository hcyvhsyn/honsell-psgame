import Link from "next/link";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";
import { serviceProductLabel } from "@/lib/serviceProductLabel";
import {
  LANDING_SERVICE_TYPES,
  LANDING_SERVICE_ORDER,
  isHiddenFromLanding,
  landingServiceRequiresAccount,
} from "@/lib/landingServices";
import ProductImage from "@/components/ProductImage";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import SiteFooter from "@/components/SiteFooter";
import HomeBannerSlider from "@/components/HomeBannerSlider";
import HomeProductMatrix, { type HomeProductMatrixItem } from "@/components/HomeProductMatrix";
import HomeScrollTuning from "@/components/HomeScrollTuning";
import HomeTrustBar from "@/components/HomeTrustBar";
import HomeDiscountCarousel from "@/components/HomeDiscountCarousel";
import HomeTestimonials from "@/components/HomeTestimonials";
import { type GameCardData } from "@/components/GameCard";
import {
  PlatformCard,
  MarqueeHeader,
  HeroMotionOverlay,
} from "@/components/MarketingUI";
import {
  Gamepad2,
  ShieldCheck,
  Zap,
  Clock,
  Sparkles,
  Tv,
  Music,
  Briefcase,
  Brain,
  Layers,
  ArrowRight,
  BadgeCheck,
  Flame,
} from "lucide-react";
import FaqAccordion from "@/components/FaqAccordion";
import HomeReferralCta from "@/components/HomeReferralCta";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";
import {
  STREAMING_SERVICE_META,
  STREAMING_SERVICE_LABELS,
  type StreamingService,
} from "@/lib/streamingCart";
import {
  AI_BRAND_LABELS,
  AI_BRAND_SLUGS,
  PLATFORM_CATEGORY_LABELS,
  readPlatformMeta,
} from "@/lib/platformSubscriptions";

export const revalidate = 1800;

type BestSellerItem = {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  badge: string;
  sales: number;
  finalAzn: number;
  originalAzn: number | null;
  discountPct: number | null;
};

type SalesRow = {
  id: string;
  sales: number | bigint;
};

const HOME_FAQS = [
  {
    id: "home-products",
    question: "Hansı məhsulları ala bilərəm?",
    answer:
      "PlayStation oyunları, PS Plus, gift card, Epic Games, streaming, musiqi, AI və iş platformaları bir yerdədir.",
  },
  {
    id: "home-delivery",
    question: "Sifariş nə qədər vaxta tamamlanır?",
    answer:
      "Avtomatik məhsullar adətən dərhal, hesab və manual aktivləşdirmə tələb edən sifarişlər isə statusla izlənərək tamamlanır.",
  },
  {
    id: "home-payment",
    question: "Ödəniş və balans necə işləyir?",
    answer:
      "Balansını artırıb məhsulu səbətdən ala bilərsən. Uğurlu ödənişdən sonra sifariş profilində görünür.",
  },
  {
    id: "home-support",
    question: "Kömək lazım olsa nə edim?",
    answer:
      "Saytdakı AI bot və dəstək kanalları sifariş, məhsul seçimi və aktivləşdirmə suallarında sənə kömək edir.",
  },
];

const SERVICE_TYPE_BADGES: Record<string, string> = {
  PS_PLUS: "PS Plus",
  EA_PLAY: "EA Play",
  TRY_BALANCE: "Gift Card",
  ACCOUNT_CREATION: "Hesab",
  EPIC_ACCOUNT_CREATION: "Epic",
  STREAMING: "Streaming",
  PLATFORM: "Platforma",
  PUBG_UC: "PUBG UC",
  POINT_BLANK_TG: "Point Blank",
  HONSELL_GIFT_CARD: "Gift Card",
};

// Vahid premium kart səthi — əvvəlki rəngarəng (amber/sky/fuchsia/emerald)
// border-lər "gaming dashboard" hissi yaradırdı. Brend-bənövşəyi neytral səth
// daha təmiz, satış yönümlü görünür və bütün kartlar eyni dildə danışır.
const BEST_SELLER_CARD_SURFACE =
  "border-zinc-200 bg-white hover:border-violet-300/60 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-violet-400/40";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isStreamingService(value: string): value is StreamingService {
  return value in STREAMING_SERVICE_META;
}

function serviceHref(type: string, metadata: unknown, title: string): string {
  const meta = asRecord(metadata);

  switch (type) {
    case "PS_PLUS":
      return "/ps-plus";
    case "EA_PLAY":
      return "/ea-play";
    case "TRY_BALANCE":
      return "/hediyye-kartlari";
    case "ACCOUNT_CREATION":
      return "/hesab-acma";
    case "EPIC_ACCOUNT_CREATION":
      return "/epic-games";
    case "PUBG_UC":
      return "/pubg-uc";
    case "POINT_BLANK_TG":
      return "/point-blank";
    case "HONSELL_GIFT_CARD":
      return "/hediyye-kartlari/honsell";
    case "STREAMING": {
      const service = String(meta?.service ?? "").toUpperCase();
      if (isStreamingService(service)) {
        const svc = STREAMING_SERVICE_META[service];
        return svc.category === "MUSIC" ? `/music/${svc.slug}` : `/streaming/${svc.slug}`;
      }
      return "/streaming";
    }
    case "PLATFORM": {
      const platform = readPlatformMeta(meta);
      if (platform.category === "AI" && platform.aiBrand && platform.aiBrand !== "OTHER") {
        return `/ai/${AI_BRAND_SLUGS[platform.aiBrand]}`;
      }
      if (platform.category === "MUSIC" && platform.musicBrand === "YOUTUBE_PREMIUM") {
        return "/music/youtube";
      }
      // Spotify çoxhesablı paketləri (Individual/Duo/Family) Spotify SEO səhifəsinə.
      if (
        platform.category === "MUSIC" &&
        String(meta?.musicBrand ?? "").toUpperCase() === "SPOTIFY"
      ) {
        return "/music/spotify-premium";
      }
      if (platform.category === "WORK" && title.toLowerCase().includes("linkedin")) {
        return "/work/linkedin-premium";
      }
      if (platform.category === "AI") return "/ai";
      if (platform.category === "WORK") return "/work";
      return "/music";
    }
    default:
      return "/oyunlar";
  }
}

function serviceSubtitle(type: string, metadata: unknown, description: string | null): string {
  if (description?.trim()) return description.trim();
  const meta = asRecord(metadata);

  if (type === "STREAMING") {
    const service = String(meta?.service ?? "").toUpperCase();
    if (isStreamingService(service)) return STREAMING_SERVICE_META[service].tagline;
    return "Film, serial və izləmə platformaları";
  }

  if (type === "PLATFORM") {
    const platform = readPlatformMeta(meta);
    if (platform.category === "AI" && platform.aiBrand) {
      return `${AI_BRAND_LABELS[platform.aiBrand]} abunəlikləri və premium paketlər`;
    }
    return PLATFORM_CATEGORY_LABELS[platform.category];
  }

  if (type === "TRY_BALANCE") return "Türkiyə PSN balans kartları";
  if (type === "ACCOUNT_CREATION") return "Türkiyə PSN hesabının hazırlanması";
  if (type === "EA_PLAY") return "EA oyun kolleksiyası və abunəlik";
  if (type === "PUBG_UC") return "PUBG Mobile üçün UC paketləri";
  if (type === "POINT_BLANK_TG") return "Point Blank üçün TG paketləri";
  return "Rəqəmsal məhsul";
}

function serviceBadge(type: string, metadata: unknown): string {
  const meta = asRecord(metadata);
  if (type === "STREAMING") {
    const service = String(meta?.service ?? "").toUpperCase();
    return service ? STREAMING_SERVICE_LABELS[service] ?? "Streaming" : "Streaming";
  }
  if (type === "PLATFORM") {
    const platform = readPlatformMeta(meta);
    if (platform.category === "AI" && platform.aiBrand) return AI_BRAND_LABELS[platform.aiBrand];
    return PLATFORM_CATEGORY_LABELS[platform.category].replace(" Platformaları", "");
  }
  return SERVICE_TYPE_BADGES[type] ?? "Məhsul";
}

async function fetchBestSellers(settings: Awaited<ReturnType<typeof getSettings>>): Promise<BestSellerItem[]> {
  const [gameSalesRows, serviceSalesRows] = await Promise.all([
    prisma.$queryRaw<SalesRow[]>`
      SELECT "gameId" AS "id", COUNT(*)::int AS "sales"
      FROM "Transaction"
      WHERE "type" = 'PURCHASE'
        AND "status" = 'SUCCESS'
        AND "gameId" IS NOT NULL
      GROUP BY "gameId"
      ORDER BY "sales" DESC
      LIMIT 8
    `.catch(() => []),
    prisma.$queryRaw<SalesRow[]>`
      SELECT "serviceProductId" AS "id", COUNT(*)::int AS "sales"
      FROM "Transaction"
      WHERE "type" = 'SERVICE_PURCHASE'
        AND "status" = 'SUCCESS'
        AND "serviceProductId" IS NOT NULL
      GROUP BY "serviceProductId"
      ORDER BY "sales" DESC
      LIMIT 8
    `.catch(() => []),
  ]);

  const [games, services] = await Promise.all([
    gameSalesRows.length
      ? prisma.game.findMany({
          where: { id: { in: gameSalesRows.map((row) => row.id) }, isActive: true },
          select: {
            id: true,
            productId: true,
            title: true,
            imageUrl: true,
            platform: true,
            productType: true,
            store: true,
            priceTryCents: true,
            discountTryCents: true,
            discountEndAt: true,
            priceUsdCents: true,
            discountUsdCents: true,
          },
        })
      : Promise.resolve([]),
    serviceSalesRows.length
      ? prisma.serviceProduct.findMany({
          where: { id: { in: serviceSalesRows.map((row) => row.id) }, isActive: true },
          select: {
            id: true,
            type: true,
            title: true,
            description: true,
            imageUrl: true,
            priceAznCents: true,
            metadata: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const gameById = new Map(games.map((game) => [game.id, game]));
  const serviceById = new Map(services.map((service) => [service.id, service]));
  const items: BestSellerItem[] = [];

  for (const row of gameSalesRows) {
    const game = gameById.get(row.id);
    if (!game) continue;
    const price = computeDisplayPrice(game, settings);
    items.push({
      id: `game-${game.id}`,
      href: `/oyunlar/${game.productId}`,
      title: game.title,
      subtitle: game.store === "EPIC" ? "Epic Games · PC" : `${game.platform ?? "PlayStation"} oyunu`,
      imageUrl: game.imageUrl,
      badge: game.store === "EPIC" ? "PC" : "Oyun",
      sales: Number(row.sales),
      finalAzn: price.finalAzn,
      originalAzn: price.originalAzn,
      discountPct: price.discountPct,
    });
  }

  for (const row of serviceSalesRows) {
    const service = serviceById.get(row.id);
    if (!service) continue;
    items.push({
      id: `service-${service.id}`,
      href: serviceHref(service.type, service.metadata, service.title),
      title: service.title,
      subtitle: serviceSubtitle(service.type, service.metadata, service.description),
      imageUrl: service.imageUrl,
      badge: serviceBadge(service.type, service.metadata),
      sales: Number(row.sales),
      finalAzn: service.priceAznCents / 100,
      originalAzn: null,
      discountPct: null,
    });
  }

  const ranked = items
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 8);

  if (ranked.length >= 6) return ranked;

  const [fallbackGames, fallbackServices] = await Promise.all([
    prisma.game.findMany({
      where: { isActive: true, isFeatured: true },
      orderBy: [{ lastScrapedAt: "desc" }, { createdAt: "desc" }],
      take: 8,
      select: {
        id: true,
        productId: true,
        title: true,
        imageUrl: true,
        platform: true,
        store: true,
        priceTryCents: true,
        discountTryCents: true,
        discountEndAt: true,
        priceUsdCents: true,
        discountUsdCents: true,
      },
    }),
    prisma.serviceProduct.findMany({
      where: {
        isActive: true,
        type: { in: ["PS_PLUS", "TRY_BALANCE", "STREAMING", "PLATFORM", "EA_PLAY", "PUBG_UC"] },
      },
      orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
      take: 8,
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        imageUrl: true,
        priceAznCents: true,
        metadata: true,
      },
    }),
  ]);

  const seen = new Set(ranked.map((item) => item.id));
  for (const game of fallbackGames) {
    const id = `game-${game.id}`;
    if (seen.has(id)) continue;
    const price = computeDisplayPrice(game, settings);
    ranked.push({
      id,
      href: `/oyunlar/${game.productId}`,
      title: game.title,
      subtitle: game.store === "EPIC" ? "Epic Games · PC" : `${game.platform ?? "PlayStation"} oyunu`,
      imageUrl: game.imageUrl,
      badge: game.store === "EPIC" ? "PC" : "Oyun",
      sales: 0,
      finalAzn: price.finalAzn,
      originalAzn: price.originalAzn,
      discountPct: price.discountPct,
    });
    seen.add(id);
    if (ranked.length >= 8) break;
  }

  for (const service of fallbackServices) {
    const id = `service-${service.id}`;
    if (seen.has(id)) continue;
    ranked.push({
      id,
      href: serviceHref(service.type, service.metadata, service.title),
      title: service.title,
      subtitle: serviceSubtitle(service.type, service.metadata, service.description),
      imageUrl: service.imageUrl,
      badge: serviceBadge(service.type, service.metadata),
      sales: 0,
      finalAzn: service.priceAznCents / 100,
      originalAzn: null,
      discountPct: null,
    });
    seen.add(id);
    if (ranked.length >= 8) break;
  }

  return ranked;
}

async function fetchLandingProducts(): Promise<HomeProductMatrixItem[]> {
  const services = await prisma.serviceProduct.findMany({
    where: {
      isActive: true,
      type: { in: [...LANDING_SERVICE_TYPES] },
    },
    orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }, { title: "asc" }],
    select: {
      id: true,
      type: true,
      title: true,
      description: true,
      imageUrl: true,
      priceAznCents: true,
      metadata: true,
      sortOrder: true,
    },
  });

  return services
    .filter((service) => !isHiddenFromLanding(service.metadata))
    .sort((a, b) => {
      const orderA = LANDING_SERVICE_ORDER.get(a.type) ?? 999;
      const orderB = LANDING_SERVICE_ORDER.get(b.type) ?? 999;
      return orderA - orderB || a.sortOrder - b.sortOrder || a.priceAznCents - b.priceAznCents;
    })
    .map((service) => ({
      id: service.id,
      title: service.title,
      subtitle: serviceSubtitle(service.type, service.metadata, service.description),
      href: serviceHref(service.type, service.metadata, service.title),
      imageUrl: service.imageUrl,
      finalAzn: service.priceAznCents / 100,
      productType: service.type,
      badge: serviceBadge(service.type, service.metadata),
      requiresAccount: landingServiceRequiresAccount(service.type, service.metadata),
    }));
}

async function fetchDiscountedGames(
  settings: Awaited<ReturnType<typeof getSettings>>,
): Promise<{ cards: GameCardData[]; maxDiscount: number }> {
  const now = new Date();
  const games = await prisma.game
    .findMany({
      where: {
        isActive: true,
        discountTryCents: { not: null },
        OR: [{ discountEndAt: null }, { discountEndAt: { gt: now } }],
      },
      orderBy: { lastScrapedAt: "desc" },
      take: 60,
      select: {
        id: true,
        productId: true,
        title: true,
        imageUrl: true,
        platform: true,
        productType: true,
        store: true,
        priceTryCents: true,
        discountTryCents: true,
        discountEndAt: true,
        priceUsdCents: true,
        discountUsdCents: true,
      },
    })
    .catch(() => []);

  const enriched = games
    .map((game) => ({ game, price: computeDisplayPrice(game, settings) }))
    .filter((row) => row.price.discountPct != null && row.price.discountPct > 0)
    .sort((a, b) => (b.price.discountPct ?? 0) - (a.price.discountPct ?? 0));

  const cards: GameCardData[] = enriched.slice(0, 12).map(({ game, price }) => ({
    id: game.id,
    productId: game.productId,
    title: game.title,
    imageUrl: game.imageUrl,
    platform: game.platform,
    productType: game.productType,
    store: game.store,
    finalAzn: price.finalAzn,
    originalAzn: price.originalAzn,
    discountPct: price.discountPct,
    discountEndAt:
      game.discountTryCents != null && game.discountEndAt
        ? game.discountEndAt.toISOString()
        : null,
  }));

  return { cards, maxDiscount: enriched[0]?.price.discountPct ?? 0 };
}

/**
 * Ana səhifənin user-ə aid OLMAYAN bütün datası + view-model hesablaması burada
 * `unstable_cache` ilə 30 dəqiqəlik keşdə saxlanır. Səhifə header-dəki `cookies()`
 * səbəbindən dinamik render olunsa belə (revalidate tək başına bunu keşləmir),
 * bu funksiya keşdən gəlir → əksər açılışda ~13 Mumbai sorğusu yerinə 0 sorğu.
 * Qaytarılan hər şey plain/serializable-dır (Date-lər ISO string-ə çevrilib).
 */
const getHomePageData = unstable_cache(
  async () => {
  const settings = await getSettings();
  const [banners, landingProducts, bestSellers, totalsArr, streamingProducts, psPlusProducts, giftCardProducts, discounted, orderCount, testimonialAgg] = await Promise.all([
    prisma.banner
      .findMany({
        where: { isActive: true, scope: "HOME" },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        include: { game: true, serviceProduct: true },
      })
      .catch(() => []),
    fetchLandingProducts(),
    fetchBestSellers(settings),
    prisma.game.groupBy({ by: ["productType"], where: { isActive: true }, _count: { _all: true } }),
    prisma.serviceProduct.findMany({
      where: { isActive: true, type: "STREAMING" },
      orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
    }),
    prisma.serviceProduct.findMany({
      where: { isActive: true, type: "PS_PLUS" },
      orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
      take: 1,
    }),
    prisma.serviceProduct.findMany({
      where: { isActive: true, type: "TRY_BALANCE" },
      orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
      take: 1,
    }),
    fetchDiscountedGames(settings),
    prisma.transaction
      .count({ where: { status: "SUCCESS", type: { in: ["PURCHASE", "SERVICE_PURCHASE"] } } })
      .catch(() => 0),
    prisma.testimonial
      .aggregate({ where: { isActive: true }, _avg: { rating: true }, _count: { _all: true } })
      .catch(() => null),
  ]);

  const totalsAll = totalsArr.reduce((sum, row) => sum + row._count._all, 0);
  const trustStats = {
    orders: orderCount,
    games: totalsAll,
    avgRating: testimonialAgg?._avg.rating ?? null,
    reviewCount: testimonialAgg?._count._all ?? 0,
  };

  const totals: Record<string, number> = { GAME: 0, ADDON: 0, CURRENCY: 0, OTHER: 0 };
  for (const row of totalsArr) totals[row.productType] = row._count._all;

  // Streaming-də ən populyar/ucuz xidmət şəklini götürmək üçün lookup
  const streamingPosters = new Map<string, string | null>();
  for (const p of streamingProducts) {
    const meta = (p.metadata as { service?: string } | null) ?? null;
    const service = (meta?.service ?? "").toUpperCase();
    if (service && !streamingPosters.has(service) && p.imageUrl) {
      streamingPosters.set(service, p.imageUrl);
    }
  }
  const netflixImage = streamingPosters.get("NETFLIX") ?? null;
  const youtubeImage = streamingPosters.get("YOUTUBE_PREMIUM") ?? null;

  const bannerSlides = banners
    .map((b) => {
      const price = b.game ? computeDisplayPrice(b.game, settings) : null;
      // Xidmət/məhsul banneri (streaming, platform, PS Plus...) — qiymət AZN
      // qəpiklə saxlanır; endirim metadata.originalPriceAznCents-dən hesablanır.
      let service = null;
      const svc = b.serviceProduct;
      if (svc) {
        const meta = (svc.metadata as Record<string, unknown> | null) ?? {};
        const origCents =
          typeof meta.originalPriceAznCents === "number" && meta.originalPriceAznCents > svc.priceAznCents
            ? meta.originalPriceAznCents
            : null;
        service = {
          id: svc.id,
          title: serviceProductLabel(svc.title, svc.metadata),
          imageUrl: svc.imageUrl,
          productType: svc.type,
          finalAzn: svc.priceAznCents / 100,
          originalAzn: origCents != null ? origCents / 100 : null,
          discountPct: origCents != null ? Math.round((1 - svc.priceAznCents / origCents) * 100) : null,
        };
      }
      return {
        id: b.id,
        title: b.title,
        subtitle: b.subtitle,
        imageUrl: b.imageUrl || b.game?.heroImageUrl || b.game?.imageUrl || svc?.imageUrl || "",
        mobileImageUrl: b.mobileImageUrl ?? null,
        linkUrl: b.linkUrl,
        actionType: (b.actionType === "ADD_TO_CART" ? "ADD_TO_CART" : "LINK") as "LINK" | "ADD_TO_CART",
        game:
          b.game && price
            ? {
                id: b.game.id,
                productId: b.game.productId,
                title: b.game.title,
                imageUrl: b.game.imageUrl,
                heroImageUrl: b.game.heroImageUrl,
                platform: b.game.platform,
                productType: b.game.productType,
                finalAzn: price.finalAzn,
                originalAzn: price.originalAzn,
                discountPct: price.discountPct,
                discountEndAt: b.game.discountTryCents != null && b.game.discountEndAt ? b.game.discountEndAt.toISOString() : null,
              }
            : null,
        service,
        contentPosition: b.contentPosition,
        contentPositionMobile: b.contentPositionMobile,
        contentTheme: b.contentTheme,
      };
    })
    .filter((b) => b.imageUrl);

  const psPlusImage = psPlusProducts[0]?.imageUrl ?? null;
  const giftCardImage = giftCardProducts[0]?.imageUrl ?? null;

  return {
    bannerSlides,
    trustStats,
    landingProducts,
    discounted,
    bestSellers,
    totals,
    netflixImage,
    youtubeImage,
    psPlusImage,
    giftCardImage,
  };
  },
  ["home-page-data"],
  { revalidate: 1800, tags: ["home"] },
);

export default async function HomePage() {
  const {
    bannerSlides,
    trustStats,
    landingProducts,
    discounted,
    bestSellers,
    totals,
    netflixImage,
    youtubeImage,
    psPlusImage,
    giftCardImage,
  } = await getHomePageData();

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    inLanguage: "az-AZ",
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/oyunlar?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/icon.png`,
    email: "info@honsell.store",
    telephone: "+994702560509",
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+994702560509",
      contactType: "customer support",
      email: "info@honsell.store",
      areaServed: "AZ",
      availableLanguage: ["az", "tr", "en"],
    },
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: HOME_FAQS.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}
      <SiteHeaderServer />
      <HomeScrollTuning />

      <h1 className="sr-only">{SITE_NAME} — {SITE_DESCRIPTION}</h1>

      {/* Hero banner (HOME scope) */}
      <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        {bannerSlides.length > 0 ? (
          <HomeBannerSlider banners={bannerSlides} />
        ) : (
          <div className="relative overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800/60">
            <div className="relative aspect-[4/5] bg-gradient-to-br from-violet-50 via-white to-zinc-100 dark:from-indigo-950 dark:via-zinc-900 dark:to-zinc-950 sm:aspect-[16/8] lg:aspect-[16/9]">
              <div className="pointer-events-none absolute -left-20 top-0 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />
              <div className="pointer-events-none absolute right-0 bottom-0 h-64 w-64 rounded-full bg-fuchsia-700/20 blur-3xl" />
              <div className="relative flex h-full flex-col items-start justify-center px-8 sm:px-14">
                <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-400/40 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500 dark:bg-indigo-400" />
                  Yeni rəqəmsal mağaza təcrübəsi
                </span>
                <p className="text-3xl font-black tracking-tight text-zinc-950 dark:text-white sm:text-5xl">
                  Oyun, film, musiqi və digər
                  <br />
                  rəqəmsal məhsullar bir yerdə
                </p>
              </div>
            </div>
            <HeroMotionOverlay />
          </div>
        )}
      </section>

      <HomeTrustBar {...trustStats} />

      <HomeProductMatrix products={landingProducts} />

      <HomeDiscountCarousel games={discounted.cards} maxDiscount={discounted.maxDiscount} />

      <BestSellersSection items={bestSellers} />

      {/* Top-level platform navigator */}
      <section id="platformalar" className="py-12 sm:py-16">
        <MarqueeHeader text="PLATFORMALAR" />
        <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <PlatformCard
              href="/playstation"
              icon={<Gamepad2 className="h-5 w-5 text-white" />}
              label="PlayStation"
              sub={`${totals.GAME.toLocaleString("az-AZ")}+ oyun · PS Plus · Hədiyyə kartları · Hesab açma`}
              imageUrl={bannerSlides[0]?.imageUrl ?? psPlusImage ?? giftCardImage ?? null}
              accentClass="border-indigo-400/30 from-indigo-400/25 to-fuchsia-400/15"
            />
            <PlatformCard
              href="/streaming"
              icon={<Tv className="h-5 w-5 text-white" />}
              label="Yayım Platformaları"
              sub="Netflix · HBO Max · Gain — Azərbaycan yayımları və icmallar"
              imageUrl={netflixImage}
              accentClass="border-rose-400/30 from-rose-400/25 to-orange-400/15"
            />
            <PlatformCard
              href="/music"
              icon={<Music className="h-5 w-5 text-white" />}
              label="Musiqi Platformaları"
              sub="YouTube Premium — reklamsız + YouTube Music"
              imageUrl={youtubeImage}
              accentClass="border-amber-400/30 from-amber-400/25 to-yellow-300/15"
            />
            <PlatformCard
              href="/work"
              icon={<Briefcase className="h-5 w-5 text-white" />}
              label="İş Platformaları"
              sub="LinkedIn Premium · Notion · Figma və digər iş alətləri"
              accentClass="border-emerald-400/30 from-emerald-400/25 to-teal-400/15"
            />
            <PlatformCard
              href="/ai"
              icon={<Brain className="h-5 w-5 text-white" />}
              label="Süni İntellekt"
              sub="ChatGPT Plus · Claude Plus və digər AI alətləri"
              accentClass="border-violet-400/30 from-violet-400/25 to-purple-400/15"
            />
            <PlatformCard
              href="/diger"
              icon={<Layers className="h-5 w-5 text-white" />}
              label="Digər"
              sub="Bələdçilər, qazan və digər xidmətlər"
              accentClass="border-zinc-400/30 from-zinc-400/25 to-zinc-500/10"
            />
          </div>
        </div>
      </section>

      {/* Niyə biz */}
      <section id="niye-biz" className="py-12 sm:py-16">
        <MarqueeHeader text="NİYƏ BİZ" />
        <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {[
              { icon: <Zap className="h-6 w-6 !text-white" />, title: "Anında çatdırılma", desc: "Gift card və bir çox sifarişdə nəticə saniyələr içində." },
              { icon: <ShieldCheck className="h-6 w-6 !text-white" />, title: "Etibarlı sistem", desc: "Şəffaf proses, manual yoxlama və təhlükəsiz ödəniş mərhələləri." },
              { icon: <Clock className="h-6 w-6 !text-white" />, title: "Sürətli dəstək", desc: "Sifariş statusu üzrə operativ admin müdaxiləsi və cavablar." },
              { icon: <Sparkles className="h-6 w-6 !text-white" />, title: "Premium təcrübə", desc: "Sadə interfeys, aydın yol və fərqli xidmətlər üçün xüsusi flow." },
            ].map((f) => (
              <div key={f.title} className="relative mt-6 rounded-[24px] bg-white dark:bg-[#150A21] p-6 pt-10 shadow-xl dark:shadow-2xl ring-1 ring-zinc-200 dark:ring-0 transition hover:-translate-y-1">
                <div className="absolute -top-8 left-6 grid h-16 w-16 place-items-center overflow-hidden rounded-full border-4 border-zinc-50 dark:border-[#0A0A0F] bg-violet-600 dark:bg-[#150A21]">
                  {f.icon}
                </div>
                <h3 className="mt-2 text-lg font-bold text-zinc-900 dark:text-white">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-[#9CA3AF]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Müştəri rəyləri (sosial sübut) */}
      <HomeTestimonials />

      {/* General FAQ */}
      <section className="py-12 sm:py-14">
        <MarqueeHeader text="TEZ VERİLƏN SUALLAR" />
        <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6">
          <FaqAccordion items={HOME_FAQS} />
          <div className="mt-8 flex justify-center">
            <Link
              href="/faq"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-bold text-zinc-950 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50 dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:hover:bg-white/[0.1]"
            >
              Bütün suallara bax
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Referral CTA */}
      <HomeReferralCta />

      <SiteFooter />
    </main>
  );
}

function BestSellersSection({ items }: { items: BestSellerItem[] }) {
  if (items.length === 0) return null;

  return (
    <section id="cox-satanlar" className="border-y border-zinc-200 bg-white py-14 dark:border-white/10 dark:bg-[#07070C] sm:py-16">
      <MarqueeHeader text="ÇOX SATANLAR" />
      <div className="mx-auto max-w-7xl px-4 pt-7 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-100 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-amber-800 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-200">
              <Flame className="h-3.5 w-3.5" />
              Müştəri seçimi
            </div>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-zinc-950 dark:text-white sm:text-4xl">
              Bu həftə ən çox alınanlar
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Oyunlar, abunəliklər və rəqəmsal xidmətlər içində ən çox seçilən məhsullar.
            </p>
          </div>
          <Link
            href="/oyunlar"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-300 bg-zinc-950 px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-zinc-800 dark:border-white/10 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Bütün məhsullar
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 sm:gap-4 lg:grid-cols-4">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={`group flex min-h-[270px] min-w-0 flex-col overflow-hidden rounded-[22px] border p-2.5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-900/10 dark:hover:shadow-black/40 sm:min-h-[320px] sm:p-3 ${BEST_SELLER_CARD_SURFACE}`}
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[18px] bg-gradient-to-br from-zinc-100 to-zinc-200/60 dark:from-zinc-900 dark:to-zinc-950">
                <ProductImage
                  src={item.imageUrl}
                  alt={item.title}
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-contain p-3 transition duration-500 group-hover:scale-[1.04]"
                  badge={item.badge}
                />
                <div className="absolute left-2 top-2 rounded-full border border-white/60 bg-white/90 px-2 py-1 text-[10px] font-black text-zinc-900 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-950/85 dark:text-zinc-100 sm:left-3 sm:top-3 sm:px-2.5">
                  {item.badge}
                </div>
                {item.discountPct != null && (
                  <div className="absolute right-2 top-2 rounded-full bg-rose-500 px-2 py-1 text-[10px] font-black text-white shadow-sm sm:right-3 sm:top-3">
                    -{item.discountPct}%
                  </div>
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col px-1 pb-1 pt-3">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-violet-700 dark:text-violet-300">
                  <BadgeCheck className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{item.sales > 0 ? `${item.sales} satış` : "Seçilən"}</span>
                </div>
                <h3 className="mt-2 line-clamp-2 text-sm font-black leading-tight text-zinc-950 dark:text-white sm:text-base">
                  {item.title}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-600 dark:text-zinc-400 sm:text-sm">
                  {item.subtitle}
                </p>
                <div className="mt-auto flex items-end justify-between gap-2 pt-4">
                  <div>
                    {item.originalAzn != null && (
                      <div className="text-xs font-semibold text-zinc-500 line-through dark:text-zinc-500">
                        {item.originalAzn.toFixed(2)}₼
                      </div>
                    )}
                    <div className="text-lg font-black tracking-tight text-zinc-950 dark:text-white sm:text-2xl">
                      {item.finalAzn.toFixed(2)}₼
                    </div>
                  </div>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-zinc-950 text-white transition group-hover:translate-x-0.5 dark:bg-white dark:text-zinc-950">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
