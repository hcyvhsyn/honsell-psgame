import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getPublicOdds } from "@/lib/lootBoxes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Публик qutu siyahısı — ana səhifə bölməsi və /qutular səhifəsi bunu çağırır.
 *
 * Qalan bilet SAYI heç vaxt qaytarılmır: yalnız faizlər. Qalan tərkib
 * açıqlansaydı müştəri hansı hədiyyələrin hovuzda qaldığını hesablaya bilərdi.
 */
export async function GET() {
  const boxes = await prisma.lootBox
    .findMany({
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
    })
    .catch(() => []);

  const withOdds = await Promise.all(
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
    }))
  );

  return NextResponse.json({ boxes: withOdds });
}
