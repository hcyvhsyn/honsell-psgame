import { prisma } from "@/lib/prisma";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import HomeBannerSlider from "@/components/HomeBannerSlider";
import GameCard, { type GameCardData } from "@/components/GameCard";
import Image from "next/image";
import Link from "next/link";
import {
  Gift,
  Crown,
  UserPlus,
  Gamepad2,
  ShieldCheck,
  Zap,
  Clock,
  Star,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import FaqAccordion from "@/components/FaqAccordion";
import PsPlusClient from "./ps-plus/PsPlusClient";
import HediyyeKartlariClient from "./hediyye-kartlari/HediyyeKartlariClient";
import HesabAcmaHomeCategoryCard from "@/components/HesabAcmaHomeCategoryCard";
import ReviewWriteButton from "@/components/ReviewWriteButton";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const HOMEPAGE_LIMIT = 4;
const DEFAULT_TYPE = "GAME";

export default async function HomePage() {
  const [
    settings,
    games,
    totalsArr,
    banners,
    testimonials,
    psPlusProducts,
    giftCardProducts,
    accountCreationProduct,
  ] = await Promise.all([
      getSettings(),
      prisma.game.findMany({
        where: { isActive: true, productType: DEFAULT_TYPE, isFeatured: true },
        orderBy: { lastScrapedAt: "desc" },
        take: HOMEPAGE_LIMIT,
      }),
      prisma.game.groupBy({ by: ["productType"], where: { isActive: true }, _count: { _all: true } }),
      prisma.banner.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], include: { game: true } }).catch(() => []),
      prisma.testimonial.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], take: 6 }).catch(() => []),
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
    ]);

  const totals: Record<string, number> = { GAME: 0, ADDON: 0, CURRENCY: 0, OTHER: 0 };
  for (const row of totalsArr) totals[row.productType] = row._count._all;

  const results: GameCardData[] = games.map((g) => {
    const price = computeDisplayPrice(g, settings);
    return { id: g.id, productId: g.productId, title: g.title, imageUrl: g.imageUrl, platform: g.platform, productType: g.productType, finalAzn: price.finalAzn, originalAzn: price.originalAzn, discountPct: price.discountPct, discountEndAt: g.discountTryCents != null && g.discountEndAt ? g.discountEndAt.toISOString() : null };
  });

  const bannerSlides = banners.map((b) => ({
    id: b.id,
    title: b.title,
    subtitle: b.subtitle,
    imageUrl: b.imageUrl,
    linkUrl: b.linkUrl,
    actionType: (b.actionType === "ADD_TO_CART" ? "ADD_TO_CART" : "LINK") as "LINK" | "ADD_TO_CART",
    game: b.game
      ? {
          id: b.game.id,
          title: b.game.title,
          imageUrl: b.game.imageUrl,
          finalAzn: computeDisplayPrice(b.game, settings).finalAzn,
          productType: b.game.productType,
        }
      : null,
  }));

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

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <SiteHeaderServer />

      <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-zinc-800/60">
          {bannerSlides.length > 0 ? (
            <HomeBannerSlider banners={bannerSlides} />
          ) : (
            <div className="relative bg-gradient-to-br from-indigo-950 via-zinc-900 to-zinc-950" style={{ aspectRatio: "21/7" }}>
              <div className="pointer-events-none absolute -left-20 top-0 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />
              <div className="pointer-events-none absolute right-0 bottom-0 h-64 w-64 rounded-full bg-fuchsia-700/20 blur-3xl" />
              <div className="relative flex h-full flex-col items-start justify-center px-8 sm:px-14">
                <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-200">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
                  {totals.GAME.toLocaleString("az-AZ")} oyun · canlı kataloq
                </span>
                <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
                  PlayStation oyunları
                  <br />
                  ən sərfəli qiymətlə
                </h1>
              </div>
            </div>
          )}
          <HeroMotionOverlay />
        </div>
      </section>

      <section className="py-16">
        <MarqueeHeader text="KATEQORİYALAR" />
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <FancyCategoryCard href="/oyunlar" icon={<Gamepad2 className="h-6 w-6 text-white" />} label="Oyunlar" sub={`${totals.GAME}+ məhsul`} />
            <FancyCategoryCard href="/hediyye-kartlari" icon={<Gift className="h-6 w-6 text-white" />} label="Hədiyyə Kartları" sub="Anında e-pin kodlar" />
            <FancyCategoryCard href="/ps-plus" icon={<Crown className="h-6 w-6 text-white" />} label="PS Plus" sub="Essential · Extra · Deluxe" />
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
              icon={<UserPlus className="h-6 w-6 text-white" />}
              label="Hesab Açma"
              sub="Türkiyə PSN hesabı"
            />
          </div>
        </div>
      </section>

      <section id="games" className="py-16">
        <MarqueeHeader text="OYUNLAR" />
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {results.map((g) => (
              <GameCard key={g.id} game={g} />
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

      <section className="py-16">
        <MarqueeHeader text="RƏYLƏR" />
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="grid gap-x-6 gap-y-16 md:grid-cols-2 xl:grid-cols-3">
            {(testimonials.length > 0
              ? testimonials.map((t) => ({ id: t.id, name: t.name, text: t.text, rating: t.rating, avatarUrl: t.avatarUrl, platform: t.platform }))
              : [
                  { id: "d1", name: "Əli H.", text: "Çox sürətli xidmət! Sifarişim 30 dəqiqə ərzində tamamlandı.", rating: 5, avatarUrl: null, platform: "GAME" },
                  { id: "d2", name: "Nigar M.", text: "TRY gift kartı aldım, kod anında gəldi. Qiymətlər çox sərfəlidir.", rating: 5, avatarUrl: null, platform: "GIFT_CARD" },
                  { id: "d3", name: "Rauf S.", text: "PS Plus sifarişində dəstək çox peşəkar oldu. Tam məmnunam.", rating: 5, avatarUrl: null, platform: "PS_PLUS" },
                  { id: "d4", name: "Leyla K.", text: "Hesab açılışı sifarişim gözlədiyimdən daha tez hazırlandı.", rating: 5, avatarUrl: null, platform: "ACCOUNT_CREATION" },
                  { id: "d5", name: "Orxan T.", text: "Bir neçə dəfə alış etmişəm, hər dəfə problemsiz və sürətli.", rating: 5, avatarUrl: null, platform: "GAME" },
                  { id: "d6", name: "Gülnar A.", text: "Wallet top-up və alış prosesi çox rahat qurulub.", rating: 5, avatarUrl: null, platform: "GIFT_CARD" },
                ]).map((t) => (
              <article
                key={t.id}
                className="relative mt-6 rounded-[24px] bg-[#150A21] p-6 pt-10 shadow-2xl"
              >
                <div className="absolute -top-8 left-6 h-16 w-16 overflow-hidden rounded-full border-4 border-[#0A0A0F] bg-[#150A21]">
                  {t.avatarUrl ? (
                    <Image src={t.avatarUrl} alt={t.name} fill className="object-cover" unoptimized />
                  ) : (
                    <div className="grid h-full w-full place-items-center bg-white/10 text-xl font-bold text-white">
                      {t.name.charAt(0)}
                    </div>
                  )}
                </div>

                <div className="mb-5 flex items-center justify-between">
                  <span className="rounded-full bg-[#6D28D9] px-4 py-1 text-xs font-semibold text-white">
                    {t.platform === "PS_PLUS"
                      ? "PS Plus"
                      : t.platform === "GIFT_CARD"
                        ? "Hədiyyə kartı"
                        : t.platform === "ACCOUNT_CREATION"
                          ? "Hesab açma"
                          : "Oyun"}
                  </span>
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, si) => (
                      <Star
                        key={si}
                        className={`h-4 w-4 ${si < t.rating ? "fill-[#A78BFA] text-[#A78BFA]" : "fill-white/10 text-white/10"}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="mb-3 flex items-start gap-2">
                  <span className="text-4xl font-serif font-black text-white leading-none">“</span>
                  <h3 className="mt-1 text-lg font-bold text-white">{t.name}</h3>
                </div>

                <p className="text-sm leading-relaxed text-[#9CA3AF]">
                  {t.text}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-16 flex justify-center">
            <ReviewWriteButton />
          </div>
        </div>
      </section>

      <section className="py-16">
        <MarqueeHeader text="NİYƏ BİZ" />
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {[
              { icon: <Zap className="h-6 w-6 text-white" />, title: "Anında çatdırılma", desc: "Gift card və bir çox sifarişdə nəticə saniyələr içində." },
              { icon: <ShieldCheck className="h-6 w-6 text-white" />, title: "Etibarlı sistem", desc: "Şəffaf proses, manual yoxlama və təhlükəsiz ödəniş mərhələləri." },
              { icon: <Clock className="h-6 w-6 text-white" />, title: "Sürətli dəstək", desc: "Sifariş statusu üzrə operativ admin müdaxiləsi və cavablar." },
              { icon: <Sparkles className="h-6 w-6 text-white" />, title: "Premium təcrübə", desc: "Sadə interfeys, aydın yol və fərqli xidmətlər üçün xüsusi flow." },
            ].map((f) => (
              <div key={f.title} className="relative mt-6 rounded-[24px] bg-[#150A21] p-6 pt-10 shadow-2xl transition hover:-translate-y-1">
                <div className="absolute -top-8 left-6 grid h-16 w-16 place-items-center overflow-hidden rounded-full border-4 border-[#0A0A0F] bg-[#150A21]">
                  {f.icon}
                </div>
                <h3 className="mt-2 text-lg font-bold text-white">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#9CA3AF]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <MarqueeHeader text="TEZ VERİLƏN SUALLAR" />
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
          <FaqAccordion />
        </div>
      </section>

      {/* ─── Footer ───────────────────────────────────────────────────── */}
      <footer className="mt-20 border-t border-white/5 bg-[#0B0B0E]">
        <div className="mx-auto max-w-[1200px] px-6 py-12">
          
          {/* Top row: Logo and Links */}
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between border-b border-white/5 pb-10">
            <p className="text-3xl font-black tracking-tight text-white">HONSELL</p>
            <nav className="flex flex-wrap items-center gap-6 text-sm text-zinc-300">
              <Link href="/#kateqoriya" className="hover:text-white transition">Kateqoriya</Link>
              <Link href="/#niye-biz" className="hover:text-white transition">Niyə biz?</Link>
              <Link href="/#mehsullar" className="hover:text-white transition">Məhsullar</Link>
              <Link href="/#reyler" className="hover:text-white transition">Rəylər</Link>
            </nav>
          </div>

          {/* Bottom row: Contact and Socials */}
          <div className="mt-10 flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-wrap gap-12 text-sm text-zinc-300">
              <div>
                <p className="mb-1 text-zinc-500">Telefon:</p>
                <p className="font-semibold text-white">+994 70 256 05 09</p>
              </div>
              <div>
                <p className="mb-1 text-zinc-500">Mail:</p>
                <p className="font-semibold text-white">info@honsell.store</p>
              </div>
          
            </div>

            <div className="flex items-center gap-4">
              <a href="#" aria-label="WhatsApp" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5a189a] text-white hover:bg-[#7b2cbf] transition">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.662-2.06-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
              </a>
              <a href="#" aria-label="Instagram" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5a189a] text-white hover:bg-[#7b2cbf] transition">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
              </a>
              <a href="#" aria-label="Telegram" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5a189a] text-white hover:bg-[#7b2cbf] transition">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.223-.548.223l.188-2.85 5.18-4.686c.223-.195-.054-.285-.346-.086l-6.4 4.024-2.76-.86c-.6-.185-.615-.6.125-.89l10.736-4.135c.498-.184.935.114.825.86z"/></svg>
              </a>
              <a href="#" aria-label="TikTok" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5a189a] text-white hover:bg-[#7b2cbf] transition">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93v7.2c0 1.2.15 2.43-.16 3.6-.33 1.25-1.08 2.4-2.07 3.23-1.04.88-2.4 1.41-3.8 1.48-1.52.07-3.05-.2-4.37-.99-1.28-.77-2.27-1.99-2.71-3.41-.45-1.42-.4-2.98.05-4.38.45-1.39 1.45-2.58 2.75-3.28 1.28-.68 2.78-1.01 4.24-.9v4.04c-.75-.02-1.52.12-2.18.52-.61.37-1.09.96-1.32 1.65-.24.7-.24 1.47 0 2.16.24.71.74 1.3 1.37 1.66.65.37 1.42.49 2.16.42.74-.08 1.44-.41 1.96-.94.52-.53.86-1.22 1-1.95.14-.72.16-1.47.16-2.2V.02z"/></svg>
              </a>
              <a href="#" aria-label="YouTube" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5a189a] text-white hover:bg-[#7b2cbf] transition">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              </a>
            </div>
          </div>

        </div>
      </footer>
    </main>
  );
}

// ─── Helper Components ────────────────────────────────────────────────────────

function FancyCategoryCard({ href, icon, label, sub }: { href: string; icon: React.ReactNode; label: string; sub: string }) {
  return (
    <Link
      href={href}
      className="group relative mt-6 block rounded-[24px] bg-[#150A21] p-6 pt-8 shadow-2xl transition hover:-translate-y-1"
    >
      <div className="absolute -top-8 left-6 grid h-16 w-16 place-items-center overflow-hidden rounded-full border-4 border-[#0A0A0F] bg-[#150A21]">
        {icon}
      </div>
      <div>
        <h3 className="mt-2 text-lg font-bold text-white">{label}</h3>
        <p className="mt-2 text-sm text-[#9CA3AF]">{sub}</p>
      </div>
      <div className="mt-6 flex items-center justify-between">
        <span className="text-sm font-semibold text-[#A78BFA] transition group-hover:text-white">
          Keçid et →
        </span>
      </div>
    </Link>
  );
}

function HeroMotionOverlay() {
  const symbols: Array<{
    shape: "triangle" | "circle" | "cross" | "square";
    color: string;
    className: string;
    size: number;
    rotate: number;
    duration: number;
    delay: number;
  }> = [
    { shape: "triangle", color: "#34d399", className: "left-[6%] top-8", size: 92, rotate: -8, duration: 7.5, delay: 0 },
    { shape: "circle", color: "#f87171", className: "right-[8%] top-6", size: 80, rotate: 0, duration: 8.5, delay: 1.2 },
    { shape: "cross", color: "#60a5fa", className: "left-[42%] top-2", size: 70, rotate: 12, duration: 6.5, delay: 0.6 },
    { shape: "square", color: "#f472b6", className: "right-[28%] bottom-4", size: 64, rotate: -14, duration: 9, delay: 2 },
  ];

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {symbols.map((s, i) => (
        <span
          key={i}
          className={`ps-float absolute hidden sm:block ${s.className}`}
          style={
            {
              "--ps-rot": `${s.rotate}deg`,
              "--ps-dur": `${s.duration}s`,
              "--ps-delay": `${s.delay}s`,
            } as React.CSSProperties
          }
        >
          <PsGlyph shape={s.shape} color={s.color} size={s.size} />
        </span>
      ))}
    </div>
  );
}

function PsGlyph({
  shape,
  color,
  size,
}: {
  shape: "triangle" | "circle" | "cross" | "square";
  color: string;
  size: number;
}) {
  const stroke = Math.max(2, Math.round(size / 18));
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 64 64",
    fill: "none",
    stroke: color,
    strokeWidth: stroke,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (shape === "triangle") {
    return (
      <svg {...common}>
        <path d="M32 10 L54 50 H10 Z" />
      </svg>
    );
  }
  if (shape === "circle") {
    return (
      <svg {...common}>
        <circle cx="32" cy="32" r="22" />
      </svg>
    );
  }
  if (shape === "cross") {
    return (
      <svg {...common}>
        <path d="M14 14 L50 50 M50 14 L14 50" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="12" y="12" width="40" height="40" rx="2" />
    </svg>
  );
}

function MarqueeHeader({ text }: { text: string }) {
  const content = Array.from({ length: 15 }).map((_, i) => (
    <span key={i} className="mx-4 text-2xl font-bold tracking-[0.2em] text-white uppercase sm:text-4xl">
      {text} <span className="mx-4 text-white/30">•</span>
    </span>
  ));

  const duration = Math.max(text.length * 4, 30);

  return (
    <div className="relative flex w-full overflow-hidden border-y border-white/10 bg-[#12081C] py-5">
      <div className="flex whitespace-nowrap" style={{ animation: `marquee ${duration}s linear infinite` }}>
        <style>{`
          @keyframes marquee {
            0% { transform: translateX(0%); }
            100% { transform: translateX(-50%); }
          }
        `}</style>
        <div className="flex shrink-0">{content}</div>
        <div className="flex shrink-0">{content}</div>
      </div>
    </div>
  );
}

