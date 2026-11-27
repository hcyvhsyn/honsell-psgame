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
import SiteHeaderServer from "@/components/SiteHeaderServer";
import SiteFooter from "@/components/SiteFooter";
import HomeBannerSlider from "@/components/HomeBannerSlider";
import HomeProductMatrix, { type HomeProductMatrixItem } from "@/components/HomeProductMatrix";
import HomeScrollTuning from "@/components/HomeScrollTuning";
import ScrollAnimationManager from "@/components/ScrollAnimationManager";
import HomeTrustBar from "@/components/HomeTrustBar";
import HomeFlashDeals, { type FlashDealCard } from "@/components/HomeFlashDeals";
import HomeServiceBundles from "@/components/HomeServiceBundles";
import { loadActiveServiceBundles } from "@/lib/serviceBundles";
import HomeTestimonials from "@/components/HomeTestimonials";
import HomeSubscriptionShowcase from "@/components/HomeSubscriptionShowcase";
import {
  buildHomeSubscriptionShowcase,
  isShowcaseSpotifyProduct,
  type ShowcaseBrand,
} from "@/lib/homeSubscriptionShowcase";
import { HeroMotionOverlay } from "@/components/MarketingUI";
import { ArrowRight } from "lucide-react";
import FaqAccordion from "@/components/FaqAccordion";
import GameCard from "@/components/GameCard";
import type { GameCardData } from "@/lib/gameCardShared";
import { buildGameCard, GAME_CARD_COLUMNS_SQL, type GameCardRow } from "@/lib/gameCardMapper";
import type { GameCustomPricing } from "@/lib/gameMargin";
import { POPULARITY_JOINS_SQL, POPULARITY_ORDER_BY_SQL } from "@/lib/popularity";
import { Prisma as PrismaSql } from "@/lib/generated/prisma/client";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";
import {
  STREAMING_SERVICE_META,
  STREAMING_SERVICE_LABELS,
  type StreamingService,
} from "@/lib/streamingCart";
import {
  PLATFORM_CATEGORY_LABELS,
  readPlatformMeta,
} from "@/lib/platformSubscriptions";
import { gameDetailHref } from "@/lib/gameSlug";
import { displayGameTitle } from "@/lib/gameTitle";
import { applyFlashDeal, effectiveFlashDealEnd } from "@/lib/flashDeals";
import {
  NETFLIX_STORE_PATH,
  PLAYSTATION_ONLY,
  isNetflixProduct,
  isOpenStorePath,
  isSellableGameStore,
  isSellableServiceProduct,
  isSpotifyMusicBrand,
  isStoreSellableStreaming,
  sellableGameWhere,
  sellableServiceWhere,
} from "@/lib/storeScope";
import { getPublicStreamingSlug } from "@/lib/streamingPlatforms";
import { NETFLIX_GROUP_CODE } from "@/lib/streamingAccess";

export const revalidate = 1800;

