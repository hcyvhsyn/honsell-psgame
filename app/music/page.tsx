import type { Metadata } from "next";
import { Music as MusicIcon, PlayCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import PlatformsPublicSection from "@/components/PlatformsPublicSection";
import { PlatformCard } from "@/components/MarketingUI";
import { getStreamingPlatformsByCategory } from "@/lib/streamingPlatforms";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Musiqi Platformaları — Honsell",
  description:
    "YouTube Premium, Spotify, Apple Music və digər musiqi platformaları üçün abunəliklər.",
  alternates: { canonical: "/music" },
};

export default async function MusicPage() {
  // /music səhifəsində göstəriləcək MUSIC kateqoriyalı platformalar
  // (məs. YouTube Premium). Bu xidmətlər öz detal səhifəsinə (/music/[slug]) yönlənir.
  const musicPlatforms = await getStreamingPlatformsByCategory("MUSIC");

  const products = await prisma.serviceProduct.findMany({
    where: { type: "PLATFORM", isActive: true },
    orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
  });
  // /music əsas listingində yalnız markasız ("Ümumi") paketlər göstərilir.
  // Brandlı paketlər (məs. YouTube Premium) öz alt-səhifəsində listlənir.
  const filtered = products.filter((p) => {
    const m = (p.metadata as Record<string, unknown> | null) ?? {};
    if (String(m.category ?? "") !== "MUSIC") return false;
    const brand = String(m.musicBrand ?? "GENERIC");
    return brand === "GENERIC";
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeaderServer />
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <header className="mb-8 flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-xl border border-emerald-400/30 bg-emerald-400/15 text-emerald-200">
            <MusicIcon className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-3xl font-black text-white sm:text-4xl">Musiqi Platformaları</h1>
            <p className="mt-1 text-sm text-zinc-400">
              YouTube Premium, Spotify, Apple Music və digər musiqi xidmətləri üçün
              abunəliklər. Sifarişdən sonra admin tərəfindən hesab məlumatları emailinə göndərilir.
            </p>
          </div>
        </header>

        {musicPlatforms.length > 0 && (
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {musicPlatforms.map((meta) => {
              const service = meta.code;
              return (
                <PlatformCard
                  key={service}
                  href={`/music/${meta.slug}`}
                  icon={<PlayCircle className="h-5 w-5 text-white" />}
                  label={meta.label}
                  sub={meta.tagline}
                  imageUrl={meta.heroImageUrl ?? null}
                  accentClass="border-red-500/30 from-red-500/25 to-rose-500/15"
                />
              );
            })}
          </div>
        )}

        <PlatformsPublicSection products={filtered} />
      </section>
    </main>
  );
}
