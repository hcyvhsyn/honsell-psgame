import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import StreamingServiceDetail from "@/components/StreamingServiceDetail";
import { prisma } from "@/lib/prisma";
import {
  getStreamingPlatformBySlug,
  getStreamingPlatformsByCategory,
} from "@/lib/streamingPlatforms";

export const revalidate = 1800;

type Params = { slug: string; variant: string };

/** Xidmət kodu üzrə aktiv variant (tier) slug→ad cədvəlini qaytarır. */
async function getVariantMap(serviceCode: string): Promise<Map<string, string>> {
  const products = await prisma.serviceProduct.findMany({
    where: { isActive: true, type: "STREAMING" },
    select: { metadata: true },
  });
  const map = new Map<string, string>();
  for (const p of products) {
    const m = (p.metadata as Record<string, unknown> | null) ?? null;
    if (!m) continue;
    if (String(m.service ?? "").toUpperCase() !== serviceCode) continue;
    const slug = typeof m.variantSlug === "string" ? m.variantSlug.trim() : "";
    const name = typeof m.variant === "string" ? m.variant.trim() : "";
    if (slug && name && !map.has(slug)) map.set(slug, name);
  }
  return map;
}

export async function generateStaticParams(): Promise<Array<Params>> {
  const platforms = await getStreamingPlatformsByCategory("STREAMING");
  const products = await prisma.serviceProduct.findMany({
    where: { isActive: true, type: "STREAMING" },
    select: { metadata: true },
  });
  const byCode = new Map<string, Set<string>>();
  for (const p of products) {
    const m = (p.metadata as Record<string, unknown> | null) ?? null;
    if (!m) continue;
    const code = String(m.service ?? "").toUpperCase();
    const slug = typeof m.variantSlug === "string" ? m.variantSlug.trim() : "";
    if (!code || !slug) continue;
    if (!byCode.has(code)) byCode.set(code, new Set());
    byCode.get(code)!.add(slug);
  }
  const params: Array<Params> = [];
  for (const pf of platforms) {
    const set = byCode.get(pf.code);
    if (!set) continue;
    for (const variant of set) params.push({ slug: pf.slug, variant });
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug, variant } = await params;
  const svc = await getStreamingPlatformBySlug(slug);
  if (!svc) return { title: "Streaming xidməti tapılmadı" };
  const variantName = (await getVariantMap(svc.code)).get(variant);
  if (!variantName) return { title: "Paket tapılmadı" };

  const title = `${svc.label} ${variantName} — qiymət və müddətlər | Honsell`;
  const url = `/streaming/${svc.slug}/${variant}`;
  const description = `${svc.label} ${variantName} paketi — müddət seç, ödənişdən sonra giriş məlumatları sənə göndərilir.`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url },
  };
}

export default async function StreamingVariantPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug, variant } = await params;
  const svc = await getStreamingPlatformBySlug(slug);
  if (!svc) notFound();

  // MUSIC kateqoriyalı xidmətlərin variantı yoxdur — köhnə link-lər /music-ə.
  if (svc.category === "MUSIC") {
    redirect(`/music/${svc.slug}`);
  }

  return (
    <StreamingServiceDetail
      svc={svc}
      parent={{ href: `/streaming/${svc.slug}`, label: svc.label }}
      detailHref={`/streaming/${svc.slug}`}
      variantSlug={variant}
    />
  );
}
