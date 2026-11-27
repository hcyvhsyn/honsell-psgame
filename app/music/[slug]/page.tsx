import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SITE_NAME } from "@/lib/site";
import { PLAYSTATION_ONLY } from "@/lib/storeScope";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import StreamingServiceDetail from "@/components/StreamingServiceDetail";
import SpotifyPlanPicker from "@/components/SpotifyPlanPicker";
import {
  getStreamingPlatformBySlug,
  getStreamingPlatformsByCategory,
} from "@/lib/streamingPlatforms";
import { isValidSpotifyPlanTier } from "@/lib/platformSubscriptions";

export const revalidate = 1800;

type Params = { slug: string };

const SPOTIFY_SLUG = "spotify-premium";
const SPOTIFY_CANONICAL = "https://www.honsell.site/music/spotify-premium";
// Brend sonluğunu layout-un `title.template`-i əlavə edir.
const SPOTIFY_SEO_TITLE = "Spotify Premium 1 aylıq";
const SPOTIFY_SEO_DESCRIPTION =
  "Spotify Premium Individual paketini 1 aylıq aktiv edin. Reklamsız musiqi, offline dinləmə, limitsiz keçid və sürətli qoşulma. Honsell Store ilə rahat sifariş.";
const SPOTIFY_H1 = "Spotify Premium 1 aylıq — öz hesabına sürətli qoşulma";
const SPOTIFY_INTRO =
  "Spotify Premium Individual paketini öz hesabına qoşaraq reklamsız musiqi, offline dinləmə və limitsiz keçid imkanlarından istifadə et.";
const SPOTIFY_HERO_ALT = "Spotify Premium 1 aylıq Honsell Store";

/** FAQ — həm görünən bölmə, həm də FAQPage JSON-LD üçün tək mənbə. */
const SPOTIFY_FAQ: Array<{ q: string; a: string }> = [
  {
    q: "Spotify Premium necə qoşulur?",
    a: "Spotify Premium öz hesabına xarici region (Nigeriya/Misir) üzərindən aktivləşdirilir. Hesab məlumatlarını daxil edirsən, ödənişi tamamlayırsan və Premium statusu mövcud hesabına əlavə olunur — yeni hesab açmağa ehtiyac yoxdur.",
  },
  {
    q: "Qoşulma nə qədər vaxt aparır?",
    a: "Ortalama 1 saat. Sifariş sıxlığından asılı olaraq bu müddət bir qədər dəyişə bilər, lakin əksər aktivasiyalar qısa zamanda tamamlanır.",
  },
  {
    q: "Şəxsi hesabıma qoşulur?",
    a: "Bəli. Premium sənin öz Spotify hesabına qoşulur, beləliklə bütün pleylistlərin, izlədiklərin və kitabxanan olduğu kimi qalır.",
  },
  {
    q: "Premium dayansa nə olur?",
    a: "Premium statusu xarici region üzərindən aktiv edildiyi üçün nadir hallarda platforma tərəfindən dəyişdirilə bilər. Bu, Honsell Store-un nəzarətində olmayan haldır; məhz buna görə hazırda yalnız 1 aylıq paket təqdim olunur ki, riskin minimal olsun.",
  },
  {
    q: "Niyə yalnız 1 aylıq paket var?",
    a: "Uzunmüddətli paketlərdə region siyasəti dəyişə biləcəyi üçün şəffaflıq naminə yalnız 1 aylıq paket təklif edirik. Beləliklə hər ay statusu rahat yeniləyə bilərsən.",
  },
  {
    q: "Spotify Premium Individual nədir?",
    a: "Spotify Premium Individual bir nəfər üçün nəzərdə tutulmuş fərdi Premium planıdır: reklamsız musiqi, offline dinləmə və mahnılar arasında limitsiz keçid imkanı verir.",
  },
];

