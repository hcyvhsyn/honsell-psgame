import type { Metadata } from "next";
import { Tv } from "lucide-react";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import StreamingTopBar from "@/components/StreamingTopBar";
import ScrapedCatalogClient from "../(scraped)/ScrapedCatalogClient";
import { loadScrapedTitles } from "../(scraped)/loadScrapedTitles";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Seriallar — Netflix, HBO Max, Prime Video, Gain",
  description:
    "Azərbaycanda yayımlanan seriallar — Netflix, HBO Max, Prime Video və Gain kataloqundan birləşik siyahı. Dil və platforma üzrə filtrlə.",
  alternates: { canonical: "/streaming/seriallar" },
  openGraph: {
    title: "Streaming Serialları — Honsell",
    description: "Bütün streaming platformlarındakı serialları bir yerdə tap.",
    url: "/streaming/seriallar",
  },
};

export default async function SeriesPage() {
  const titles = await loadScrapedTitles("SERIES");

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeaderServer />

      <div className="mx-auto max-w-7xl px-4 pt-2 sm:px-6 lg:px-8">
        <StreamingTopBar />
      </div>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs text-rose-200">
            <Tv className="h-3.5 w-3.5" /> Seriallar
          </div>
          <h1 className="mt-3 text-3xl font-black text-white sm:text-4xl">
            Bütün seriallar — 4 platforma birləşik
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Netflix, HBO Max, Prime Video və Gain-dəki Azərbaycan kataloqu. Platforma və dil
            filtrini birgə tətbiq edə bilərsən.
          </p>
        </header>

        <ScrapedCatalogClient kind="SERIES" titles={titles} />
      </section>
    </main>
  );
}
