import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getPrizeCatalog, getPrizeShowcase, getPublicOdds, getRecentWinners } from "@/lib/lootBoxes";
import { formatAzn } from "@/lib/lootBoxShared";
import { maskWinnerName } from "@/lib/giveawaysShared";
import { SITE_URL } from "@/lib/site";
import LootBoxClient from "./LootBoxClient";

export const revalidate = 300;

/**
 * Qutu detal səhifəsi.
 *
 * Qutu/ehtimal datası ISR ilə keşlənir (tag "loot-boxes"); istifadəçi vəziyyəti
 * client-də `useSession()` ilə gəlir ki, səhifə statik qalsın —
 * `cookies()`/`getCurrentUser()` bu ağaca girmir.
 */
const getBoxPageData = unstable_cache(
  async (slug: string) => {
    const box = await prisma.lootBox.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        imageUrl: true,
        priceAznCents: true,
        minPrizePct: true,
        maxPrizePct: true,
        sellBackPct: true,
        dailyLimitPerUser: true,
        isActive: true,
      },
    });
    if (!box || !box.isActive) return null;

    const [odds, winners, showcase, catalog, available] = await Promise.all([
      getPublicOdds(box.id),
      getRecentWinners(box.id, 12),
      getPrizeShowcase(box.id),
      getPrizeCatalog(box.id),
      prisma.lootBoxTicket.count({
        where: { status: "AVAILABLE", pool: { lootBoxId: box.id, status: "OPEN" } },
      }),
    ]);

    return {
      box: {
        slug: box.slug,
        title: box.title,
        description: box.description,
        imageUrl: box.imageUrl,
        priceAznCents: box.priceAznCents,
        minPrizeCents: Math.round((box.priceAznCents * box.minPrizePct) / 100),
        maxPrizeCents: Math.round((box.priceAznCents * box.maxPrizePct) / 100),
        sellBackPct: box.sellBackPct,
        dailyLimitPerUser: box.dailyLimitPerUser,
        inStock: available > 0,
      },
      odds,
      showcase,
      catalog,
      winners: winners.map((w) => ({
        id: w.id,
        name: maskWinnerName(w.user?.name),
        title: w.titleSnap,
        imageUrl: w.imageSnap,
        valueAznCents: w.valueAznCents,
        createdAt: w.createdAt.toISOString(),
      })),
    };
  },
  // Açar dəyişdi: köhnə keşdə `showcase` sahəsi yox idi və rulet lenti qutunun
  // öz adı ilə dolurdu. Sxem dəyişəndə açar da dəyişməlidir.
  ["loot-box-page-v3"],
  { tags: ["loot-boxes"], revalidate: 300 }
);

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const data = await getBoxPageData(params.slug).catch(() => null);
  if (!data) return { title: "Qutu tapılmadı — Honsell" };

  const { box } = data;
  const title = `${box.title} — ${formatAzn(box.priceAznCents)} qutu açılışı | Honsell`;
  const description =
    box.description ??
    `${formatAzn(box.priceAznCents)} ödə, ${formatAzn(box.minPrizeCents)} – ${formatAzn(
      box.maxPrizeCents
    )} dəyərində oyun qazan. Bütün şanslar açıq göstərilir.`;
  const url = `${SITE_URL}/qutu/${box.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      images: box.imageUrl ? [{ url: box.imageUrl }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: box.imageUrl ? [box.imageUrl] : undefined,
    },
  };
}

export default async function LootBoxPage({ params }: { params: { slug: string } }) {
  const data = await getBoxPageData(params.slug).catch(() => null);
  if (!data) notFound();

  return (
    <LootBoxClient
      box={data.box}
      odds={data.odds}
      winners={data.winners}
      showcase={data.showcase}
      catalog={data.catalog}
    />
  );
}
