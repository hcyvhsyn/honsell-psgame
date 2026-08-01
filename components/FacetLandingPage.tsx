import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import SiteFooter from "@/components/SiteFooter";
import GameBrowser from "@/components/GameBrowser";
import FaqAccordion from "@/components/FaqAccordion";
import GameCard from "@/components/GameCard";
import { SITE_URL, SITE_NAME } from "@/lib/site";
import {
  ALL_FACETS,
  getFacet,
  facetToApiParams,
  FACET_MIN_PRODUCTS_FOR_INDEX,
  type Facet,
} from "@/lib/gameFacets";
import { getFacetCatalog, getFacetCounts, FACET_PAGE_SIZE } from "@/lib/facetCatalog";
import { gameDetailHref } from "@/lib/gameSlug";
import { getSettings } from "@/lib/pricing";

function facetUrl(path: string, page = 1): string {
  return page > 1 ? `/${path}?page=${page}` : `/${path}`;
}

/**
 * Facet səhifəsinin metadata-sı. Bütün facet route-ları bunu çağırır.
 *
 * SƏHİFƏLƏMƏ CANONICAL QAYDASI: 2-ci və sonrakı səhifələr ÖZLƏRİNƏ canonical
 * verir, 1-ci səhifəyə YOX. Ən çox edilən səhv budur — hamısını 1-ci səhifəyə
 * canonical etsək, 2+ səhifələrdəki oyunlar heç vaxt indekslənməz.
 */
export async function buildFacetMetadata(
  facetPath: string,
  page: number
): Promise<Metadata> {
  const facet = getFacet(facetPath);
  if (!facet) return { title: "Səhifə tapılmadı", robots: { index: false } };

  const pageSuffix = page > 1 ? ` — səhifə ${page}` : "";
  const canonical = facetUrl(facetPath, page);

  return {
    title: `${facet.title}${pageSuffix}`,
    description: facet.description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      title: `${facet.title}${pageSuffix} | ${SITE_NAME}`,
      description: facet.description,
      url: canonical,
    },
  };
}

function Breadcrumbs({ facet }: { facet: Facet }) {
  const segments = facet.path.split("/");
  const parentPath = segments.length > 1 ? segments[0] : null;
  const parentFacet = parentPath ? getFacet(parentPath) : null;

  return (
    <nav aria-label="Naviqasiya" className="mb-4 text-sm text-zinc-500 dark:text-zinc-500">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-200">
            Ana səhifə
          </Link>
        </li>
        <li aria-hidden>/</li>
        <li>
          <Link href="/oyunlar" className="hover:text-zinc-900 dark:hover:text-zinc-200">
            Oyunlar
          </Link>
        </li>
        {parentFacet && (
          <>
            <li aria-hidden>/</li>
            <li>
              <Link
                href={`/${parentFacet.path}`}
                className="hover:text-zinc-900 dark:hover:text-zinc-200"
              >
                {parentFacet.h1}
              </Link>
            </li>
          </>
        )}
        <li aria-hidden>/</li>
        <li className="font-medium text-zinc-900 dark:text-zinc-200">{facet.h1}</li>
      </ol>
    </nav>
  );
}

