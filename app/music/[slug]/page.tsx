import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
    return (
      <main className="min-h-screen bg-[#020504] text-[#eafff0]">
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
          />
        </section>
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
