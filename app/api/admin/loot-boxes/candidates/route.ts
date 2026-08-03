import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { findCandidates, lootBoxConfigOf, affordabilityFor, poolCostBudgetCents } from "@/lib/lootBoxes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bu qutuya uyğun namizəd oyunlar + BÜDCƏ KONTEKSTİ.
 *
 * Hər oyunun yanında göstərilir: bu oyundan büdcə neçə biletə imkan verir və
 * hovuzun hamısı bu oyundan olsa ziyan ediləcəkmi. Admin "10 AZN-lik oyun
 * əlavə etsəm nə olar?" sualının cavabını axtarmadan görür.
 */
export async function GET(req: Request) {
  await requireAdmin();

  const url = new URL(req.url);
  const boxId = url.searchParams.get("boxId") ?? "";
  const search = url.searchParams.get("q") ?? "";

  const box = await prisma.lootBox.findUnique({ where: { id: boxId } });
  if (!box) return NextResponse.json({ error: "Qutu tapılmadı." }, { status: 404 });

  const cfg = lootBoxConfigOf(box);
  const budgetCents = poolCostBudgetCents(cfg);
  const candidates = await findCandidates(box, { search, take: search ? 60 : 300 });

  // Orta bilet mayası: hovuz tam dolsa hər biletə düşən icazəli maya.
  const avgAffordableCost = Math.floor(budgetCents / Math.max(1, box.poolSize));

  return NextResponse.json({
    budgetCents,
    poolSize: box.poolSize,
    avgAffordableCost,
    minPrizeCents: cfg.priceAznCents * (cfg.minPrizePct / 100),
    maxPrizeCents: cfg.priceAznCents * (cfg.maxPrizePct / 100),
    total: candidates.length,
    candidates: candidates
      .map((c) => {
        const afford = affordabilityFor(c.costAznCents, cfg);
        return {
          ...c,
          maxTickets: afford.maxTickets,
          wholePoolAffordable: afford.wholePoolAffordable,
          costIfWholePool: afford.costIfWholePool,
          /**
           * Bu oyun "orta bilet"dən nə qədər bahadır. 100%-dən çoxdursa
           * hovuzun hamısı bundan ola bilməz — balanslaşdırmaq üçün daha ucuz
           * oyunlar lazımdır.
           */
          costVsAvgPct: avgAffordableCost > 0 ? (c.costAznCents / avgAffordableCost) * 100 : 0,
        };
      })
      .sort((a, b) => b.stars - a.stars || a.valueAznCents - b.valueAznCents),
  });
}