export async function generateStaticParams(): Promise<Array<Params>> {
  // Yalnız MUSIC kateqoriyalı xidmətlər (məs. YouTube Premium) bu route altında.
  const platforms = await getStreamingPlatformsByCategory("MUSIC");
  return platforms.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const svc = await getStreamingPlatformBySlug(slug);
  if (!svc) return { title: "Musiqi xidməti tapılmadı" };

  // Spotify Premium — SEO landing page üçün xüsusi metadata.
  if (slug === SPOTIFY_SLUG) {
    return {
      title: SPOTIFY_SEO_TITLE,
      description: SPOTIFY_SEO_DESCRIPTION,
      alternates: { canonical: SPOTIFY_CANONICAL },
      openGraph: {
        title: `${SPOTIFY_SEO_TITLE} | ${SITE_NAME}`,
        description: SPOTIFY_SEO_DESCRIPTION,
        url: SPOTIFY_CANONICAL,
        type: "website",
        images: svc.heroImageUrl ? [svc.heroImageUrl] : undefined,
      },
    };
  }

  const title = `${svc.label} — Musiqi Abunəliyi`;
  const url = `/music/${svc.slug}`;
  return {
    title,
    description: svc.description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: svc.description,
      url,
      images: svc.heroImageUrl ? [svc.heroImageUrl] : undefined,
    },
  };
}

/**
 * Bu musiqi platformasının çoxhesablı plan paketlərini (Spotify Individual/Duo/
 * Family kimi — `planTier` təyin olunmuş PLATFORM məhsulları) qaytarır. Heç biri
 * yoxdursa boş massiv → adi StreamingServiceDetail axını işləyir.
 */
async function getPlanProducts(brandCode: string) {
  const products = await prisma.serviceProduct.findMany({
    where: { type: "PLATFORM", isActive: true },
    orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
  });
  return products
    .filter((p) => {
      const m = (p.metadata as Record<string, unknown> | null) ?? {};
      return (
        String(m.musicBrand ?? "").toUpperCase() === brandCode &&
        isValidSpotifyPlanTier(String(m.planTier ?? "").toUpperCase())
      );
    })
    .map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      imageUrl: p.imageUrl,
      priceAznCents: p.priceAznCents,
      metadata: (p.metadata as Record<string, unknown> | null) ?? null,
    }));
}

export default async function MusicServicePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const svc = await getStreamingPlatformBySlug(slug);
  if (!svc) notFound();

  // STREAMING kateqoriyalı xidmətlər /streaming/[slug] altındadır.
  if (svc.category !== "MUSIC") {
    redirect(`/streaming/${svc.slug}`);
  }

  // Çoxhesablı plan paketləri varsa (məs. Spotify) — plan seçicini göstər.
  const planProducts = await getPlanProducts(svc.code);
  if (planProducts.length > 0) {
    const isSpotify = svc.slug === SPOTIFY_SLUG;
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        {isSpotify && <SpotifySeoJsonLd />}
        <SiteHeaderServer />

        <nav
          aria-label="Breadcrumb"
          className="mx-auto max-w-7xl px-4 pt-6 text-xs text-zinc-400 sm:px-6 lg:px-8"
        >
          <ol className="flex items-center gap-1.5">
            <li>
              <Link href="/" className="transition hover:text-white">
                Ana səhifə
              </Link>
            </li>
            <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
            {/* PS-only rejimdə /music siyahısı bağlıdır (lib/storeScope.ts) — keçid verilmir */}
            {!PLAYSTATION_ONLY && (
              <>
                <li>
                  <Link href="/music" className="transition hover:text-white">
                    Musiqi platformaları
                  </Link>
                </li>
                <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
              </>
            )}
            <li className="font-semibold text-white">{svc.label}</li>
          </ol>
        </nav>

        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
          <SpotifyPlanPicker
            products={planProducts}
            service={{
              code: svc.code,
              slug: svc.slug,
              label: svc.label,
              tagline: svc.tagline,
              description: svc.description,
              heroImageUrl: svc.heroImageUrl ?? null,
            }}
            seoHeading={isSpotify ? SPOTIFY_H1 : undefined}
            seoIntro={isSpotify ? SPOTIFY_INTRO : undefined}
            heroAlt={isSpotify ? SPOTIFY_HERO_ALT : undefined}
          />
        </section>

        {isSpotify && <SpotifySeoContent />}
      </main>
    );
  }

  return (
    <StreamingServiceDetail
      svc={svc}
      parent={{ href: "/music", label: "Musiqi platformaları" }}
      detailHref={`/music/${svc.slug}`}
    />
  );
}

