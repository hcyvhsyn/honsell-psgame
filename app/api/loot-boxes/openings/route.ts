import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { sellBackAmountCents, prizeTierFor } from "@/lib/lootBoxShared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** İstifadəçinin öz qutu açılışları — profil bölməsi üçün. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Əvvəlcə hesabınıza daxil olun." }, { status: 401 });
  }

  const url = new URL(req.url);
  const pendingOnly = url.searchParams.get("pending") === "1";

  const openings = await prisma.lootBoxOpening.findMany({
    where: { userId: user.id, ...(pendingOnly ? { outcome: "PENDING_CHOICE" } : {}) },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: {
      id: true,
      orderCode: true,
      pricePaidCents: true,
      titleSnap: true,
      imageSnap: true,
      store: true,
      valueAznCents: true,
      outcome: true,
      sellBackCents: true,
      chosenAt: true,
      createdAt: true,
      lootBox: { select: { slug: true, title: true, sellBackPct: true } },
    },
  });

  return NextResponse.json({
    openings: openings.map((o) => ({
      id: o.id,
      orderCode: o.orderCode,
      boxSlug: o.lootBox.slug,
      boxTitle: o.lootBox.title,
      pricePaidCents: o.pricePaidCents,
      title: o.titleSnap,
      imageUrl: o.imageSnap,
      store: o.store,
      valueAznCents: o.valueAznCents,
      tier: prizeTierFor(o.valueAznCents, o.pricePaidCents),
      outcome: o.outcome,
      // Seçim gözləyənlər üçün təklif olunan kredit, artıq satılanlar üçün faktiki.
      sellBackCents: o.sellBackCents ?? sellBackAmountCents(o.valueAznCents, o.lootBox.sellBackPct),
      chosenAt: o.chosenAt?.toISOString() ?? null,
      createdAt: o.createdAt.toISOString(),
    })),
  });
}
