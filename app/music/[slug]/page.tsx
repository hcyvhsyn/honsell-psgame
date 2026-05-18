import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import StreamingServiceDetail from "@/components/StreamingServiceDetail";
import {
  getStreamingServiceBySlug,
  STREAMING_SERVICE_META,
  STREAMING_SERVICES,
  type StreamingService,
} from "@/lib/streamingCart";

export const revalidate = 1800;

type Params = { slug: string };

export function generateStaticParams(): Array<Params> {
  // Yalnız MUSIC kateqoriyalı xidmətlər (məs. YouTube Premium) bu route altında.
  return STREAMING_SERVICES.filter(
    (s) => STREAMING_SERVICE_META[s as StreamingService].category === "MUSIC"
  ).map((s) => ({ slug: STREAMING_SERVICE_META[s as StreamingService].slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const svc = getStreamingServiceBySlug(slug);
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
    },
  };
}

export default async function MusicServicePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const svc = getStreamingServiceBySlug(slug);
  if (!svc) notFound();

  // STREAMING kateqoriyalı xidmətlər /streaming/[slug] altındadır.
  if (svc.category !== "MUSIC") {
    redirect(`/streaming/${svc.slug}`);
  }

  return (
    <StreamingServiceDetail
      svc={svc}
      parent={{ href: "/music", label: "Musiqi platformaları" }}
      detailHref={`/music/${svc.slug}`}
    />
  );
}
