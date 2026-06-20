import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Check, ChevronRight } from "lucide-react";
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
const SPOTIFY_CANONICAL = "https://www.honsell.store/music/spotify-premium";
const SPOTIFY_SEO_TITLE = "Spotify Premium 1 Aylıq | Honsell Store";
const SPOTIFY_SEO_DESCRIPTION =
  "Spotify Premium Individual paketini 1 aylıq aktiv edin. Reklamsız musiqi, offline dinləmə, limitsiz keçid və sürətli qoşulma. Honsell Store ilə rahat sifariş.";
const SPOTIFY_H1 = "Spotify Premium 1 aylıq — şəxsi hesabınıza sürətli qoşulma";
const SPOTIFY_INTRO =
  "Spotify Premium Individual paketini şəxsi hesabınıza qoşaraq reklamsız musiqi, offline dinləmə və limitsiz keçid imkanlarından istifadə edin.";
const SPOTIFY_HERO_ALT = "Spotify Premium 1 aylıq Honsell Store";
const SPOTIFY_WHATSAPP_MSISDN = "994702560509";
const SPOTIFY_WHATSAPP_HREF = `https://wa.me/${SPOTIFY_WHATSAPP_MSISDN}?text=${encodeURIComponent(
  "Salam, Spotify Premium 1 aylıq paketini sifariş etmək istəyirəm.",
)}`;

