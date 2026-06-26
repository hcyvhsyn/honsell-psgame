import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import StreamingServiceDetail from "@/components/StreamingServiceDetail";
import {
  getStreamingPlatformBySlug,
  getStreamingPlatformsByCategory,
} from "@/lib/streamingPlatforms";
import { getStreamingGroupParentSlug, isStreamingGroupChild } from "@/lib/streamingGroups";

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
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ secim?: string | string[] }>;
}) {
  const { slug } = await params;
  const { secim } = await searchParams;
  const groupSelection = Array.isArray(secim) ? secim[0] : secim;

  if (slug === "netflix-vvip") {
    redirect("/streaming/netflix-hesab");
  }

  const svc = await getStreamingPlatformBySlug(slug);
  if (!svc) notFound();

  // MUSIC kateqoriyalı xidmətlər (YouTube Premium) /music/[slug] altındadır —
  // köhnə link-lər üçün dərhal yönləndir.
  if (svc.category === "MUSIC") {
    redirect(`/music/${svc.slug}`);
  }

  // Qrup alt-paketidirsə (məs. netflix-yanimda) geri keçid parent-ə yönəlsin.
  // Kabinet uşaqları kabinet landing-inə (?secim=kabinet), digərləri (netflix-hesab)
  // isə birbaşa chooser-ə qayıdır.
  const parentSlug = getStreamingGroupParentSlug(svc.slug);
  let parent = { href: "/streaming", label: "Streaming xidmətləri" };
  if (parentSlug) {
    const parentSvc = await getStreamingPlatformBySlug(parentSlug);
    if (parentSvc) {
      const href = isStreamingGroupChild(svc.slug)
        ? `/streaming/${parentSvc.slug}?secim=kabinet`
        : `/streaming/${parentSvc.slug}`;
      parent = { href, label: parentSvc.label };
    }
  }

  return (
    <StreamingServiceDetail
      svc={svc}
      parent={parent}
      detailHref={`/streaming/${svc.slug}`}
      groupSelection={groupSelection}
    />
  );
}
