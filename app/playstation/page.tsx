import { prisma } from "@/lib/prisma";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import SiteFooter from "@/components/SiteFooter";
import HomeBannerSlider from "@/components/HomeBannerSlider";
import GameCard, { type GameCardData } from "@/components/GameCard";
import {
  CategoryGroup,
  SubCategoryCard,
  MarqueeHeader,
  HeroMotionOverlay,
} from "@/components/MarketingUI";
import Image from "next/image";
import Link from "next/link";
import {
  Gift,
  Crown,
  UserPlus,
  Gamepad2,
  ArrowRight,
  LayoutGrid,
  MessageSquare,
  Tag,
  Heart,
} from "lucide-react";
import FaqAccordion from "@/components/FaqAccordion";
import NewsSection from "@/components/NewsSection";
import PsPlusClient from "../ps-plus/PsPlusClient";
import HediyyeKartlariClient from "../hediyye-kartlari/HediyyeKartlariClient";
import HesabAcmaHomeCategoryCard from "@/components/HesabAcmaHomeCategoryCard";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";
import type { Metadata } from "next";

export const revalidate = 1800;

const HOMEPAGE_LIMIT = 4;
const DEFAULT_TYPE = "GAME";

export const metadata: Metadata = {
  title: "PlayStation — Oyunlar, PS Plus, Hədiyyə Kartları | Honsell",
  description:
    "PlayStation oyunları, PS Plus abunəlikləri, hədiyyə kartları, kolleksiyalar, endirimlər və hesab açma — bir yerdə.",
  alternates: { canonical: "/playstation" },
};

