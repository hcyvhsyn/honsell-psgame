import type { Metadata } from "next";
import { Clapperboard } from "lucide-react";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import ScrapedCatalogClient from "../(scraped)/ScrapedCatalogClient";
import { loadScrapedTitles } from "../(scraped)/loadScrapedTitles";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Film və Seriallar — Prime Video kataloqu",
  description:
    "Azərbaycanda Prime Video-da yayımlanan bütün filmlər və seriallar bir səhifədə. Növ, platforma və dil üzrə filtrlə.",
  alternates: { canonical: "/streaming/katalog" },
  openGraph: {
    title: "Film və Seriallar — Honsell",
    description: "Azərbaycanda mövcud streaming film və serialları bir yerdə.",
    url: "/streaming/katalog",
  },
};

type SearchParams = { kind?: string };

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { kind } = await searchParams;
  const initialKind = kind === "MOVIE" || kind === "SERIES" ? kind : "ALL";

  // Həm film, həm serial — kind filtri client tərəfdə daxildən tətbiq olunur.
  const titles = await loadScrapedTitles();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeaderServer />

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-200">
            <Clapperboard className="h-3.5 w-3.5" /> Film və Seriallar
          </div>
          <h1 className="mt-3 text-3xl font-black text-white sm:text-4xl">
            Film və Seriallar
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Azərbaycanda Prime Video-da mövcud olan kataloq. Yuxarıdakı keçiddən film/serial
            seçə, platforma və dil filtrlərini birgə tətbiq edə bilərsən.
          </p>
        </header>

        <ScrapedCatalogClient titles={titles} initialKind={initialKind} />
      </section>
    </main>
  );
}
