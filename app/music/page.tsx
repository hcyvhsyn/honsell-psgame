import type { Metadata } from "next";
import { Music as MusicIcon, PlayCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import PlatformsPublicSection from "@/components/PlatformsPublicSection";
import { PlatformCard } from "@/components/MarketingUI";
import {
  STREAMING_SERVICE_META,
  STREAMING_SERVICES,
  type StreamingService,
} from "@/lib/streamingCart";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Musiqi Platformaları — Honsell",
  description:
    "YouTube Premium, Spotify, Apple Music və digər musiqi platformaları üçün abunəliklər.",
  alternates: { canonical: "/music" },
};

// /music səhifəsində göstəriləcək MUSIC kateqoriyalı streaming xidmətləri
// (məs. YouTube Premium). Bu xidmətlər ServiceProduct PLATFORM deyil — öz
// detal səhifəsinə (/streaming/[slug]) yönləndirilir.
const MUSIC_STREAMING_SERVICES = STREAMING_SERVICES.filter(
  (s) => STREAMING_SERVICE_META[s as StreamingService].category === "MUSIC"
);

export default async function MusicPage() {
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

        {MUSIC_STREAMING_SERVICES.length > 0 && (
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MUSIC_STREAMING_SERVICES.map((service) => {
              const meta = STREAMING_SERVICE_META[service as StreamingService];
              return (
                <PlatformCard
                  key={service}
                  href={`/music/${meta.slug}`}
                  icon={<PlayCircle className="h-5 w-5 text-white" />}
                  label={meta.label}
                  sub={meta.tagline}
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
