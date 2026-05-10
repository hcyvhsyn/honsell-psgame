import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Tv, Music, ChevronLeft, Film } from "lucide-react";
import { prisma } from "@/lib/prisma";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import StreamingPlanPicker from "@/components/StreamingPlanPicker";
import StreamingFeaturedBanner, { type FeaturedSlide } from "@/components/StreamingFeaturedBanner";
import StreamingTitleCard from "@/components/StreamingTitleCard";
import StreamingTopBar from "@/components/StreamingTopBar";
import StreamingReviewsPreview from "@/components/StreamingReviewsPreview";
import PlatformGuidesSection from "@/components/PlatformGuidesSection";
import NewsSection from "@/components/NewsSection";
import {
  getStreamingServiceBySlug,
  listStreamingServiceSlugs,
  type StreamingService,
} from "@/lib/streamingCart";

export const revalidate = 1800;

type Params = { slug: string };

export function generateStaticParams(): Array<Params> {
  return listStreamingServiceSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const svc = getStreamingServiceBySlug(slug);
  if (!svc) return { title: "Streaming xidməti tapılmadı" };
  const title = `${svc.label} — Filmlər və Seriallar | Honsell`;
  const url = `/streaming/${svc.slug}`;
  return {
    title,
    description: svc.description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: svc.description,
      url,
    },
  };
}

const HERO_THEME: Record<StreamingService, string> = {
  HBO_MAX: "border-purple-500/25 from-purple-600/20 via-fuchsia-600/10 to-zinc-900/40",
  GAIN: "border-rose-500/25 from-rose-600/20 via-orange-500/10 to-zinc-900/40",
  YOUTUBE_PREMIUM: "border-red-500/25 from-red-600/20 via-rose-500/10 to-zinc-900/40",
  NETFLIX: "border-red-700/30 from-red-800/30 via-zinc-900/30 to-zinc-950/40",
};

export default async function StreamingServicePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const svc = getStreamingServiceBySlug(slug);
  if (!svc) notFound();

  const [products, featured, titles] = await Promise.all([
    prisma.serviceProduct.findMany({
      where: { isActive: true, type: "STREAMING" },
      orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
      include: { _count: { select: { codes: { where: { isUsed: false } } } } },
    }),
    prisma.streamingFeatured.findMany({
      where: {
        scope: svc.code,
        isActive: true,
        title: { isActive: true, azAvailable: true, service: svc.code },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: { title: true },
      take: 12,
    }),
    prisma.streamingTitle.findMany({
      where: { service: svc.code, isActive: true, azAvailable: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 60,
    }),
  ]);

  const filtered = products.filter((p) => {
    const meta = (p.metadata as { service?: string } | null) ?? null;
    return (meta?.service ?? "").toUpperCase() === svc.code;
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

  const Icon = svc.category === "MUSIC" ? Music : Tv;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Streaming", item: "/streaming" },
      { "@type": "ListItem", position: 2, name: svc.label, item: `/streaming/${svc.slug}` },
    ],
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <SiteHeaderServer />

      <div className="mx-auto max-w-7xl px-4 pt-2 sm:px-6">
        <StreamingTopBar />
      </div>

      <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <Link
          href="/streaming"
          className="inline-flex items-center gap-1 text-sm text-zinc-400 transition hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" /> Streaming xidmətləri
        </Link>

        {/* Banner: featured varsa banner, yoxsa default hero */}
        <div className="mt-4">
          {slides.length > 0 ? (
            <StreamingFeaturedBanner slides={slides} />
          ) : (
            <div className={`rounded-3xl border bg-gradient-to-br p-8 ${HERO_THEME[svc.code] ?? "border-fuchsia-500/20 from-fuchsia-600/15 via-purple-700/10 to-zinc-900/40"}`}>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-zinc-200">
                <Icon className="h-3.5 w-3.5" />
                {svc.category === "MUSIC" ? "Music" : "Streaming"}
              </div>
              <h1 className="mt-4 text-3xl font-black text-white sm:text-4xl">{svc.label}</h1>
              <p className="mt-2 text-sm text-zinc-300 sm:text-base">{svc.tagline}</p>
              <p className="mt-4 max-w-3xl text-sm text-zinc-400">{svc.description}</p>
            </div>
          )}
        </div>
      </section>

      {/* Title catalog (only AZ-available) */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <header className="mb-6">
          <h2 className="text-2xl font-black text-white sm:text-3xl">
            Azərbaycanda yayımlananlar
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {svc.label} kataloqundan AZ region üçün açıq olan filmlər və seriallar.
          </p>
        </header>

        {titles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
            <Film className="mx-auto h-10 w-10 text-zinc-600" />
            <p className="mt-3 text-sm text-zinc-400">
              {svc.label} üçün hələ Azərbaycanda yayımlanan kontent əlavə olunmayıb.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {titles.map((t) => (
              <li key={t.id}>
                <StreamingTitleCard
                  title={{
                    id: t.id,
                    title: t.title,
                    kind: t.kind === "SERIES" ? "SERIES" : "MOVIE",
                    year: t.year,
                    posterUrl: t.posterUrl,
                    dubbedLanguages: Array.isArray(t.dubbedLanguages) ? (t.dubbedLanguages as string[]) : [],
                    subtitleLanguages: Array.isArray(t.subtitleLanguages) ? (t.subtitleLanguages as string[]) : [],
                    trailerUrl: t.trailerUrl,
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Plan selector (pricing) at bottom — alış burada baş verir */}
      <section id="plan-sec" className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
        <header className="mb-6">
          <h2 className="text-2xl font-black text-white sm:text-3xl">Plan seç</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Müddətini seç, ödənişdən sonra giriş məlumatları sənə göndəriləcək.
          </p>
        </header>
        {filtered.length === 0 ? (
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

      {/* Community reviews — yalnız bu xidmət üçün */}
      <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6">
        <header className="mb-5">
          <h2 className="text-2xl font-black text-white sm:text-3xl">{svc.label} icmalları</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Müştərilərimizin {svc.label}-da izlədikləri haqqında son rəyləri.
          </p>
        </header>
        <StreamingReviewsPreview service={svc.code} limit={3} />
      </section>

      {/* News — bu xidmətə spesifik xəbərlər */}
      <NewsSection
        scope={`STREAMING_${svc.code}`}
        title={`${svc.label} xəbərləri`}
        subtitle={`${svc.label} kataloqundan yeni anonslar, premyera tarixləri və xüsusi təkliflər.`}
      />

      {/* Faydalı başlıqlar — bu xidmətə spesifik bələdçilər */}
      <PlatformGuidesSection scope={`STREAMING_${svc.code}`} />
    </main>
  );
}