/** FAQPage + Product JSON-LD — yalnız Spotify SEO səhifəsi üçün. */
function SpotifySeoJsonLd() {
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: SPOTIFY_FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Spotify Premium Individual 1 Ay",
    description: "Spotify Premium Individual 1 aylıq aktivasiya xidməti.",
    brand: { "@type": "Brand", name: "Honsell Store" },
    url: SPOTIFY_CANONICAL,
    offers: {
      "@type": "Offer",
      price: "6",
      priceCurrency: "AZN",
      availability: "https://schema.org/InStock",
      url: SPOTIFY_CANONICAL,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }}
      />
    </>
  );
}

/**
 * Spotify Premium üçün açar söz zəngin SEO məzmunu (paket, vacib məlumat,
 * sifariş addımları, FAQ). Server-rendered — interaktiv səbət axınına toxunmur,
 * mövcud yaşıl dizayn sistemindən istifadə edir. Yalnız H2/H3 başlıqlar.
 */
function SpotifySeoContent() {
  // Addımlar real alış axınıdır (səbət → ödəniş). Əvvəl burada "WhatsApp ilə bizə yazın"
  // yazılırdı və ayrıca "WhatsApp ilə sifariş et" düyməli ikinci paket kartı var idi — müştəri
  // iki alış yolu arasında çaşırdı (2026-11-də çıxarılıb).
  const steps = [
    "Yuxarıda planı seç və səbətə əlavə et.",
    "Spotify hesabının e-poçt və şifrəsini daxil et.",
    "Ödənişi tamamla.",
    "Ortalama 1 saat ərzində Premium aktivləşir.",
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <div className="grid gap-6">
        {/* Vacib məlumat bölməsi */}
        <div className="rounded-lg border border-amber-300/25 bg-zinc-900 p-6 sm:p-7">
          <h2 className="text-2xl font-black text-amber-700 dark:text-amber-200">Vacib məlumat</h2>
          <p className="mt-3 text-sm leading-relaxed text-amber-700 dark:text-amber-100">
            Spotify Premium hesabına xarici region üzərindən aktiv edilir.
            Aktivləşmə tamamlandıqdan sonra aldığın müddət hesabına əlavə
            olunur. Premium statusunun platforma tərəfindən dəyişdirilməsi və ya
            dayandırılması kimi hallar Honsell Store-un nəzarətində olmadığı üçün
            bu hallara görə məsuliyyət daşımırıq. Buna görə hazırda yalnız 1 aylıq
            paket təqdim olunur.
          </p>
        </div>
      </div>

      {/* Necə sifariş edilir */}
      <div className="mt-6 rounded-lg border border-violet-500/20 bg-zinc-900 p-6 sm:p-7">
        <h2 className="text-2xl font-black text-white">
          Spotify Premium necə sifariş edilir?
        </h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <li
              key={step}
              className="rounded-lg border border-violet-500/10 bg-zinc-800 p-4"
            >
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-violet-600 text-sm font-black text-white">
                {i + 1}
              </span>
              <p className="mt-3 text-sm leading-relaxed text-zinc-200">{step}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* FAQ */}
      <div className="mt-6 rounded-lg border border-violet-500/20 bg-zinc-900 p-6 sm:p-7">
        <h2 className="text-2xl font-black text-white">Tez-tez verilən suallar</h2>
        <div className="mt-5 grid gap-3">
          {SPOTIFY_FAQ.map((item) => (
            <details
              key={item.q}
              className="group rounded-lg border border-violet-500/10 bg-zinc-800 p-4"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-base font-black text-white">
                <h3 className="text-base font-black">{item.q}</h3>
                <ChevronRight className="h-4 w-4 shrink-0 text-violet-700 dark:text-violet-300 transition group-open:rotate-90" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
