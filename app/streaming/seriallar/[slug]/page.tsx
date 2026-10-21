import type { Metadata } from "next";
import { notFound } from "next/navigation";
import StreamingTitleDetailView from "@/components/streaming/StreamingTitleDetailView";
import { loadStreamingTitleDetail } from "@/lib/streamingTitleDetail";

// Kataloq kimi: 10 dəqiqəlik ISR — dil məlumatı validasiya/proyeksiya ilə yenilənir.
export const revalidate = 600;

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const detail = await loadStreamingTitleDetail(slug, "SERIES");
  if (!detail) return { title: "Tapılmadı | Honsell" };
  const title = `${detail.title}${detail.year ? ` (${detail.year})` : ""} — Azərbaycanda dublyaj və altyazı | Honsell`;
  const url = `/streaming/seriallar/${detail.slug}`;
  return {
    title,
    description: `${detail.title}: hansı dildə dublyaj və altyazı var — sezon-sezon, Azərbaycan üçün yoxlanılmış məlumat.`,
    alternates: { canonical: url },
    openGraph: { title, url, images: detail.posterUrl ? [detail.posterUrl] : undefined },
  };
}

export default async function TitleDetailPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const detail = await loadStreamingTitleDetail(slug, "SERIES");
  if (!detail) notFound();
  return <StreamingTitleDetailView detail={detail} />;
}
