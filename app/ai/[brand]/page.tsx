import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Brain, ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import PlatformsPublicSection from "@/components/PlatformsPublicSection";
import { AI_BRAND_LABELS, type AiBrand } from "@/lib/platformSubscriptions";

export const dynamic = "force-dynamic";

type Params = { brand: string };

const BRAND_BY_SLUG: Record<string, Exclude<AiBrand, "OTHER">> = {
  claude: "CLAUDE",
  chatgpt: "CHATGPT",
};

const BRAND_DESCRIPTION: Record<Exclude<AiBrand, "OTHER">, string> = {
  CLAUDE: "Anthropic Claude Pro və Team abunəlikləri — uzun kontekst, kod yazma və yaradıcı yazı üçün ən güclü AI assistentlərindən biri.",
  CHATGPT: "OpenAI ChatGPT Plus və Pro abunəlikləri — GPT modelləri, şəkil yaratma və səs rejimi ilə tam funksional plan.",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { brand } = await params;
  const code = BRAND_BY_SLUG[brand.toLowerCase()];
  if (!code) return { title: "Tapılmadı" };
  const label = AI_BRAND_LABELS[code];
  return {
    title: `${label} abunəlikləri — Honsell`,
    description: BRAND_DESCRIPTION[code],
    alternates: { canonical: `/ai/${brand.toLowerCase()}` },
  };
}

export default async function AiBrandPage({ params }: { params: Promise<Params> }) {
  const { brand } = await params;
  const code = BRAND_BY_SLUG[brand.toLowerCase()];
  if (!code) notFound();
  const label = AI_BRAND_LABELS[code];

  const products = await prisma.serviceProduct.findMany({
    where: { type: "PLATFORM", isActive: true },
    orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
  });
  const filtered = products.filter((p) => {
    const m = (p.metadata as Record<string, unknown> | null) ?? {};
    return String(m.category ?? "") === "AI" && String(m.aiBrand ?? "") === code;
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeaderServer />
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <Link
          href="/ai"
          className="inline-flex items-center gap-1 text-sm text-zinc-400 transition hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" /> Süni intellekt
        </Link>
        <header className="mb-8 mt-4 flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-xl border border-fuchsia-400/30 bg-fuchsia-400/15 text-fuchsia-200">
            <Brain className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-3xl font-black text-white sm:text-4xl">{label}</h1>
            <p className="mt-1 max-w-3xl text-sm text-zinc-400">{BRAND_DESCRIPTION[code]}</p>
          </div>
        </header>
        <PlatformsPublicSection products={filtered} />
      </section>
    </main>
  );
}
