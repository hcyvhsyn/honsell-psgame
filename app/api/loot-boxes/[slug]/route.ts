import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getPrizeShowcase, getPublicOdds, getRecentWinners } from "@/lib/lootBoxes";
import { maskWinnerName } from "@/lib/giveawaysShared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bir qutunun публик detalı: ehtimal cədvəli + son qazananlar lenti. */
export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const box = await prisma.lootBox.findUnique({
    where: { slug: params.slug },
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

  if (!box || !box.isActive) {
    return NextResponse.json({ error: "Qutu tapılmadı." }, { status: 404 });
  }

  const [odds, winners, showcase, available] = await Promise.all([
    getPublicOdds(box.id),
    getRecentWinners(box.id, 12),
    getPrizeShowcase(box.id),
    prisma.lootBoxTicket.count({
      where: { status: "AVAILABLE", pool: { lootBoxId: box.id, status: "OPEN" } },
    }),
  ]);

  return NextResponse.json({
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
      // Yalnız "bilet var / yoxdur" — dəqiq say açıqlanmır.
      inStock: available > 0,
    },
    odds,
    showcase,
    winners: winners.map((w) => ({
      id: w.id,
      name: maskWinnerName(w.user?.name),
      title: w.titleSnap,
      imageUrl: w.imageSnap,
      valueAznCents: w.valueAznCents,
      createdAt: w.createdAt.toISOString(),
    })),
  });
}
