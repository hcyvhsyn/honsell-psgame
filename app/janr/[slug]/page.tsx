import type { Metadata } from "next";
import { notFound } from "next/navigation";
import FacetLandingPage, {
  buildFacetMetadata,
  facetRobots,
} from "@/components/FacetLandingPage";
import { getFacet, facetSlugsUnder } from "@/lib/gameFacets";

export const revalidate = 600;

/** Janr facet-ləri konfiqurasiyadadır (lib/gameFacets.ts) — hamısı öncədən qurulur. */
export function generateStaticParams() {
  return facetSlugsUnder("janr").map((slug) => ({ slug }));
}

// Konfiqurasiyada olmayan janr slug-ı üçün səhifə yaradılmır.
export const dynamicParams = false;

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readPage(sp: Record<string, string | string[] | undefined>): number {
  const raw = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  return Math.max(1, Number(raw) || 1);
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const sp = (await searchParams) ?? {};
  const facetPath = `janr/${slug}`;
  if (!getFacet(facetPath)) return { title: "Səhifə tapılmadı", robots: { index: false } };

  const [meta, robots] = await Promise.all([
    buildFacetMetadata(facetPath, readPage(sp)),
    facetRobots(facetPath),
  ]);
  return robots ? { ...meta, robots } : meta;
}

export default async function Page({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = (await searchParams) ?? {};
  const facetPath = `janr/${slug}`;
  if (!getFacet(facetPath)) notFound();

  return <FacetLandingPage facetPath={facetPath} page={readPage(sp)} />;
}
