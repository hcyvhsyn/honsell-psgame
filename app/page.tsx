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
import {
  HeroMotionOverlay,
  SectionFlowDivider,
} from "@/components/MarketingUI";
import {
  ShieldCheck,
  Zap,
  Clock,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import FaqAccordion from "@/components/FaqAccordion";
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
import { applyFlashDeal, effectiveFlashDealEnd } from "@/lib/flashDeals";
import {
  PLAYSTATION_ONLY,
  isOpenStorePath,
  isSellableGameStore,
  isSellableServiceProduct,
  sellableGameWhere,
  sellableServiceWhere,
} from "@/lib/storeScope";

export const revalidate = 1800;

const HOME_FAQS = [
  {
    id: "home-products",
    question: "Hansı məhsulları ala bilərəm?",
    answer:
      PLAYSTATION_ONLY
        ? "PlayStation oyunları, PS Plus, EA Play, Türkiyə PSN gift card-ları və TR PSN hesabının açılması."
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
        String(meta?.musicBrand ?? "").toUpperCase() === "SPOTIFY"
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
    return PLATFORM_CATEGORY_LABELS[platform.category].replace(" Platformaları", "");
  }
  return SERVICE_TYPE_BADGES[type] ?? "Məhsul";
}

async function fetchLandingProducts(): Promise<HomeProductMatrixItem[]> {
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

  return services
    .filter((service) => !isHiddenFromLanding(service.metadata))
    .sort((a, b) => {
      const orderA = LANDING_SERVICE_ORDER.get(a.type) ?? 999;
      const orderB = LANDING_SERVICE_ORDER.get(b.type) ?? 999;
      return orderA - orderB || a.sortOrder - b.sortOrder || a.priceAznCents - b.priceAznCents;
    })
    // Ana səhifə HTML-ini yüngül saxlamaq üçün maks. 12 kart server-render olunur
    // (əvvəl bütün aktiv landing məhsulları gəlirdi → onlarla kart, böyük HTML).
    // Tam siyahı kateqoriya səhifələrindədir.
    .slice(0, 12)
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
      title: deal.game.title,
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
 * Ana səhifənin user-ə aid OLMAYAN bütün datası + view-model hesablaması burada
 * `unstable_cache` ilə 30 dəqiqəlik keşdə saxlanır. Səhifə header-dəki `cookies()`
 * səbəbindən dinamik render olunsa belə (revalidate tək başına bunu keşləmir),
 * bu funksiya keşdən gəlir → əksər açılışda ~13 Mumbai sorğusu yerinə 0 sorğu.
 * Qaytarılan hər şey plain/serializable-dır (Date-lər ISO string-ə çevrilib).
 */
const getHomePageData = unstable_cache(
  async () => {
  const settings = await getSettings();
  const [banners, landingProducts, totalsArr, orderCount, testimonialAgg, flashDeals, serviceBundles] = await Promise.all([
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
        isOpenStorePath(b.linkUrl),
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
                slug: b.game.slug,
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

  return {
    bannerSlides,
    trustStats,
    landingProducts,
    flashDeals,
    serviceBundles,
  };
  },
  ["home-page-data"],
  { revalidate: 1800, tags: ["home", "service-bundles"] },
);

export default async function HomePage() {
  const {
    bannerSlides,
    trustStats,
    landingProducts,
    flashDeals,
    serviceBundles,
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

      <SectionFlowDivider text="Abunəlik paketləri" tone="violet" />
      <HomeProductMatrix products={landingProducts} />

      {/* Fürsətləri qaçırma — admin panelindən əl ilə seçilən kampaniya oyunları.
          Əvvəlki avtomatik "Endirimdə olan oyunlar" karuselinin yerini tutur.
          Öz başlığı olan bir panel olduğu üçün qabağına SectionFlowDivider qoyulmur. */}
      <HomeFlashDeals deals={flashDeals} />

      {/* Xidmət dəstləri (Netflix + HBO Max və s.) — HomeFlashDeals kimi öz
          başlıqlı paneldir, dəst yoxdursa özü null qaytarır. */}
      <HomeServiceBundles bundles={serviceBundles} />

      {/* Niyə biz */}
      <SectionFlowDivider text="Niyə biz" tone="violet" />
      <section id="niye-biz" className="py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
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
      <SectionFlowDivider text="Müştərilər nə deyir" tone="rose" flip />
      <HomeTestimonials />

      {/* General FAQ */}
      <SectionFlowDivider text="Tez verilən suallar" tone="emerald" />
      <section className="py-12 sm:py-14">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
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

      <SiteFooter showSupportCta={false} />
    </main>
  );
}
