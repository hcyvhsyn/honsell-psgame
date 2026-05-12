import type { Metadata } from "next";
import { Film } from "lucide-react";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import StreamingTopBar from "@/components/StreamingTopBar";
import ScrapedCatalogClient from "../(scraped)/ScrapedCatalogClient";
import { loadScrapedTitles } from "../(scraped)/loadScrapedTitles";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Filmlər — Netflix, HBO Max, Prime Video, Gain",
  description:
    "Azərbaycanda yayımlanan filmlər — Netflix, HBO Max, Prime Video və Gain kataloqundan birləşik siyahı. Dil və platforma üzrə filtrlə.",
  alternates: { canonical: "/streaming/filmler" },
  openGraph: {
    title: "Streaming Filmləri — Honsell",
    description: "Bütün streaming platformlarındakı filmləri bir yerdə tap.",
    url: "/streaming/filmler",
  },
};

export default async function FilmsPage() {
  const titles = await loadScrapedTitles("MOVIE");

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeaderServer />

      <div className="mx-auto max-w-7xl px-4 pt-2 sm:px-6">
        <StreamingTopBar />
      </div>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <header className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-200">
            <Film className="h-3.5 w-3.5" /> Filmlər
          </div>
          <h1 className="mt-3 text-3xl font-black text-white sm:text-4xl">
            Bütün filmlər — 4 platforma birləşik
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Netflix, HBO Max, Prime Video və Gain-dəki Azərbaycan kataloqu. Platforma və dil
            filtrini birgə tətbiq edə bilərsən.
          </p>
        </header>

        <ScrapedCatalogClient kind="MOVIE" titles={titles} />
      </section>
    </main>
  );
}