export default async function FacetLandingPage({
  facetPath,
  page = 1,
}: {
  facetPath: string;
  page?: number;
}) {
  const facet = getFacet(facetPath);
  if (!facet) notFound();

  // `getSettings` React cache()-dir → sorğu əhatəsinə bağlıdır, ona görə
  // unstable_cache-in İÇİNDƏ deyil, burada oxunur (bax: lib/facetCatalog.ts).
  const settings = await getSettings();
  const { cards, total, totalPages } = await getFacetCatalog(
    facet.path,
    facet.filter,
    page,
    settings
  );

  // Mövcud olmayan səhifə nömrəsi → 404 (sonsuz boş səhifə seriyası
  // yaratmamaq üçün; belə səhifələr crawl büdcəsini yeyir).
  if (page > 1 && cards.length === 0) notFound();

  const canonicalUrl = `${SITE_URL}${facetUrl(facet.path, page)}`;
  const lockedFilters = facetToApiParams(facet.filter);

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: facet.h1,
    description: facet.description,
    numberOfItems: total,
    url: canonicalUrl,
    itemListElement: cards.slice(0, 24).map((c, i) => ({
      "@type": "ListItem",
      position: (page - 1) * FACET_PAGE_SIZE + i + 1,
      url: `${SITE_URL}${gameDetailHref(c) ?? "/oyunlar"}`,
      name: c.title,
      offers: {
        "@type": "Offer",
        priceCurrency: "AZN",
        price: c.finalAzn.toFixed(2),
        availability: "https://schema.org/InStock",
        seller: { "@type": "Organization", name: SITE_NAME },
      },
    })),
  };

  const segments = facet.path.split("/");
  const parentFacet = segments.length > 1 ? getFacet(segments[0]) : null;
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Ana səhifə", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Oyunlar", item: `${SITE_URL}/oyunlar` },
      ...(parentFacet
        ? [
            {
              "@type": "ListItem",
              position: 3,
              name: parentFacet.h1,
              item: `${SITE_URL}/${parentFacet.path}`,
            },
          ]
        : []),
      {
        "@type": "ListItem",
        position: parentFacet ? 4 : 3,
        name: facet.h1,
        item: `${SITE_URL}/${facet.path}`,
      },
    ],
  };

  const faqJsonLd =
    facet.faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: facet.faq.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }
      : null;

  const initial = {
    total,
    totalAll: total,
    totalOnSale: 0,
    totals: { GAME: 0, ADDON: 0, CURRENCY: 0, OTHER: 0 },
    count: cards.length,
    results: cards,
    page,
    pageSize: FACET_PAGE_SIZE,
    totalPages,
  };

  // Boş facet-ə keçid vermək istifadəçini boş səhifəyə aparır — həm "əlaqəli
  // kateqoriyalar" bloku, həm də filtr panelindəki siyahı sayğaca görə süzülür.
  const facetCounts = await getFacetCounts(ALL_FACETS, settings).catch(
    () => ({}) as Record<string, number>
  );
  const hasProducts = (p: string) => (facetCounts[p] ?? 0) > 0;

  const relatedFacets = facet.related
    .map((p) => getFacet(p))
    .filter((f): f is Facet => f !== null && hasProducts(f.path));

  // Filtr panelindəki kateqoriya siyahısı — cari səhifə öz siyahısında görünmür.
  const categoryLinks = ALL_FACETS.filter(
    (f) => f.path !== facet.path && hasProducts(f.path)
  ).map((f) => ({ path: f.path, label: f.h1 }));

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}

      <SiteHeaderServer />

      <section className="mx-auto w-full max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        <Breadcrumbs facet={facet} />

        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
          {facet.h1}
          {page > 1 && (
            <span className="ml-2 text-lg font-normal text-zinc-500">— səhifə {page}</span>
          )}
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {total.toLocaleString("az-AZ")} oyun
        </p>

        {/* Unikal giriş mətni. Yalnız 1-ci səhifədə — hər səhifədə təkrarlansa,
            səhifələnmiş nəticələr bir-birinin dublikatına çevrilir. */}
        {page === 1 && (
          <div className="mt-5 max-w-3xl">
            {facet.intro.split(/\n{2,}/).map((para, i) => (
              <p
                key={i}
                className="mb-3 text-sm leading-relaxed text-zinc-700 last:mb-0 dark:text-zinc-300"
              >
                {para}
              </p>
            ))}
          </div>
        )}
      </section>

      {/* Server-render olunmuş ilk səhifə: crawler bunu JS icra etmədən görür.
          Client komponent hidrasiyadan sonra eyni siyahını öz üzərinə götürür. */}
      <noscript>
        <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {cards.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        </section>
      </noscript>

      <section className="mx-auto w-full max-w-7xl px-4 pb-10 pt-8 sm:px-6 lg:px-8">
        <GameBrowser
          initial={initial}
          lockedFilters={lockedFilters}
          categoryLinks={categoryLinks}
        />
      </section>

      {/* Səhifələmə — crawler üçün REAL <a> keçidləri. GameBrowser öz
          səhifələməsini client-side edir, amma o keçidləri crawler görmür. */}
      {totalPages > 1 && (
        <nav
          aria-label="Səhifələr"
          className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6 lg:px-8"
        >
          <ul className="flex flex-wrap items-center gap-2 text-sm">
            {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((p) => (
              <li key={p}>
                <Link
                  href={facetUrl(facet.path, p)}
                  aria-current={p === page ? "page" : undefined}
                  className={
                    p === page
                      ? "rounded-lg bg-zinc-900 px-3 py-1.5 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "rounded-lg border border-zinc-200 px-3 py-1.5 text-zinc-700 transition hover:border-zinc-300 dark:border-zinc-800 dark:text-zinc-300"
                  }
                >
                  {p}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* FAQ — həm istifadəçi üçün, həm FAQPage structured data üçün.
          Yalnız 1-ci səhifədə, dublikat olmasın deyə. */}
      {page === 1 && facet.faq.length > 0 && (
        <section className="mx-auto w-full max-w-3xl px-4 pb-12 sm:px-6 lg:px-8">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-200">
            Tez-tez verilən suallar
          </h2>
          <FaqAccordion
            items={facet.faq.map((f, i) => ({
              id: `${facet.path}-faq-${i}`,
              question: f.q,
              answer: f.a,
            }))}
          />
        </section>
      )}

      {/* Daxili keçid şəbəkəsi — facet-lər bir-birini gücləndirir və crawler
          yeni səhifələri buradan tapır. */}
      {relatedFacets.length > 0 && (
        <section className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-200">
            Əlaqəli kateqoriyalar
          </h2>
          <ul className="flex flex-wrap gap-2">
            {relatedFacets.map((f) => (
              <li key={f.path}>
                <Link
                  href={`/${f.path}`}
                  className="inline-flex rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                >
                  {f.h1}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <SiteFooter />
    </main>
  );
}

/**
 * Nazik səhifə qoruması: məhsul sayı həddən aşağıdırsa `noindex`.
 * Route-lar bunu `generateMetadata`-da çağırır.
 */
export async function facetRobots(
  facetPath: string
): Promise<Metadata["robots"] | undefined> {
  const facet = getFacet(facetPath);
  if (!facet) return { index: false, follow: false };
  const settings = await getSettings();
  const { total } = await getFacetCatalog(facet.path, facet.filter, 1, settings);
  if (total < FACET_MIN_PRODUCTS_FOR_INDEX) {
    // Səhifə işləməyə davam edir (keçidlə gələn istifadəçi görür), amma
    // indeksə düşmür — az məhsullu səhifə bütün domenin qiymətini aşağı salır.
    return { index: false, follow: true };
  }
  return undefined;
}
