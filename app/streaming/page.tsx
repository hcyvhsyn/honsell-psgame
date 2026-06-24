import type { Metadata } from "next";
import Link from "next/link";
import { Tv, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import StreamingFeaturedBanner, { type FeaturedSlide } from "@/components/StreamingFeaturedBanner";
import StreamingTitleCard from "@/components/StreamingTitleCard";
import StreamingReviewsPreview from "@/components/StreamingReviewsPreview";
import PlatformGuidesSection from "@/components/PlatformGuidesSection";
import NewsSection from "@/components/NewsSection";
import { getStreamingPlatformsByCategory } from "@/lib/streamingPlatforms";
import { isStreamingGroupChild } from "@/lib/streamingGroups";
import { Music as MusicIcon } from "lucide-react";
import { PlatformCard } from "@/components/MarketingUI";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Streaming Xidmətləri — Netflix, HBO Max, Gain",
  description:
    "Netflix, HBO Max və Gain üçün Azərbaycanda yayımlanan filmlər və seriallar. Hər platformanın özünə məxsus səhifəsi.",
  alternates: { canonical: "/streaming" },
  openGraph: {
    title: "Streaming Platforması — Netflix, HBO Max, Gain | Honsell",
    description:
      "Hər streaming xidmətinin filmlərini və seriallarını bir yerdə kəşf et — Azərbaycandan rahat abunə ol.",
    url: "/streaming",
  },
};

function toSlideArr(rows: Array<{
  id: string;
  titleId: string;
  title: { id: string; title: string; service: string; kind: string; year: number | null; description: string | null; posterUrl: string | null; backdropUrl: string | null; genres: unknown; trailerUrl: string | null };
}>): FeaturedSlide[] {
  return rows.map((r) => ({
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
}

export default async function StreamingPage() {
  // Bu səhifə yalnız film/serial yönlü streaming xidmətlərini göstərir.
  // MUSIC kateqoriyalı xidmətlər (YouTube Premium) /music səhifəsində listlənir.
  // Qrup alt-paketləri (məs. netflix-yanimda) ana siyahıda gizlənir — onlar
  // yalnız parent seçim ekranı (/streaming/netflix) vasitəsilə açılır.
  const streamingPlatforms = (await getStreamingPlatformsByCategory("STREAMING")).filter(
    (p) => !isStreamingGroupChild(p.slug),
  );

  const [featuredOverview, allTitles] = await Promise.all([
    prisma.streamingFeatured.findMany({
      where: { scope: "OVERVIEW", isActive: true, title: { isActive: true, azAvailable: true } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: { title: true },
      take: 12,
    }),
    prisma.streamingTitle.findMany({
      where: { isActive: true, azAvailable: true },
      orderBy: [{ service: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  const slides = toSlideArr(featuredOverview);

  // Per-service title qruplaşdırması (overview rails üçün).
  const titlesByService = new Map<string, typeof allTitles>();
  for (const t of allTitles) {
    if (!titlesByService.has(t.service)) titlesByService.set(t.service, []);
    titlesByService.get(t.service)!.push(t);
  }

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ "@type": "ListItem", position: 1, name: "Streaming", item: "/streaming" }],
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <SiteHeaderServer />

      {/* Hero / featured banner */}
      <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        {slides.length > 0 ? (
          <StreamingFeaturedBanner slides={slides} />
        ) : (
          <div className="rounded-3xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-600/15 via-purple-700/10 to-zinc-900/40 p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-xs text-fuchsia-200">
              <Tv className="h-3.5 w-3.5" />
              Streaming xidmətləri
            </div>
            <h1 className="mt-4 text-3xl font-black text-white sm:text-4xl">
              Netflix · HBO Max · Gain
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Hər platformanın səhifəsinə keçid edib Azərbaycanda yayımlanan film və serialları kəşf et.
            </p>
          </div>
        )}
      </section>

      {/* Platforma navigatoru — satışda olan platformalar PS Store stili kart sırası */}
      <section className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8">
        <header className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Satışda olan platformalar</p>
          <h2 className="mt-1 text-2xl font-black text-white sm:text-3xl">Hansı platformaya keçid etmək istəyirsən?</h2>
        </header>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {streamingPlatforms.map((meta) => {
            const service = meta.code;
            const sample = titlesByService.get(service) ?? [];
            const cover = sample[0]?.backdropUrl ?? sample[0]?.posterUrl ?? null;
            const Icon = meta.category === "MUSIC" ? MusicIcon : Tv;
            return (
              <PlatformCard
                key={service}
                href={`/streaming/${meta.slug}`}
                icon={<Icon className="h-5 w-5 text-white" />}
                label={meta.label}
                sub={meta.tagline}
                imageUrl={cover}
                accentClass={
                  service === "NETFLIX"
                    ? "border-red-500/30 from-red-500/25 to-red-700/15"
                    : service === "HBO_MAX"
                      ? "border-purple-500/30 from-purple-500/25 to-fuchsia-500/15"
                      : service === "GAIN"
                        ? "border-rose-500/30 from-rose-500/25 to-orange-500/15"
                        : service === "PRIME_VIDEO"
                          ? "border-sky-500/30 from-sky-500/25 to-blue-600/15"
                          : "border-amber-500/30 from-amber-500/25 to-yellow-500/15"
                }
              />
            );
          })}
        </div>
      </section>

      {/* Per-platform sections (no pricing) */}
      <section className="mx-auto max-w-7xl space-y-12 px-4 py-14 sm:px-6 lg:px-8">
        {streamingPlatforms.map((meta) => {
          const service = meta.code;
          const titles = titlesByService.get(service) ?? [];
          if (titles.length === 0) return null;
          return (
            <section key={service} aria-labelledby={`section-${meta.slug}`}>
              <header className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">
                    {meta.category === "MUSIC" ? "Music" : "Streaming"}
                  </p>
                  <h2 id={`section-${meta.slug}`} className="mt-1 text-3xl font-black text-white sm:text-4xl">
                    {meta.label}
                  </h2>
                  <p className="mt-1 text-xs text-zinc-500">{meta.tagline}</p>
                </div>
                <Link
                  href={`/streaming/${meta.slug}`}
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Hamısına bax <ArrowRight className="h-4 w-4" />
                </Link>
              </header>

              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {titles.slice(0, 12).map((t) => (
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
            </section>
          );
        })}

        {allTitles.length === 0 && (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
            <Tv className="mx-auto h-10 w-10 text-zinc-600" />
            <p className="mt-3 text-sm text-zinc-400">
              Hələ heç bir film və ya serial əlavə olunmayıb.
            </p>
          </div>
        )}
      </section>

      {/* Community reviews preview */}
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-5">
          <h2 className="text-2xl font-black text-white sm:text-3xl">İcmallar</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Müştərilərimizin son rəyləri.
          </p>
        </header>
        <StreamingReviewsPreview limit={3} />
      </section>

      {/* News — STREAMING_OVERVIEW scope */}
      <NewsSection
        scope="STREAMING_OVERVIEW"
        title="Streaming xəbərləri"
        subtitle="Yeni serial və film anonsları, platforma yenilikləri və xüsusi endirimlər."
      />

      {/* Platform guides — STREAMING_OVERVIEW scope */}
      <PlatformGuidesSection scope="STREAMING_OVERVIEW" />
    </main>
  );
}
