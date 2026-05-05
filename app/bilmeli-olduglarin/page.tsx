import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Clock } from "lucide-react";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import { getAllGuides } from "@/lib/guides";
import { SITE_URL, SITE_NAME } from "@/lib/site";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Bilməli Olduqların — PlayStation Bələdçiləri",
  description:
    "Türkiyə PSN hesabı açmaq, PS Plus seçimi, PS Store-dan oyun almaq və daha çox — Azərbaycanlı PlayStation oyunçuları üçün addım-addım təlimatlar.",
  alternates: { canonical: "/bilmeli-olduglarin" },
  openGraph: {
    title: "PlayStation Bələdçiləri | Honsell PS Store",
    description: "Azərbaycandan PS oyunu almaq və hesab idarə etmək üçün hər şey.",
    url: "/bilmeli-olduglarin",
    type: "website",
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  PSN: "from-indigo-600/20 to-fuchsia-700/20 text-indigo-200 border-indigo-500/30",
  "PS Plus": "from-amber-600/20 to-orange-700/20 text-amber-200 border-amber-500/30",
  Hesab: "from-emerald-600/20 to-teal-700/20 text-emerald-200 border-emerald-500/30",
  Ümumi: "from-zinc-600/20 to-zinc-700/20 text-zinc-200 border-zinc-500/30",
};

export default function GuidesIndexPage() {
  const guides = getAllGuides();

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "PlayStation Bələdçiləri",
    numberOfItems: guides.length,
    itemListElement: guides.map((g, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/bilmeli-olduglarin/${encodeURIComponent(g.slug)}`,
      name: g.title,
    })),
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <SiteHeaderServer />

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-indigo-600/15 via-fuchsia-700/10 to-zinc-900/40 p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-200">
            <BookOpen className="h-3.5 w-3.5" />
            Bələdçilər
          </div>
          <h1 className="mt-4 text-3xl font-black text-white sm:text-4xl">
            Bilməli Olduqların
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400 sm:text-base">
            PSN hesabı, PS Plus, hədiyyə kartları və oyun alış-verişi üzrə addım-addım təlimatlar.{" "}
            {SITE_NAME} komandası tərəfindən hazırlanıb.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
        {guides.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 py-20 text-center text-zinc-500">
            Hələ heç bir bələdçi əlavə edilməyib.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {guides.map((g) => {
              const categoryClass =
                CATEGORY_COLORS[g.category] ?? CATEGORY_COLORS.Ümumi;
              return (
                <Link
                  key={g.slug}
                  href={`/bilmeli-olduglarin/${g.slug}`}
                  className="group flex flex-col rounded-3xl border border-white/10 bg-zinc-900/40 p-6 transition hover:-translate-y-1 hover:border-indigo-500/40 hover:bg-zinc-900/60"
                >
                  <div
                    className={`inline-flex w-fit items-center gap-1.5 rounded-full border bg-gradient-to-br px-3 py-1 text-xs font-semibold ${categoryClass}`}
                  >
                    {g.category}
                  </div>
                  <h2 className="mt-4 text-lg font-bold text-white sm:text-xl group-hover:text-indigo-200">
                    {g.title}
                  </h2>
                  <p className="mt-2 line-clamp-3 flex-1 text-sm text-zinc-400">
                    {g.description}
                  </p>
                  <div className="mt-4 flex items-center gap-3 text-xs text-zinc-500">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {g.readingMinutes} dəq oxu
                    </span>
                    {g.publishedAt && (
                      <>
                        <span>·</span>
                        <time dateTime={g.publishedAt}>
                          {new Date(g.publishedAt).toLocaleDateString("az-AZ", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </time>
                      </>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