export default async function PlayStationPage() {
  const [
    settings,
    games,
    totalsArr,
    banners,
    psPlusProducts,
    giftCardProducts,
    accountCreationProduct,
    featuredCollections,
    faqs,
  ] = await Promise.all([
    getSettings(),
    prisma.game.findMany({
      where: { isActive: true, productType: DEFAULT_TYPE, isFeatured: true },
      orderBy: { lastScrapedAt: "desc" },
      take: HOMEPAGE_LIMIT,
    }),
    prisma.game.groupBy({ by: ["productType"], where: { isActive: true }, _count: { _all: true } }),
    prisma.banner
      .findMany({
        where: { isActive: true, scope: "PLAYSTATION" },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        include: { game: true },
      })
      .catch(() => []),
    prisma.serviceProduct.findMany({
      where: { isActive: true, type: "PS_PLUS" },
      orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
    }),
    prisma.serviceProduct.findMany({
      where: { isActive: true, type: "TRY_BALANCE" },
      orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
      take: 4,
      include: { _count: { select: { codes: { where: { isUsed: false } } } } },
    }),
    prisma.serviceProduct.findFirst({
      where: { isActive: true, type: "ACCOUNT_CREATION" },
    }),
    prisma.collection
      .findMany({
        where: { isActive: true },
        orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
        take: 6,
        include: {
          _count: { select: { games: true } },
          games: {
            orderBy: { position: "asc" },
            take: 1,
            include: { game: { select: { imageUrl: true, heroImageUrl: true } } },
          },
        },
      })
      .catch(() => []),
    prisma.faqItem
      .findMany({
        where: { isActive: true, scope: "PLAYSTATION" },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, question: true, answer: true },
      })
      .catch(() => [] as { id: string; question: string; answer: string }[]),
  ]);

  const totals: Record<string, number> = { GAME: 0, ADDON: 0, CURRENCY: 0, OTHER: 0 };
  for (const row of totalsArr) totals[row.productType] = row._count._all;

  const results: GameCardData[] = games.map((g) => {
    const price = computeDisplayPrice(g, settings);
    return {
      id: g.id,
      productId: g.productId,
      title: g.title,
      imageUrl: g.imageUrl,
      platform: g.platform,
      productType: g.productType,
      finalAzn: price.finalAzn,
      originalAzn: price.originalAzn,
      discountPct: price.discountPct,
      discountEndAt: g.discountTryCents != null && g.discountEndAt ? g.discountEndAt.toISOString() : null,
    };
  });

  const bannerSlides = banners
    .map((b) => {
      const price = b.game ? computeDisplayPrice(b.game, settings) : null;
      return {
        id: b.id,
        title: b.title,
        subtitle: b.subtitle,
        imageUrl: b.imageUrl || b.game?.heroImageUrl || b.game?.imageUrl || "",
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
      };
    })
    .filter((b) => b.imageUrl);

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "PlayStation", item: `${SITE_URL}/playstation` },
    ],
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <SiteHeaderServer />

      <h1 className="sr-only">{SITE_NAME} PlayStation — {SITE_DESCRIPTION}</h1>

      {/* Hero banner */}
      <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        {bannerSlides.length > 0 ? (
          <HomeBannerSlider banners={bannerSlides} />
        ) : (
          <div className="relative overflow-hidden rounded-3xl border border-zinc-800/60">
            <div className="relative aspect-[4/5] bg-gradient-to-br from-indigo-950 via-zinc-900 to-zinc-950 sm:aspect-[16/8] lg:aspect-[21/7]">
              <div className="pointer-events-none absolute -left-20 top-0 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />
              <div className="pointer-events-none absolute right-0 bottom-0 h-64 w-64 rounded-full bg-fuchsia-700/20 blur-3xl" />
              <div className="relative flex h-full flex-col items-start justify-center px-8 sm:px-14">
                <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-200">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
                  {totals.GAME.toLocaleString("az-AZ")} oyun · canlı kataloq
                </span>
                <p className="text-3xl font-black tracking-tight text-white sm:text-5xl">
                  PlayStation oyunları
                  <br />
                  ən sərfəli qiymətlə
                </p>
              </div>
            </div>
            <HeroMotionOverlay />
          </div>
        )}
      </section>

      {/* Categories */}
      <section id="kateqoriyalar" className="py-16">
        <MarqueeHeader text="KATEQORİYALAR" />
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <CategoryGroup
            label="PlayStation kateqoriyaları"
            icon={<Gamepad2 className="h-5 w-5 text-white" />}
            accentClass="from-indigo-500/30 to-fuchsia-500/20"
            description="Oyunlar, abunəliklər, balans, hesab və endirimlər"
          >
            <SubCategoryCard
              href="/oyunlar"
              icon={<Gamepad2 className="h-4 w-4" />}
              label="Oyunlar"
              sub={`${totals.GAME.toLocaleString("az-AZ")}+ məhsul`}
              imageUrl={results[0]?.imageUrl ?? bannerSlides[0]?.imageUrl ?? null}
              accentClass="border-emerald-400/30 from-emerald-400/20"
            />
            <SubCategoryCard
              href="/ps-plus"
              icon={<Crown className="h-4 w-4" />}
              label="PS Plus"
              sub="Essential · Extra · Deluxe"
              imageUrl={psPlusProducts[0]?.imageUrl ?? null}
              accentClass="border-amber-300/30 from-amber-300/20"
            />
            <SubCategoryCard
              href="/hediyye-kartlari"
              icon={<Gift className="h-4 w-4" />}
              label="Hədiyyə Kartları"
              sub="Anında e-pin kodlar"
              imageUrl={giftCardProducts[0]?.imageUrl ?? null}
              accentClass="border-rose-400/30 from-rose-400/20"
            />
            <SubCategoryCard
              href="/hesab-acma"
              icon={<UserPlus className="h-4 w-4" />}
              label="Hesab Açma"
              sub={
                accountCreationProduct
                  ? `${(accountCreationProduct.priceAznCents / 100).toFixed(2)}₼-dən`
                  : "Türkiyə PSN hesabı"
              }
              imageUrl={accountCreationProduct?.imageUrl ?? null}
              accentClass="border-violet-300/30 from-violet-300/20"
            />
            <SubCategoryCard
              href="/kolleksiyalar"
              icon={<LayoutGrid className="h-4 w-4" />}
              label="Kolleksiyalar"
              sub="Tematik oyun siyahıları"
              imageUrl={
                featuredCollections[0]?.imageUrl ??
                featuredCollections[0]?.games[0]?.game.heroImageUrl ??
                featuredCollections[0]?.games[0]?.game.imageUrl ??
                null
              }
              accentClass="border-sky-400/30 from-sky-400/20"
            />
            <SubCategoryCard
              href="/endirimler"
              icon={<Tag className="h-4 w-4" />}
              label="Endirimlər"
              sub="Aktiv kampaniyalar"
              imageUrl={results.find((g) => g.discountPct != null)?.imageUrl ?? null}
              accentClass="border-rose-400/30 from-rose-400/20"
            />
            <SubCategoryCard
              href="/reyler"
              icon={<MessageSquare className="h-4 w-4" />}
              label="Rəylər"
              sub="Müştəri rəyləri və qiymətləndirmə"
              imageUrl={null}
              accentClass="border-cyan-400/30 from-cyan-400/20"
            />
            <SubCategoryCard
              href="/profile/favorites"
              icon={<Heart className="h-4 w-4" />}
              label="Favoritlərim"
              sub="Saxladığım oyunlar"
              imageUrl={null}
              accentClass="border-pink-400/30 from-pink-400/20"
            />
          </CategoryGroup>
        </div>
      </section>

      {/* Featured games */}
      <section id="games" className="py-16">
        <MarqueeHeader text="OYUNLAR" />
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {results.map((g, i) => (
              <GameCard key={g.id} game={g} priority={i < 4} />
            ))}
          </ul>

          <div className="mt-8 flex justify-center">
            <Link
              href="/oyunlar"
              className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10 hover:border-white/20"
            >
              Daha çox yüklə <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* Collections */}
      {featuredCollections.length > 0 && (
        <section id="kolleksiyalar" className="py-16">
          <MarqueeHeader text="KOLLEKSIYALAR" />
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featuredCollections.map((c) => {
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
                      <h3 className="mt-1 text-xl font-black text-white sm:text-2xl">{c.title}</h3>
                      <p className="mt-1 text-sm text-zinc-300">{c._count.games} oyun</p>
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="mt-8 flex justify-center">
              <Link
                href="/kolleksiyalar"
                className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10 hover:border-white/20"
              >
                Bütün kolleksiyalar <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* PS Plus */}
      <section id="ps-plus" className="py-16">
        <MarqueeHeader text="PS PLUS" />
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <PsPlusClient
            hideTierSelector={true}
            flatMode={true}
            plans={(() => {
              const tierOrder = ["ESSENTIAL", "EXTRA", "DELUXE"] as const;
              const oneMonthByTier = new Map<string, (typeof psPlusProducts)[number]>();
              for (const p of psPlusProducts) {
                const m = (p.metadata as Record<string, unknown> | null) ?? {};
                const t = String(m.tier ?? "");
                const dur = Number(m.durationMonths ?? 0);
                if (dur === 1 && (t === "ESSENTIAL" || t === "EXTRA" || t === "DELUXE")) {
                  if (!oneMonthByTier.has(t)) oneMonthByTier.set(t, p);
                }
              }
              return tierOrder
                .map((t) => oneMonthByTier.get(t))
                .filter((p): p is (typeof psPlusProducts)[number] => Boolean(p))
                .map((p) => ({
                  id: p.id,
                  title: p.title,
                  imageUrl: p.imageUrl,
                  priceAznCents: p.priceAznCents,
                  metadata: (p.metadata as Record<string, unknown> | null) ?? null,
                }));
            })()}
          />
          <div className="flex justify-center mt-8">
            <Link
              href="/ps-plus"
              className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10 hover:border-white/20"
            >
              Daha çox yüklə <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* Gift cards */}
      <section id="gift-cards" className="py-16">
        <MarqueeHeader text="HƏDİYYƏ KARTLARI" />
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <HediyyeKartlariClient
            cards={giftCardProducts.map((c) => ({
              id: c.id,
              title: c.title,
              imageUrl: c.imageUrl,
              priceAznCents: c.priceAznCents,
              metadata: (c.metadata as Record<string, unknown> | null) ?? null,
              _count: c._count,
            }))}
          />
          <div className="mt-8 flex justify-center">
            <Link
              href="/hediyye-kartlari"
              className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10 hover:border-white/20"
            >
              Daha çox yüklə <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* Account creation card */}
      <section id="account-creation" className="py-16">
        <MarqueeHeader text="HESAB AÇMA" />
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <HesabAcmaHomeCategoryCard
            product={
              accountCreationProduct
                ? {
                    id: accountCreationProduct.id,
                    title: accountCreationProduct.title,
                    imageUrl: accountCreationProduct.imageUrl,
                    priceAznCents: accountCreationProduct.priceAznCents,
                  }
                : null
            }
            icon={<UserPlus className="h-5 w-5 text-white" />}
            label="Hesab Açma"
            sub="Türkiyə PSN hesabı"
            imageUrl={accountCreationProduct?.imageUrl ?? null}
            accentClass="border-violet-300/25 from-violet-300/20 to-white/[0.03]"
          />
        </div>
      </section>

      {/* News — PlayStation scope */}
      <NewsSection
        scope="PLAYSTATION"
        title="PlayStation xəbərləri"
        subtitle="Yeni oyun anonsları, PS Plus təklifləri və PlayStation dünyasından son yeniliklər."
      />

      {/* FAQ — for PlayStation */}
      {faqs.length > 0 && (
        <section className="py-16">
          <MarqueeHeader text="TEZ VERİLƏN SUALLAR" />
          <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
            <FaqAccordion items={faqs} />
          </div>
        </section>
      )}

      {/* Referral CTA */}
      <section className="relative overflow-hidden border-y border-fuchsia-500/30 bg-gradient-to-r from-fuchsia-700/30 via-purple-700/20 to-fuchsia-700/30 py-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(232,121,249,0.25),transparent_60%)]" />
        <div className="relative mx-auto max-w-5xl px-6 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-fuchsia-300">
            Referal proqramı
          </p>
          <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">
            Dostunu dəvət et — hər alışından AZN qazan
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-fuchsia-50/80 sm:text-base">
            Kodunla qeydiyyatdan keçən hər dost üçün siz hər oyun, PS Plus və streaming
            alışından komissiya qazanırsız. 5/10/25 uğurlu dəvət üçün bonus AZN.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/qazan"
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-fuchsia-900 transition hover:bg-fuchsia-50"
            >
              Necə qazanıram? <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
