import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";
import { baseGameTitle, editionSearchPrefix, editionSuffixLabel, isSameGameFamily } from "@/lib/gameEditions";

export const runtime = "nodejs";

/**
 * Bir oyunun SÜRÜM namizədləri — reels formunda admin bunları təsdiqləyir.
 *
 * İki mərhələ, çünki baza başlığı SQL-də hesablaya bilmirik:
 *   1. RECALL  — `title startsWith <prefiks>` ilə geniş süzgəc (DB işi).
 *   2. PRECISION — `isSameGameFamily` ilə JS-də dəqiq süzgəc.
 * Prefiks qəsdən genişdir ("God of War Ragnarök" üçün "God of War Ragnarök"),
 * ona görə 2-ci mərhələ "God of War" kimi qohum-amma-fərqli oyunları atır.
 *
 * Nəticə UCUZDAN BAHAYA — admin ən ucuzu dərhal görür (feed də bu sıradadır).
 */
export async function GET(req: Request) {
  await requireAdmin();
  const url = new URL(req.url);
  const gameId = (url.searchParams.get("gameId") || "").trim();
  if (!gameId) {
    return NextResponse.json({ error: "gameId tələb olunur" }, { status: 400 });
  }

  const base = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, title: true, productType: true },
  });
  if (!base) return NextResponse.json({ error: "Oyun tapılmadı" }, { status: 404 });

  const prefix = editionSearchPrefix(base.title);
  if (!prefix) return NextResponse.json({ baseTitle: baseGameTitle(base.title), items: [] });

  const [candidates, settings] = await Promise.all([
    prisma.game.findMany({
      where: {
        isActive: true,
        // Sürümlər eyni məhsul tipində olur; DLC/valyuta sətirləri sürüm deyil.
        productType: base.productType,
        title: { startsWith: prefix, mode: "insensitive" },
      },
      // Geniş tut: "Resident Evil" prefiksi çox sətir tuta bilər, dəqiq süzgəc aşağıdadır.
      take: 200,
      select: {
        id: true,
        title: true,
        imageUrl: true,
        platform: true,
        store: true,
        priceTryCents: true,
        discountTryCents: true,
        discountEndAt: true,
        priceUsdCents: true,
        discountUsdCents: true,
      },
    }),
    getSettings(),
  ]);

  const items = candidates
    .filter((g) => isSameGameFamily(base.title, g.title))
    .map((g) => {
      const d = computeDisplayPrice(g, settings);
      const discounted = d.discountPct != null && d.discountPct > 0;
      return {
        id: g.id,
        title: g.title,
        imageUrl: g.imageUrl,
        platform: g.platform,
        editionName: editionSuffixLabel(g.title),
        finalAzn: d.finalAzn,
        originalAzn: discounted ? d.originalAzn : null,
        discountPct: discounted ? d.discountPct : null,
        /** Admin seçdiyi əsas oyun — UI-da onu ayırd etsin deyə. */
        isPrimary: g.id === base.id,
      };
    })
    .sort((a, b) => a.finalAzn - b.finalAzn);

  return NextResponse.json({ baseTitle: baseGameTitle(base.title), items });
}
