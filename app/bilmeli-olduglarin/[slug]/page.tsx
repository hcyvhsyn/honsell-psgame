import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen, Clock } from "lucide-react";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import { getAllGuideSlugs, getAllGuides, getGuideBySlug } from "@/lib/guides";
import { SITE_URL, SITE_NAME } from "@/lib/site";
import { prisma } from "@/lib/prisma";

type TierKey = "ESSENTIAL" | "EXTRA" | "DELUXE";
const TIER_ORDER: TierKey[] = ["ESSENTIAL", "EXTRA", "DELUXE"];
const TIER_LABEL: Record<TierKey, string> = {
  ESSENTIAL: "Essential",
  EXTRA: "Extra",
  DELUXE: "Deluxe",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatAzn(cents: number): string {
  return `${(cents / 100).toFixed(2)} ₼`;
}

async function buildPsPlusPricesHtml(): Promise<string> {
  const plans = await prisma.serviceProduct
    .findMany({
      where: { isActive: true, type: "PS_PLUS" },
      orderBy: [{ priceAznCents: "asc" }],
      select: { id: true, priceAznCents: true, metadata: true },
    })
    .catch(() => []);

  // For each tier, pick the cheapest plan per durationMonths bucket.
  const byTier: Record<TierKey, { months: number; cents: number }[]> = {
    ESSENTIAL: [],
    EXTRA: [],
    DELUXE: [],
  };

  for (const p of plans) {
    const meta = (p.metadata as Record<string, unknown> | null) ?? {};
    const tier = String(meta.tier ?? "").toUpperCase() as TierKey;
    const months = Number(meta.durationMonths ?? 0);
    if (!TIER_ORDER.includes(tier) || !months) continue;
    const existing = byTier[tier].find((r) => r.months === months);
    if (!existing || p.priceAznCents < existing.cents) {
      const idx = byTier[tier].findIndex((r) => r.months === months);
      const row = { months, cents: p.priceAznCents };
      if (idx >= 0) byTier[tier][idx] = row;
      else byTier[tier].push(row);
    }
  }

  const tiersWithData = TIER_ORDER.filter((t) => byTier[t].length > 0);
  if (tiersWithData.length === 0) {
    return `<div class="guide-price-empty">Hazırda PS Plus planları əlçatan deyil. <a href="/ps-plus">PS Plus səhifəsinə keçin</a> — ən son qiymətlər orada göstərilir.</div>`;
  }

  const cards = tiersWithData.map((tier) => {
    const rows = byTier[tier].sort((a, b) => a.months - b.months);
    const oneMonth = rows.find((r) => r.months === 1);
    const twelveMonth = rows.find((r) => r.months === 12);

    const rowsHtml: string[] = [];
    if (oneMonth) {
      rowsHtml.push(
        `<div class="guide-price-row"><span class="guide-price-row-label">1 ay</span><span class="guide-price-row-value">${escapeHtml(formatAzn(oneMonth.cents))}</span></div>`
      );
    }
    if (twelveMonth) {
      const monthlyEq = formatAzn(Math.round(twelveMonth.cents / 12));
      rowsHtml.push(
        `<div class="guide-price-row featured"><span class="guide-price-row-label">12 ay <span style="opacity:0.7;font-size:0.75rem">(ayda ${escapeHtml(monthlyEq)})</span></span><span class="guide-price-row-value">${escapeHtml(formatAzn(twelveMonth.cents))}</span></div>`
      );
    }
    // Fallback: any other duration we didn't expect — show as-is
    for (const r of rows) {
      if (r.months !== 1 && r.months !== 12) {
        rowsHtml.push(
          `<div class="guide-price-row"><span class="guide-price-row-label">${r.months} ay</span><span class="guide-price-row-value">${escapeHtml(formatAzn(r.cents))}</span></div>`
        );
      }
    }

    return `<div class="guide-price-card">
<div class="guide-price-card-tier">PS Plus</div>
<div class="guide-price-card-name">${escapeHtml(TIER_LABEL[tier])}</div>
<div class="guide-price-card-rows">${rowsHtml.join("")}</div>
</div>`;
  });

  return `<div class="guide-price-grid">${cards.join("")}</div>`;
}

export const revalidate = 3600;

export function generateStaticParams() {
  return getAllGuideSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) return { title: "Bələdçi tapılmadı", robots: { index: false } };

  const canonical = `/bilmeli-olduglarin/${encodeURIComponent(guide.slug)}`;

  return {
    title: guide.title,
    description: guide.description,
    keywords: guide.keywords,
    alternates: { canonical },
    openGraph: {
      type: "article",
      title: guide.title,
      description: guide.description,
      url: canonical,
      publishedTime: guide.publishedAt || undefined,
      modifiedTime: guide.updatedAt || undefined,
      authors: [SITE_NAME],
    },
    twitter: {
      card: "summary_large_image",
      title: guide.title,
      description: guide.description,
    },
  };
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) notFound();

  // Slug-specific dynamic content substitutions
  let contentHtml = guide.contentHtml;
  if (guide.slug === "ps-plus-essential-extra-deluxe-muqayisesi") {
    const pricesHtml = await buildPsPlusPricesHtml();
    // Replace the placeholder, including the surrounding <p> if marked wrapped it
    contentHtml = contentHtml.replace(
      /<p>\s*\{\{\s*PS_PLUS_PRICES\s*\}\}\s*<\/p>/g,
      pricesHtml
    );
    contentHtml = contentHtml.replace(/\{\{\s*PS_PLUS_PRICES\s*\}\}/g, pricesHtml);
  }

  const canonicalUrl = `${SITE_URL}/bilmeli-olduglarin/${encodeURIComponent(guide.slug)}`;

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    inLanguage: "az-AZ",
    url: canonicalUrl,
    datePublished: guide.publishedAt || undefined,
    dateModified: guide.updatedAt || guide.publishedAt || undefined,
    author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/icon.png` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
    keywords: guide.keywords.join(", "),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Ana səhifə", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Bilməli Olduqların", item: `${SITE_URL}/bilmeli-olduglarin` },
      { "@type": "ListItem", position: 3, name: guide.title, item: canonicalUrl },
    ],
  };

  // Suggest 3 other guides as cross-links
  const otherGuides = getAllGuides()
    .filter((g) => g.slug !== guide.slug)
    .slice(0, 3);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <SiteHeaderServer />

      <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <Link
          href="/bilmeli-olduglarin"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Bütün bələdçilər
        </Link>

        <header className="mt-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-200">
            <BookOpen className="h-3.5 w-3.5" />
            {guide.category}
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
            {guide.title}
          </h1>
          <p className="mt-3 text-base text-zinc-300 sm:text-lg">{guide.description}</p>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {guide.readingMinutes} dəqiqə oxu
            </span>
            {guide.publishedAt && (
              <>
                <span>·</span>
                <time dateTime={guide.publishedAt}>
                  {new Date(guide.publishedAt).toLocaleDateString("az-AZ", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
              </>
            )}
            {guide.updatedAt && guide.updatedAt !== guide.publishedAt && (
              <>
                <span>·</span>
                <span>
                  Yenilənib:{" "}
                  <time dateTime={guide.updatedAt}>
                    {new Date(guide.updatedAt).toLocaleDateString("az-AZ", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                </span>
              </>
            )}
          </div>
        </header>

        <hr className="my-8 border-white/10" />

        <div
          className="guide-prose"
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />

        {otherGuides.length > 0 && (
          <section className="mt-16 rounded-3xl border border-white/10 bg-zinc-900/40 p-6 sm:p-8">
            <h2 className="text-lg font-bold text-white sm:text-xl">Daha çox bələdçi</h2>
            <ul className="mt-4 space-y-3">
              {otherGuides.map((g) => (
                <li key={g.slug}>
                  <Link
                    href={`/bilmeli-olduglarin/${g.slug}`}
                    className="group flex items-start gap-3 rounded-xl border border-transparent p-3 transition hover:border-white/10 hover:bg-white/5"
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-indigo-500/10 text-indigo-300">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-100 group-hover:text-white">
                        {g.title}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">{g.description}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </main>
  );
}
