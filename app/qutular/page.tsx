import type { Metadata } from "next";
import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getPrizeShowcase, getPublicOdds } from "@/lib/lootBoxes";
import { SITE_URL } from "@/lib/site";
import LootBoxCard, { type LootBoxCardData } from "@/components/LootBoxCard";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Qutu açılışı — təsadüfi oyun qazan | Honsell",
  description:
    "Qutunu aç və təsadüfi PlayStation oyunu qazan. Bütün qazanma şansları açıq göstərilir, istəmədiyin hədiyyəni balansa qaytara bilərsən.",
  alternates: { canonical: `${SITE_URL}/qutular` },
};

/** Aktiv qutular — ISR, tag "loot-boxes" ilə admin dəyişikliyində sıfırlanır. */
const getBoxes = unstable_cache(
  async (): Promise<LootBoxCardData[]> => {
    const boxes = await prisma.lootBox.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
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
      },
    });

    return Promise.all(
      boxes.map(async (box) => ({
        slug: box.slug,
        title: box.title,
        description: box.description,
        imageUrl: box.imageUrl,
        priceAznCents: box.priceAznCents,
        minPrizeCents: Math.round((box.priceAznCents * box.minPrizePct) / 100),
        maxPrizeCents: Math.round((box.priceAznCents * box.maxPrizePct) / 100),
        sellBackPct: box.sellBackPct,
        odds: await getPublicOdds(box.id).catch(() => []),
        showcase: await getPrizeShowcase(box.id).catch(() => []),
      }))
    );
  },
  // Açar dəyişdi — köhnə keşdə `showcase` sahəsi yoxdur.
  ["loot-boxes-list-v2"],
  { tags: ["loot-boxes"], revalidate: 300 }
);

export default async function LootBoxesPage() {
  const boxes = await getBoxes().catch(() => []);

  return (
    <div className="site-container py-10">
      <h1 className="text-3xl font-black text-slate-900 dark:text-white">Qutu açılışı</h1>
      <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-400">
        Qutunu aç və təsadüfi oyun qazan. Hər qutunun qazanma şansları tam açıq göstərilir —
        gizli heç nə yoxdur. Çıxan hədiyyəni istəmirsənsə, dəyərinin bir hissəsini balansa
        qaytara bilərsən.
      </p>

      {boxes.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-slate-300 px-6 py-16 text-center text-slate-500 dark:border-slate-700">
          Hazırda aktiv qutu yoxdur. Tezliklə!
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {boxes.map((box) => (
            <LootBoxCard key={box.slug} box={box} />
          ))}
        </div>
      )}
    </div>
  );
}
