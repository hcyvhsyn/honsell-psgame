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
 *   store      "PS" | "EPIC" — recommendations stay within the cart's
 *              storefront (Epic cart → Epic games, PS cart → PS games).
 *              Omitted/unknown → empty result, so a services-only cart
 *              (YouTube / Netflix / Prime, gift cards) shows nothing.
 *   limit      number of recommendations to return (default 6, max 12)
 */
const DEFAULT_PER_ITEM_K = 8;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const idsRaw = (url.searchParams.get("ids") ?? "").trim();
  const limit = Math.max(1, Math.min(12, Number(url.searchParams.get("limit")) || 6));

  const storeRaw = (url.searchParams.get("store") ?? "").trim().toUpperCase();
  const store = storeRaw === "EPIC" ? "EPIC" : storeRaw === "PS" ? "PS" : null;
  // No game storefront in the cart (only streaming/platform/gift-card items)
  // → no game recommendations.
  if (!store) {
    return NextResponse.json({ results: [], fallback: false });
  }

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
          // Stay within the cart's storefront.
          store,
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
    // Prefer discounted games of this storefront, featured first — those are
    // the most commercially attractive recommendations for the cart context.
    // (isFeatured is preferred via orderBy rather than required, so Epic rows
    // — which are rarely flagged featured — still surface.) Fill any shortfall
    // with other active games of the same store.
    const discounted = await prisma.game.findMany({
      where: {
        isActive: true,
        store,
        productType: "GAME",
        discountTryCents: { not: null },
        id: { notIn: cartIds.length > 0 ? cartIds : ["__none__"] },
      },
      orderBy: [{ isFeatured: "desc" }, { lastScrapedAt: "desc" }],
      take: limit,
    });
    if (discounted.length < limit) {
      const more = await prisma.game.findMany({
        where: {
          isActive: true,
          store,
          productType: "GAME",
          id: {
            notIn: [...cartIds, ...discounted.map((g) => g.id), "__none__"],
          },
        },
        orderBy: [{ isFeatured: "desc" }, { lastScrapedAt: "desc" }],
        take: limit - discounted.length,
      });
      rows = [...discounted, ...more];
    } else {
      rows = discounted;
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
      // Epic rows have no public detail page yet (see /epic-games) — omit
      // productId so the card renders link-free instead of pointing at a
      // PS-style /oyunlar route that would 404.
      productId: g.store === "EPIC" ? undefined : g.productId,
      title: g.title,
      imageUrl: g.imageUrl,
      platform: g.platform,
      store: g.store,
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
