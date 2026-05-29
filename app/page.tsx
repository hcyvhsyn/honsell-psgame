import { prisma } from "@/lib/prisma";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import SiteFooter from "@/components/SiteFooter";
import HomeBannerSlider from "@/components/HomeBannerSlider";
import {
  PlatformCard,
  MarqueeHeader,
  HeroMotionOverlay,
} from "@/components/MarketingUI";
import Link from "next/link";
import {
  Gamepad2,
  ShieldCheck,
  Zap,
  Clock,
  Sparkles,
  ArrowRight,
  Tv,
  Music,
  Briefcase,
  Brain,
  Layers,
} from "lucide-react";
import FaqAccordion from "@/components/FaqAccordion";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";

export const revalidate = 1800;

export default async function HomePage() {
  const [settings, banners, faqs, totalsArr, streamingProducts, psPlusProducts, giftCardProducts] = await Promise.all([
    getSettings(),
    prisma.banner
      .findMany({
        where: { isActive: true, scope: "HOME" },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        include: { game: true },
      })
      .catch(() => []),
    prisma.faqItem
      .findMany({
        where: { isActive: true, scope: "HOME" },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, question: true, answer: true },
      })
      .catch(() => [] as { id: string; question: string; answer: string }[]),
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
  ]);

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

  const faqJsonLd = faqs.length > 0
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
      }
    : null;

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

      <h1 className="sr-only">{SITE_NAME} — {SITE_DESCRIPTION}</h1>

      {/* Hero banner (HOME scope) */}
      <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        {bannerSlides.length > 0 ? (
          <HomeBannerSlider banners={bannerSlides} />
        ) : (
          <div className="relative overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800/60">
            <div className="relative aspect-[4/5] bg-gradient-to-br from-violet-50 via-white to-zinc-100 dark:from-indigo-950 dark:via-zinc-900 dark:to-zinc-950 sm:aspect-[16/8] lg:aspect-[21/7]">
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

      {/* Top-level platform navigator */}
      <section id="platformalar" className="py-16">
        <MarqueeHeader text="PLATFORMALAR" />
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <PlatformCard
              href="/playstation"
              icon={<Gamepad2 className="h-5 w-5 text-white" />}
              label="PlayStation"
              sub={`${totals.GAME.toLocaleString("az-AZ")}+ oyun · PS Plus · Hədiyyə kartları · Hesab açma`}
              imageUrl={bannerSlides[0]?.imageUrl ?? psPlusProducts[0]?.imageUrl ?? giftCardProducts[0]?.imageUrl ?? null}
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
      <section id="niye-biz" className="py-16">
        <MarqueeHeader text="NİYƏ BİZ" />
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
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

      {/* General FAQ */}
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
            alışından komissiya qazanırsız.
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