const HOME_FAQS = [
  {
    id: "home-products",
    question: "Hansı məhsulları ala bilərəm?",
    answer:
      PLAYSTATION_ONLY
        ? "PlayStation oyunları, PS Plus, EA Play, Türkiyə PSN gift card-ları, TR PSN hesabının açılması, Spotify Premium və Netflix abunəlikləri."
        : "PlayStation oyunları, PS Plus, gift card, streaming, musiqi və iş platformaları bir yerdədir.",
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

/** "Populyar oyunlar" başlığının altındakı sürətli keçidlər (yalnız satılan bölmələr). */
const GAME_QUICK_LINKS = [
  { href: "/endirimler", label: "Endirimlər" },
  { href: "/ps5-oyunlari", label: "PS5 oyunları" },
  { href: "/ps4-oyunlari", label: "PS4 oyunları" },
  { href: "/ucuz-oyunlar", label: "Ucuz oyunlar" },
  { href: "/hediyye-kartlari", label: "PSN hədiyyə kartları" },
  { href: "/hesab-acma", label: "TR PSN hesabı" },
];

const SERVICE_TYPE_BADGES: Record<string, string> = {
  PS_PLUS: "PS Plus",
  EA_PLAY: "EA Play",
  TRY_BALANCE: "Gift Card",
  ACCOUNT_CREATION: "Hesab",
  STREAMING: "Streaming",
  PLATFORM: "Platforma",
  PUBG_UC: "PUBG UC",
  POINT_BLANK_TG: "Point Blank",
  HONSELL_GIFT_CARD: "Gift Card",
};

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
    case "PUBG_UC":
      return "/pubg-uc";
    case "POINT_BLANK_TG":
      return "/point-blank";
    case "HONSELL_GIFT_CARD":
      return "/hediyye-kartlari/honsell";
    case "STREAMING": {
      if (isNetflixProduct(type, meta)) return NETFLIX_STORE_PATH;
      const service = String(meta?.service ?? "").toUpperCase();
      if (isStreamingService(service)) {
        const svc = STREAMING_SERVICE_META[service];
        return svc.category === "MUSIC" ? `/music/${svc.slug}` : `/streaming/${svc.slug}`;
      }
      return "/streaming";
    }
    case "PLATFORM": {
      const platform = readPlatformMeta(meta);
      if (platform.category === "MUSIC" && platform.musicBrand === "YOUTUBE_PREMIUM") {
        return "/music/youtube";
      }
      // Spotify çoxhesablı paketləri (Individual/Duo/Family) Spotify SEO səhifəsinə.
      if (
        platform.category === "MUSIC" &&
        isSpotifyMusicBrand(meta?.musicBrand)
      ) {
        return "/music/spotify-premium";
      }
      if (platform.category === "WORK" && title.toLowerCase().includes("linkedin")) {
        return "/work/linkedin-premium";
      }
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
    return PLATFORM_CATEGORY_LABELS[platform.category];
  }

  if (type === "TRY_BALANCE") return "Türkiyə PSN balans kartları";
  if (type === "ACCOUNT_CREATION") return "Türkiyə PSN hesabının hazırlanması";
  if (type === "EA_PLAY") return "EA oyun kolleksiyası və abunəlik";
  if (type === "PUBG_UC") return "PUBG Mobile üçün UC paketləri";
  if (type === "POINT_BLANK_TG") return "Point Blank üçün TG paketləri";
  // "Rəqəmsal məhsul" kimi heç nə deməyən doldurucu əvəzinə faydalı qeyd və ya boş.
  if (type === "PS_PLUS") return "Türkiyə PSN hesabına aktivləşir";
  return "";
}

function serviceBadge(type: string, metadata: unknown): string {
  const meta = asRecord(metadata);
  if (type === "STREAMING") {
    const service = String(meta?.service ?? "").toUpperCase();
    return service ? STREAMING_SERVICE_LABELS[service] ?? "Streaming" : "Streaming";
  }
  if (type === "PLATFORM") {
    const platform = readPlatformMeta(meta);
    return PLATFORM_CATEGORY_LABELS[platform.category].replace(" Platformaları", "");
  }
  return SERVICE_TYPE_BADGES[type] ?? "Məhsul";
}

async function fetchLandingProducts(): Promise<{
  products: HomeProductMatrixItem[];
  showcase: ShowcaseBrand[];
}> {
  const services = await prisma.serviceProduct.findMany({
    where: {
      isActive: true,
      type: { in: [...LANDING_SERVICE_TYPES] },
      ...sellableServiceWhere(),
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

  // Netflix və Spotify plan paketləri matrisdə deyil, öz vitrinlərindədir (hər plan × müddət
  // ayrıca kart, `HomeSubscriptionShowcase`). Admin-dən satışa açılan streaming xidmətləri
  // (HBO Max və s.) matrisdə tək "ayda X ₼-dan" kartıdır.
  // ⚠️ Vitrinə `hideFromLanding` süzgəci TƏTBİQ ETMƏ — o, matrisin bayrağıdır (lib/homeSubscriptionShowcase.ts).
  const netflixPlatform = await prisma.streamingPlatform
    .findUnique({ where: { code: NETFLIX_GROUP_CODE }, select: { guideVideoUrl: true } })
    .catch(() => null);
  const showcase = buildHomeSubscriptionShowcase(services, {
    netflix: { guideVideoUrl: netflixPlatform?.guideVideoUrl ?? null },
  });
  const streamingCards = await buildStreamingGroupCards(services);

  const cards = services
    .filter((service) => !isNetflixProduct(service.type, service.metadata))
    .filter((service) => !isShowcaseSpotifyProduct(service.type, service.metadata))
    .filter((service) => !isStoreSellableStreaming(service.type, service.metadata))
    .filter((service) => !isHiddenFromLanding(service.metadata))
    .sort((a, b) => {
      const orderA = LANDING_SERVICE_ORDER.get(a.type) ?? 999;
      const orderB = LANDING_SERVICE_ORDER.get(b.type) ?? 999;
      return orderA - orderB || a.sortOrder - b.sortOrder || a.priceAznCents - b.priceAznCents;
    })
    // Ana səhifə HTML-ini yüngül saxlamaq üçün maks. 12 kart server-render olunur
    // (əvvəl bütün aktiv landing məhsulları gəlirdi → onlarla kart, böyük HTML).
    // Tam siyahı kateqoriya səhifələrindədir.
    .slice(0, Math.max(0, 12 - streamingCards.length))
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

  return { products: [...cards, ...streamingCards], showcase };
}

/**
 * Admin-dən satışa açılan hər streaming xidməti üçün tək "ayda X ₼-dan" kartı. Qruplaşma
 * `metadata.groupCode` (plan → üst xidmət) ilədir; rejimsiz köhnə paket öz `service`-i ilə qruplaşır.
 */
async function buildStreamingGroupCards(
  services: Array<{ type: string; priceAznCents: number; imageUrl: string | null; metadata: unknown }>,
): Promise<HomeProductMatrixItem[]> {
  const best = new Map<string, { perMonthCents: number; imageUrl: string | null }>();
  for (const service of services) {
    if (!isStoreSellableStreaming(service.type, service.metadata)) continue;
    if (isNetflixProduct(service.type, service.metadata)) continue;
    const meta = asRecord(service.metadata);
    const key = String(meta?.groupCode ?? meta?.service ?? "").toUpperCase();
    const months = Number(meta?.durationMonths);
    if (!key || !Number.isFinite(months) || months <= 0) continue;
    const perMonthCents = service.priceAznCents / months;
    const image =
      typeof meta?.platformImageUrl === "string" && meta.platformImageUrl ? meta.platformImageUrl : service.imageUrl;
    const current = best.get(key);
    best.set(key, {
      perMonthCents: Math.min(perMonthCents, current?.perMonthCents ?? Infinity),
      imageUrl: current?.imageUrl ?? image ?? null,
    });
  }
  if (best.size === 0) return [];
  const platforms = await prisma.streamingPlatform
    .findMany({
      where: { code: { in: Array.from(best.keys()) }, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { code: true, slug: true, label: true, heroImageUrl: true },
    })
    .catch(() => []);
  return platforms.map((p) => {
    const b = best.get(p.code.toUpperCase())!;
    return {
      id: `streaming-${p.code.toLowerCase()}`,
      title: p.label,
      subtitle: "Aylıq başlanğıc qiymət",
      href: `/streaming/${getPublicStreamingSlug(p.slug)}`,
      imageUrl: p.heroImageUrl || b.imageUrl,
      finalAzn: Math.round(b.perMonthCents) / 100,
      productType: "STREAMING",
      badge: p.label,
      requiresAccount: true,
    };
  });
}

/**
 * "Fürsətləri qaçırma" — `/admin/flash-deals`-dən əl ilə seçilmiş oyunlar.
 * Qiymət/köhnə qiymət override-ı `applyFlashDeal` ilə tətbiq olunur ki, vitrin
 * checkout-la eyni rəqəmi göstərsin.
 */
async function fetchFlashDeals(
  settings: Awaited<ReturnType<typeof getSettings>>,
): Promise<FlashDealCard[]> {
  const now = new Date();
  const deals = await prisma.flashDeal
    .findMany({
      where: {
        isActive: true,
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        game: { isActive: true, ...sellableGameWhere() },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 12,
      include: {
        game: {
          select: {
            id: true,
            productId: true,
            slug: true,
            title: true,
            imageUrl: true,
            platform: true,
            productType: true,
            store: true,
            priceTryCents: true,
            discountTryCents: true,
            customMarginPct: true,
            customPriceAznCents: true,
            discountEndAt: true,
            priceUsdCents: true,
            discountUsdCents: true,
          },
        },
      },
    })
    .catch(() => []);

  // Admin tarix yazmayıbsa oyunun PS Store endiriminin bitməsi işlənir —
  // endirim bitmiş kart karuseldə qalmasın, geri sayım da avtomatik olsun.
  const live = deals.flatMap((deal) => {
    const endsAt = effectiveFlashDealEnd(deal.endsAt, deal.game);
    return endsAt && endsAt.getTime() <= now.getTime() ? [] : [{ deal, endsAt }];
  });

  return live.map(({ deal, endsAt }) => {
    const price = applyFlashDeal(computeDisplayPrice(deal.game, settings), {
      priceAznCents: deal.priceAznCents,
      originalAznCents: deal.originalAznCents,
      endsAt,
    });
    return {
      id: deal.game.id,
      title: displayGameTitle(deal.game.title),
      href: gameDetailHref(deal.game),
      imageUrl: deal.game.imageUrl,
      productType: deal.game.productType,
      store: deal.game.store,
      platform: deal.game.platform,
      finalAzn: price.finalAzn,
      originalAzn: price.originalAzn,
      discountPct: price.discountPct,
      endsAt: endsAt ? endsAt.toISOString() : null,
    };
  });
}

/**
 * "Populyar oyunlar" — ana səhifədə əsas məhsul (33k oyun) əvvəl yalnız flash deal karuseli ilə
 * təmsil olunurdu. Sıra /oyunlar ilə eynidir (lib/popularity.ts); yalnız tam oyunlar (`GAME`).
 * Yalnız kart sütunları çəkilir — `SELECT g.*` `embedding` vektorunu da gətirərdi.
 */
async function fetchPopularGameCards(
  settings: Awaited<ReturnType<typeof getSettings>>,
): Promise<GameCardData[]> {
  const rows = (await prisma
    .$queryRaw(PrismaSql.sql`
      SELECT ${PrismaSql.raw(GAME_CARD_COLUMNS_SQL)}
      FROM "Game" g
      ${POPULARITY_JOINS_SQL}
      WHERE g."isActive" = true AND g."store" = 'PS' AND g."productType" = 'GAME'
      ORDER BY ${POPULARITY_ORDER_BY_SQL}
      LIMIT 12
    `)
    .catch(() => [])) as Array<GameCardRow & GameCustomPricing & { priceTryCents: number; editionLabel: string | null }>;
  return rows.map((g) => buildGameCard(g, computeDisplayPrice(g, settings)));
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
  const [banners, landing, totalsArr, orderCount, testimonialAgg, flashDeals, serviceBundles, openStreamingSlugs, popularGames] = await Promise.all([
    prisma.banner
      .findMany({
        where: { isActive: true, scope: "HOME" },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        include: { game: true, serviceProduct: true },
      })
      .catch(() => []),
    fetchLandingProducts(),
    prisma.game.groupBy({ by: ["productType"], where: { isActive: true }, _count: { _all: true } }),
    prisma.transaction
      .count({ where: { status: "SUCCESS", type: { in: ["PURCHASE", "SERVICE_PURCHASE"] } } })
      .catch(() => 0),
    prisma.testimonial
      .aggregate({ where: { isActive: true }, _avg: { rating: true }, _count: { _all: true } })
      .catch(() => null),
    fetchFlashDeals(settings),
    // Xidmət dəstləri. ⚠️ `.catch` vacibdir: ana səhifə prerender olunur və
    // miqrasiya tətbiq olunmayıbsa `next build`-in özü sınardı.
    loadActiveServiceBundles().catch(() => []),
    // Admin-dən satışa açılan streaming xidmətləri — onların bannerləri də göstərilir.
    prisma.streamingPlatform
      .findMany({ where: { storeSellable: true, isActive: true }, select: { slug: true } })
      .then((rows) => new Set(rows.map((r) => getPublicStreamingSlug(r.slug))))
      .catch(() => new Set<string>()),
    fetchPopularGameCards(settings),
  ]);

  const totalsAll = totalsArr.reduce((sum, row) => sum + row._count._all, 0);
  const trustStats = {
    orders: orderCount,
    games: totalsAll,
    avgRating: testimonialAgg?._avg.rating ?? null,
    reviewCount: testimonialAgg?._count._all ?? 0,
  };

  const bannerSlides = banners
    // Qeyri-PS məhsula/səhifəyə aparan bannerlər göstərilmir (lib/storeScope.ts).
    .filter(
      (b) =>
        (!b.game || isSellableGameStore(b.game.store)) &&
        (!b.serviceProduct || isSellableServiceProduct(b.serviceProduct)) &&
        isOpenStorePath(b.linkUrl, openStreamingSlugs),
    )
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
        // Spotify kimi çoxhesablı PLATFORM planları: banner birbaşa səbətə əlavə
        // etmir — accountSlots ötürülür ki, klient hesab modalını açsın.
        const slotsRaw = Number(meta.accountSlots);
        const accountSlots =
          svc.type === "PLATFORM" && Number.isInteger(slotsRaw) && slotsRaw >= 1 ? slotsRaw : null;
        service = {
          id: svc.id,
          title: serviceProductLabel(svc.title, svc.metadata),
          imageUrl: svc.imageUrl,
          productType: svc.type,
          finalAzn: svc.priceAznCents / 100,
          originalAzn: origCents != null ? origCents / 100 : null,
          discountPct: origCents != null ? Math.round((1 - svc.priceAznCents / origCents) * 100) : null,
          accountSlots,
          platformKind: accountSlots != null ? "SPOTIFY" : null,
        };
      }
      return {
        id: b.id,
        // Admin banner başlığını adətən oyunun PS Store adından köçürür ("… PS4™ ve PS5™").
        title: b.title ? displayGameTitle(b.title) : b.title,
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
                slug: b.game.slug,
                title: displayGameTitle(b.game.title),
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

  return {
    bannerSlides,
    trustStats,
    landingProducts: landing.products,
    subscriptionShowcase: landing.showcase,
    flashDeals,
    serviceBundles,
    popularGames,
  };
  },
  // v2: `popularGames` əlavə olundu — köhnə keş dəyərində bu sahə yoxdur.
  // v3: vitrin sətrinə `visual`, qrupa `hint` əlavə olundu (kart qapağı) — köhnə dəyər səhifəni sındırırdı.
  ["home-page-data-v3"],
  { revalidate: 1800, tags: ["home", "service-bundles"] },
);

export default async function HomePage() {
  const {
    bannerSlides,
    trustStats,
    landingProducts,
    subscriptionShowcase,
    flashDeals,
    serviceBundles,
    popularGames,
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
    email: "info@honsell.site",
    telephone: "+994702560509",
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+994702560509",
      contactType: "customer support",
      email: "info@honsell.site",
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
      <ScrollAnimationManager />

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
                  PlayStation oyunları,
                  <br />
                  PS Plus və gift card-lar bir yerdə
                </p>
              </div>
            </div>
            <HeroMotionOverlay />
          </div>
        )}
      </section>

      <HomeTrustBar {...trustStats} />

      {/* Əsas məhsul (oyunlar) önə: kampaniya oyunları + populyar oyunlar, sonra abunəliklər.
          "Niyə biz" kartları və bəzək zolaqları (SectionFlowDivider) 2026-11-də çıxarılıb —
          güvən mesajı HomeTrustBar-da artıq var idi. */}

      {/* Fürsətləri qaçırma — admin panelindən əl ilə seçilən kampaniya oyunları (öz başlıqlı panel). */}
      <HomeFlashDeals deals={flashDeals} />

      {popularGames.length > 0 && (
        <section className="py-8 sm:py-10" aria-labelledby="populyar-oyunlar">
          <div className="site-container">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <h2 id="populyar-oyunlar" className="text-2xl font-black tracking-tight text-zinc-950 dark:text-white sm:text-3xl">
                Populyar oyunlar
              </h2>
              <Link
                href="/oyunlar"
                className="inline-flex items-center gap-1.5 text-sm font-bold text-violet-700 transition hover:text-violet-500 dark:text-violet-300 dark:hover:text-violet-200"
              >
                Bütün oyunlar <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <nav aria-label="Oyun bölmələri" className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {GAME_QUICK_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="shrink-0 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:border-violet-300 hover:text-violet-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:border-violet-400/50 dark:hover:text-white"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
            {/* Telefonda üfüqi lent (2 kart görünür), sm+ şəbəkə. GameCard özü <li> qaytarır. */}
            <ul className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>li]:w-[46%] [&>li]:shrink-0 [&>li]:snap-start sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 sm:[&>li]:w-auto lg:grid-cols-4 xl:grid-cols-6">
              {popularGames.map((g) => (
                <GameCard key={g.id} game={g} />
              ))}
            </ul>
          </div>
        </section>
      )}

      {(landingProducts.length > 0 || subscriptionShowcase.length > 0) && (
        <section className="pt-8 sm:pt-10" aria-labelledby="abunelikler">
          <div className="site-container">
            <h2 id="abunelikler" className="text-2xl font-black tracking-tight text-zinc-950 dark:text-white sm:text-3xl">
              Abunəliklər
            </h2>
          </div>
        </section>
      )}
      <HomeProductMatrix products={landingProducts} />

      {/* Netflix və Spotify — hər plan yığcam bir kart (lib/homeSubscriptionShowcase.ts). */}
      <HomeSubscriptionShowcase brands={subscriptionShowcase} />

      {/* Xidmət dəstləri (Netflix + HBO Max və s.) — öz başlıqlı panel, dəst yoxdursa null. */}
      <HomeServiceBundles bundles={serviceBundles} />

      {/* Müştəri rəyləri (sosial sübut) — başlıq komponentin içindədir. */}
      <HomeTestimonials />

      {/* General FAQ */}
      <section className="py-10 sm:py-14" aria-labelledby="tez-suallar">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 id="tez-suallar" className="mb-4 text-2xl font-black tracking-tight text-zinc-950 dark:text-white sm:text-3xl">
            Tez verilən suallar
          </h2>
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

      <SiteFooter />
    </main>
  );
}
