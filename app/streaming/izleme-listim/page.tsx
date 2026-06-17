import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Heart, Film, Tv as TvIcon, ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import { getCurrentUser } from "@/lib/auth";
import WatchlistRemoveButton from "./WatchlistRemoveButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "İzləmə Listim — Streaming",
  description: "Sənin saxladığın film və seriallar.",
  alternates: { canonical: "/streaming/izleme-listim" },
};

export default async function WatchlistPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/streaming/izleme-listim");

  const items = await prisma.streamingTitleFavorite.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeaderServer />
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Link
          href="/streaming"
          className="inline-flex items-center gap-1 text-sm text-zinc-400 transition hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" /> Streaming
        </Link>

        <header className="mt-4 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              İzləmə Listim
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Sonradan izləmək üçün saxladığın film və seriallar.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-rose-500/15 px-3 py-1 text-sm font-semibold text-rose-200 ring-1 ring-rose-400/30">
            <Heart className="h-4 w-4 fill-current" /> {items.length}
          </span>
        </header>

        {items.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
            <Heart className="mx-auto h-10 w-10 text-zinc-600" />
            <p className="mt-3 text-sm text-zinc-400">
              İzləmə listin boşdur. Streaming icmallarından bəyəndiyin film/serialı əlavə et.
            </p>
            <Link
              href="/icma?tab=icmallar"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-bold text-zinc-900 hover:bg-zinc-100"
            >
              İcmallara bax →
            </Link>
          </div>
        ) : (
          <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {items.map((it) => {
              const Kind = it.kind === "SERIES" ? TvIcon : Film;
              return (
                <li key={it.id}>
                  <div className="group relative w-full overflow-hidden rounded-xl border border-white/10 bg-zinc-900 transition hover:-translate-y-0.5 hover:border-indigo-500/40">
                    <div className="relative aspect-[2/3] w-full">
                      {it.posterUrlSnap ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={it.posterUrlSnap}
                          alt={it.titleSnap}
                          loading="lazy"
                          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
                          <Kind className="h-10 w-10 text-zinc-700" />
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
                      <WatchlistRemoveButton
                        id={it.id}
                        tmdbId={it.tmdbId}
                        kind={it.kind}
                        titleSnap={it.titleSnap}
                      />
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="line-clamp-2 text-sm font-bold leading-tight text-white">
                          {it.titleSnap}
                        </p>
                        <p className="mt-1 text-[11px] text-zinc-400">
                          {it.kind === "SERIES" ? "Serial" : "Film"}
                          {it.yearSnap ? ` · ${it.yearSnap}` : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
