import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";
import { similarGameIds } from "@/lib/semantic-search";
import type { Game } from "@/lib/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Powers the "Bunları da bəyənə bilərsən" strip at the bottom of the cart.
 *
 * Two recommendation strategies, in order:
 *   1. **Semantic**: for each game/addon in the cart we pull its nearest
 *      embedding neighbors, union them by max similarity, and return the top
 *      results. This is the high-quality path — recommendations actually
 *      relate to what the user is buying.
 *   2. **Fallback**: when there are no cart game IDs (cart only has services),
 *      or when no embeddings exist yet (pre-backfill), we surface popular
 *      discounted games so the slot stays useful instead of disappearing.
 *
 * Response includes a `fallback: true` flag when the fallback strategy fired,
 * so the UI can adjust its subtitle accordingly.
 *
 * Query params:
 *   ids        comma-separated Game.id values (cart contents)
 *   limit      number of recommendations to return (default 6, max 12)
 */
const DEFAULT_PER_ITEM_K = 8;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const idsRaw = (url.searchParams.get("ids") ?? "").trim();
  const limit = Math.max(1, Math.min(12, Number(url.searchParams.get("limit")) || 6));

  const cartIds = idsRaw.split(",").map((s) => s.trim()).filter(Boolean);

  // Strategy 1 — semantic similarity off the cart's game IDs.
  let semanticRows: Game[] = [];
  if (cartIds.length > 0) {
    const bestScore = new Map<string, number>();
    for (const cartId of cartIds) {
      const hits = await similarGameIds(cartId, DEFAULT_PER_ITEM_K, {
        excludeIds: cartIds,
      }).catch(() => []);
      for (const h of hits) {
        const prev = bestScore.get(h.id);
        if (prev == null || h.score > prev) bestScore.set(h.id, h.score);
      }
    }

    if (bestScore.size > 0) {
      const ranked = [...bestScore.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit * 3) // overfetch — productType filter may drop rows
        .map(([id]) => id);

      const rows = await prisma.game.findMany({
        where: {
          id: { in: ranked },
          isActive: true,
          // Only recommend base games and DLCs; currency cards or themes
          // would be noise in a "you might also like" strip.
          productType: { in: ["GAME", "ADDON"] },
        },
      });
      const byId = new Map(rows.map((g) => [g.id, g]));
      semanticRows = ranked
        .map((id) => byId.get(id))
        .filter((r): r is Game => Boolean(r))
        .slice(0, limit);
    }
  }

  // Strategy 2 — fallback to popular/discounted games. Triggered when
  // semantic returned nothing (no cart games, no embeddings, or cart games
  // are unembedded themselves).
  const usedFallback = semanticRows.length === 0;
  let rows: Game[] = semanticRows;
  if (usedFallback) {
    // Prefer rows that are discounted AND featured — those are the most
    // commercially attractive recommendations for the cart context. If
    // there aren't enough, fill out with any featured games.
    const discountedFeatured = await prisma.game.findMany({
      where: {
        isActive: true,
        isFeatured: true,
        productType: "GAME",
        discountTryCents: { not: null },
        id: { notIn: cartIds.length > 0 ? cartIds : ["__none__"] },
      },
      orderBy: [{ lastScrapedAt: "desc" }],
      take: limit,
    });
    if (discountedFeatured.length < limit) {
      const more = await prisma.game.findMany({
        where: {
          isActive: true,
          isFeatured: true,
          productType: "GAME",
          id: {
            notIn: [
              ...cartIds,
              ...discountedFeatured.map((g) => g.id),
              "__none__",
            ],
          },
        },
        orderBy: [{ lastScrapedAt: "desc" }],
        take: limit - discountedFeatured.length,
      });
      rows = [...discountedFeatured, ...more];
    } else {
      rows = discountedFeatured;
    }
  }

  if (rows.length === 0) {
    return NextResponse.json({ results: [], fallback: usedFallback });
  }

  const settings = await getSettings();
  const results = rows.map((g) => {
    const price = computeDisplayPrice(g, settings);
    return {
      id: g.id,
      productId: g.productId,
      title: g.title,
      imageUrl: g.imageUrl,
      platform: g.platform,
      productType: g.productType,
      finalAzn: price.finalAzn,
      originalAzn: price.originalAzn,
      discountPct: price.discountPct,
      discountEndAt:
        g.discountTryCents != null && g.discountEndAt
          ? g.discountEndAt.toISOString()
          : null,
    };
  });

  return NextResponse.json({ results, fallback: usedFallback });
}