/** FAQ — həm görünən bölmə, həm də FAQPage JSON-LD üçün tək mənbə. */
const SPOTIFY_FAQ: Array<{ q: string; a: string }> = [
  {
    q: "Spotify Premium necə qoşulur?",
    a: "Spotify Premium şəxsi hesabınıza xarici region (Nigeria/Misir) üzərindən aktivləşdirilir. Siz hesab məlumatlarınızı göndərirsiniz, ödənişi tamamlayırsınız və Premium statusu mövcud hesabınıza əlavə olunur — yeni hesab açmağa ehtiyac yoxdur.",
  },
  {
    q: "Qoşulma nə qədər vaxt aparır?",
    a: "Ortalama 1 saat. Sifariş sıxlığından asılı olaraq bu müddət bir qədər dəyişə bilər, lakin əksər aktivasiyalar qısa zamanda tamamlanır.",
  },
  {
    q: "Şəxsi hesabıma qoşulur?",
    a: "Bəli. Premium sizin öz Spotify hesabınıza qoşulur, beləliklə bütün pleylistləriniz, izlədikləriniz və kitabxananız olduğu kimi qalır.",
  },
  {
    q: "Premium dayansa nə olur?",
    a: "Premium statusu xarici region üzərindən aktiv edildiyi üçün nadir hallarda platforma tərəfindən dəyişdirilə bilər. Bu, Honsell Store-un nəzarətində olmayan haldır; məhz buna görə hazırda yalnız 1 aylıq paket təqdim olunur ki, riskiniz minimal olsun.",
  },
  {
    q: "Niyə yalnız 1 aylıq paket var?",
    a: "Uzunmüddətli paketlərdə region siyasəti dəyişə biləcəyi üçün şəffaflıq naminə yalnız 1 aylıq paket təklif edirik. Beləliklə hər ay statusu rahat yeniləyə bilərsiniz.",
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
        title: SPOTIFY_SEO_TITLE,
        description: SPOTIFY_SEO_DESCRIPTION,
        url: SPOTIFY_CANONICAL,
        type: "website",
        images: svc.heroImageUrl ? [svc.heroImageUrl] : undefined,
      },
    };
  }

  const title = `${svc.label} — Musiqi Abunəliyi | Honsell`;
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
      <main className="min-h-screen bg-[#020504] text-[#eafff0]">
        {isSpotify && <SpotifySeoJsonLd />}
        <SiteHeaderServer />

        <nav
          aria-label="Breadcrumb"
          className="mx-auto max-w-7xl px-4 pt-6 text-xs text-[#92a99a] sm:px-6 lg:px-8"
        >
          <ol className="flex items-center gap-1.5">
            <li>
              <Link href="/" className="transition hover:text-[#f7fff9]">
                Ana səhifə
              </Link>
            </li>
            <ChevronRight className="h-3.5 w-3.5 text-[#4d6254]" />
            <li>
              <Link href="/music" className="transition hover:text-[#f7fff9]">
                Musiqi platformaları
              </Link>
            </li>
            <ChevronRight className="h-3.5 w-3.5 text-[#4d6254]" />
            <li className="font-semibold text-[#dfffe8]">{svc.label}</li>
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
  const packageFeatures = [
    "Qiymət: 6 AZN",
    "Şəxsi Spotify hesabınıza qoşulur",
    "Ortalama 1 saata aktivləşir",
    "Reklamsız musiqi",
    "Offline dinləmə",
    "Limitsiz keçid",
    "Nigeria/Misir regionu üzərindən aktivasiya",
  ];

  const steps = [
    "WhatsApp ilə bizə yazın.",
    "Spotify hesab məlumatlarınızı göndərin.",
    "Ödənişi tamamlayın.",
    "Ortalama 1 saat ərzində aktivləşmə tamamlanır.",
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Paket bölməsi */}
        <div className="rounded-lg border border-[#1ed760]/20 bg-[#06120a] p-6 sm:p-7">
          <h2 className="text-2xl font-black text-[#f5fff7]">
            Spotify Premium Individual — 1 ay
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#95aa9b]">
            Spotify Premium 1 aylıq paketi şəxsi hesabınıza qoşulur. Ucuz qiymət,
            sürətli aktivasiya və reklamsız dinləmə təcrübəsi.
          </p>
          <ul className="mt-5 grid gap-2.5">
            {packageFeatures.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-[#d9f5df]">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#1ed760]" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a
              href={SPOTIFY_WHATSAPP_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#1ed760] px-5 text-sm font-black text-[#031007] transition hover:bg-[#38ef7d]"
            >
              WhatsApp ilə sifariş et
            </a>
            <a
              href="#spotify-plans"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-[#1ed760]/30 px-5 text-sm font-black text-[#d9f5df] transition hover:bg-[#102418]"
            >
              Paket məlumatlarına bax
            </a>
          </div>
        </div>

        {/* Vacib məlumat bölməsi */}
        <div className="rounded-lg border border-amber-300/25 bg-[#0e120c] p-6 sm:p-7">
          <h2 className="text-2xl font-black text-[#ffe8a9]">Vacib məlumat</h2>
          <p className="mt-3 text-sm leading-relaxed text-[#e0d5b5]">
            Spotify Premium hesabınıza xarici region üzərindən aktiv edilir.
            Aktivləşmə tamamlandıqdan sonra aldığınız müddət hesabınıza əlavə
            olunur. Premium statusunun platforma tərəfindən dəyişdirilməsi və ya
            dayandırılması kimi hallar Honsell Store-un nəzarətində olmadığı üçün
            bu hallara görə məsuliyyət daşımırıq. Buna görə hazırda yalnız 1 aylıq
            paket təqdim olunur.
          </p>
        </div>
      </div>

      {/* Necə sifariş edilir */}
      <div className="mt-6 rounded-lg border border-[#1ed760]/20 bg-[#06120a] p-6 sm:p-7">
        <h2 className="text-2xl font-black text-[#f5fff7]">
          Spotify Premium necə sifariş edilir?
        </h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <li
              key={step}
              className="rounded-lg border border-[#1ed760]/10 bg-[#0a1a10] p-4"
            >
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#1ed760] text-sm font-black text-[#031007]">
                {i + 1}
              </span>
              <p className="mt-3 text-sm leading-relaxed text-[#d9f5df]">{step}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* FAQ */}
      <div className="mt-6 rounded-lg border border-[#1ed760]/20 bg-[#06120a] p-6 sm:p-7">
        <h2 className="text-2xl font-black text-[#f5fff7]">Tez-tez verilən suallar</h2>
        <div className="mt-5 grid gap-3">
          {SPOTIFY_FAQ.map((item) => (
            <details
              key={item.q}
              className="group rounded-lg border border-[#1ed760]/10 bg-[#0a1a10] p-4"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-base font-black text-[#f5fff7]">
                <h3 className="text-base font-black">{item.q}</h3>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#7dffa9] transition group-open:rotate-90" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-[#95aa9b]">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
