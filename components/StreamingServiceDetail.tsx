import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import StreamingPlanPicker from "@/components/StreamingPlanPicker";
import PlatformsPublicSection from "@/components/PlatformsPublicSection";
import StreamingFeaturedBanner, { type FeaturedSlide } from "@/components/StreamingFeaturedBanner";
import StreamingReviewsPreview from "@/components/StreamingReviewsPreview";
import PlatformGuidesSection from "@/components/PlatformGuidesSection";
import NewsSection from "@/components/NewsSection";
import type { StreamingServiceMeta } from "@/lib/streamingCart";

type Props = {
  svc: StreamingServiceMeta;
  /** Back link hədəfi və ad/label — yerləşdiyi parent route. */
  parent: { href: string; label: string };
  /** Detal səhifəsinin tam URL-i (canonical / breadcrumb üçün). */
  detailHref: string;
};

export default async function StreamingServiceDetail({
  svc,
  parent,
  detailHref,
}: Props) {
  const isMusic = svc.category === "MUSIC";

  const [products, featured] = await Promise.all([
    // Music kateqoriyasında paketlər PLATFORM tipində saxlanılır (musicBrand
    // ilə taglənir), digər streaming xidmətləri STREAMING tipində.
    prisma.serviceProduct.findMany({
      where: { isActive: true, type: isMusic ? "PLATFORM" : "STREAMING" },
      orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
      include: { _count: { select: { codes: { where: { isUsed: false } } } } },
    }),
    isMusic
      ? Promise.resolve([])
      : prisma.streamingFeatured.findMany({
          where: {
            scope: svc.code,
            isActive: true,
            title: { isActive: true, azAvailable: true, service: svc.code },
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
          include: { title: true },
          take: 12,
        }),
  ]);

  const filtered = products.filter((p) => {
    const meta = (p.metadata as Record<string, unknown> | null) ?? null;
    if (isMusic) {
      // Music xidmətləri üçün: category=MUSIC + musicBrand xidmət koduna uyğun.
      return (
        String(meta?.category ?? "") === "MUSIC" &&
        String(meta?.musicBrand ?? "") === svc.code
      );
    }
    return String(meta?.service ?? "").toUpperCase() === svc.code;
  });

  const slides: FeaturedSlide[] = featured.map((r) => ({
    id: r.id,
    titleId: r.titleId,
    title: r.title.title,
    service: r.title.service,
    kind: r.title.kind === "SERIES" ? "SERIES" : "MOVIE",
    year: r.title.year,
    description: r.title.description,
    posterUrl: r.title.posterUrl,
    backdropUrl: r.title.backdropUrl,
    genres: Array.isArray(r.title.genres) ? (r.title.genres as string[]) : [],
    trailerUrl: r.title.trailerUrl,
  }));

  const isYoutube = svc.code === "YOUTUBE_PREMIUM";

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: parent.label, item: parent.href },
      { "@type": "ListItem", position: 2, name: svc.label, item: detailHref },
    ],
  };


  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <SiteHeaderServer />

      <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <Link
          href={parent.href}
          className="inline-flex items-center gap-1 text-sm text-zinc-400 transition hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" /> {parent.label}
        </Link>

        <h1 className="sr-only">{svc.label} — {svc.tagline}</h1>

        {isMusic && svc.heroImageUrl && (
          <div className="mt-4 overflow-hidden rounded-3xl border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={svc.heroImageUrl} alt={svc.label} className="h-48 w-full object-cover sm:h-64" />
          </div>
        )}

        {!isMusic && slides.length > 0 && (
          <div className="mt-4">
            <StreamingFeaturedBanner slides={slides} />
          </div>
        )}
      </section>

      <section id="plan-sec" className="mx-auto max-w-7xl px-4 pb-14 pt-8 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h2 className="text-2xl font-black text-white sm:text-3xl">
            {isMusic ? `${svc.label} paketləri` : "Plan seç"}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {isMusic
              ? "Müddətini seç, sifarişdən sonra hesab məlumatları emailinə göndəriləcək."
              : "Müddətini seç, ödənişdən sonra giriş məlumatları sənə göndəriləcək."}
          </p>
        </header>
        {isYoutube ? (
          <StreamingPlanPicker
            productType="PLATFORM"
            authMode="GMAIL_PASSWORD"
            platformKind="YOUTUBE"
            heroImageUrl={svc.heroImageUrl ?? null}
            serviceOverride={{ code: svc.code, label: svc.label, tagline: svc.tagline, description: svc.description }}
            products={filtered.map((p) => ({
              id: p.id,
              title: p.title,
              description: p.description,
              imageUrl: p.imageUrl,
              priceAznCents: p.priceAznCents,
              metadata: (p.metadata as Record<string, unknown> | null) ?? null,
              availableStock: 0,
            }))}
          />
        ) : isMusic ? (
          <PlatformsPublicSection
            products={filtered.map((p) => ({
              id: p.id,
              title: p.title,
              description: p.description,
              imageUrl: p.imageUrl,
              priceAznCents: p.priceAznCents,
              metadata: (p.metadata as Record<string, unknown> | null) ?? null,
            }))}
          />
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center text-sm text-zinc-400">
            {svc.label} üçün aktiv plan yoxdur.
          </div>
        ) : (
          <StreamingPlanPicker
            products={filtered.map((p) => ({
              id: p.id,
              title: p.title,
              description: p.description,
              imageUrl: p.imageUrl,
              priceAznCents: p.priceAznCents,
              metadata: (p.metadata as Record<string, unknown> | null) ?? null,
              availableStock: p._count.codes,
            }))}
          />
        )}
      </section>

      {!isMusic && (
        <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
          <header className="mb-5">
            <h2 className="text-2xl font-black text-white sm:text-3xl">
              {svc.label} icmalları
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Müştərilərimizin {svc.label}-da izlədikləri haqqında son rəyləri.
            </p>
          </header>
          <StreamingReviewsPreview service={svc.code} limit={3} />
        </section>
      )}

      <NewsSection
        scope={`STREAMING_${svc.code}`}
        title={`${svc.label} xəbərləri`}
        subtitle={`${svc.label} kataloqundan yeni anonslar, premyera tarixləri və xüsusi təkliflər.`}
      />

      <PlatformGuidesSection scope={`STREAMING_${svc.code}`} />
    </main>
  );
}
