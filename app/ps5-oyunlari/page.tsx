import type { Metadata } from "next";
import FacetLandingPage, {
  buildFacetMetadata,
  facetRobots,
} from "@/components/FacetLandingPage";

const FACET_PATH = "ps5-oyunlari";

export const revalidate = 600;

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readPage(sp: Record<string, string | string[] | undefined>): number {
  const raw = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  return Math.max(1, Number(raw) || 1);
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const sp = (await searchParams) ?? {};
  const page = readPage(sp);
  const [meta, robots] = await Promise.all([
    buildFacetMetadata(FACET_PATH, page),
    facetRobots(FACET_PATH),
  ]);
  return robots ? { ...meta, robots } : meta;
}

export default async function Page({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  return <FacetLandingPage facetPath={FACET_PATH} page={readPage(sp)} />;
}
