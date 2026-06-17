import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import StreamingServiceDetail from "@/components/StreamingServiceDetail";
import {
  getStreamingPlatformBySlug,
  getStreamingPlatformsByCategory,
} from "@/lib/streamingPlatforms";

export const revalidate = 1800;

type Params = { slug: string };

export async function generateStaticParams(): Promise<Array<Params>> {
  // Yalnız STREAMING kateqoriyalı xidmətlər bu route altında listlənir.
  // MUSIC kateqoriyalı xidmətlər /music/[slug] altında yaşayır.
  // Yeni platformalar (DB-dən) dynamicParams ilə on-demand render olunur.
  const platforms = await getStreamingPlatformsByCategory("STREAMING");
  return platforms.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const svc = await getStreamingPlatformBySlug(slug);
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

export default async function StreamingServicePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const svc = await getStreamingPlatformBySlug(slug);
  if (!svc) notFound();

  // MUSIC kateqoriyalı xidmətlər (YouTube Premium) /music/[slug] altındadır —
  // köhnə link-lər üçün dərhal yönləndir.
  if (svc.category === "MUSIC") {
    redirect(`/music/${svc.slug}`);
  }

  return (
    <StreamingServiceDetail
      svc={svc}
      parent={{ href: "/streaming", label: "Streaming xidmətləri" }}
      detailHref={`/streaming/${svc.slug}`}
    />
  );
}
