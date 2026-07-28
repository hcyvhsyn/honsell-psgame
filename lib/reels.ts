import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";
import { gameDetailHref } from "@/lib/gameSlug";

/**
 * Reels feed data qatı — TƏK mənbə.
 *
 *  • İlk səhifə `getFirstReelsPageCached()` ilə `unstable_cache` (tag "reels")
 *    arxasında keşlənir → RSC `app/reels/page.tsx` ilk posteri ilkin HTML-də verir.
 *    Admin CRUD `revalidateReels()` çağırıb bu tag-ı sıfırlayır.
 *  • Sonrakı səhifələr `/api/reels` (offset kursoru) ilə gəlir.
 *  • Per-user vəziyyət (bəyəndim/dislike/izləndi) BURADA YOXDUR — o, ayrıca
 *    `/api/reels/state` (dynamic) endpoint-indən gəlir ki, feed edge-keşlənən qalsın.
 */

export const REELS_PAGE_SIZE = 8;

export type ReelProduct = {
  /** CartItem.id — birbaşa `useCart().add({ id })`. Game/ServiceProduct DB id-si. */
  id: string;
  title: string;
  imageUrl: string | null;
  finalAzn: number;
  productType: string;
  store: string;
  /** Məhsul səhifəsinə keçid (varsa). */
  href: string | null;
};

export type ReelFeedItem = {
  id: string;
  title: string;
  caption: string | null;
  videoUrl: string;
  posterUrl: string;
  w: number;
  h: number;
  durationMs: number;
  platform: { code: string | null; label: string | null; logoUrl: string | null };
  cta: {
    type: string; // GAME | SERVICE | URL
    label: string;
    href: string | null;
    product: ReelProduct | null;
  };
  counts: { likes: number; dislikes: number; views: number; comments: number };
};

type ReelRow = {
  id: string;
  title: string;
  caption: string | null;
  videoUrl: string;
  posterUrl: string;
  width: number;
  height: number;
  durationMs: number;
  platformCode: string | null;
  platformLabel: string | null;
  platformLogoUrl: string | null;
  ctaType: string;
  ctaTargetId: string | null;
  ctaHref: string | null;
  ctaLabel: string | null;
  viewCount: number;
};

/** Bir reels səhifəsinin CTA məhsullarını + reaksiya/şərh saylarını topluca doldurur. */
async function hydrateReels(rows: ReelRow[]): Promise<ReelFeedItem[]> {
  if (rows.length === 0) return [];

  const gameIds = rows.filter((r) => r.ctaType === "GAME" && r.ctaTargetId).map((r) => r.ctaTargetId!);
  const serviceIds = rows
    .filter((r) => r.ctaType === "SERVICE" && r.ctaTargetId)
    .map((r) => r.ctaTargetId!);
  const reelIds = rows.map((r) => r.id);

  const [games, services, settings, likeGroups, dislikeGroups, commentGroups] = await Promise.all([
    gameIds.length
      ? prisma.game.findMany({
          where: { id: { in: gameIds } },
          select: {
            id: true,
            productId: true,
        slug: true,
            title: true,
            imageUrl: true,
            store: true,
            platform: true,
            productType: true,
            priceTryCents: true,
            discountTryCents: true,
            discountEndAt: true,
            priceUsdCents: true,
            discountUsdCents: true,
          },
        })
      : Promise.resolve([]),
    serviceIds.length
      ? prisma.serviceProduct.findMany({
          where: { id: { in: serviceIds } },
          select: { id: true, title: true, imageUrl: true, priceAznCents: true, type: true },
        })
      : Promise.resolve([]),
    getSettings(),
    prisma.reelReaction.groupBy({
      by: ["reelId"],
      where: { reelId: { in: reelIds }, value: 1 },
      _count: { _all: true },
    }),
    prisma.reelReaction.groupBy({
      by: ["reelId"],
      where: { reelId: { in: reelIds }, value: -1 },
      _count: { _all: true },
    }),
    prisma.reelComment.groupBy({
      by: ["reelId"],
      where: { reelId: { in: reelIds }, isHidden: false },
      _count: { _all: true },
    }),
  ]);

  const gameById = new Map(games.map((g) => [g.id, g]));
  const serviceById = new Map(services.map((s) => [s.id, s]));
  const likeById = new Map(likeGroups.map((g) => [g.reelId, g._count._all]));
  const dislikeById = new Map(dislikeGroups.map((g) => [g.reelId, g._count._all]));
  const commentById = new Map(commentGroups.map((g) => [g.reelId, g._count._all]));

  return rows.map((r) => {
    let product: ReelProduct | null = null;
    if (r.ctaType === "GAME" && r.ctaTargetId) {
      const g = gameById.get(r.ctaTargetId);
      if (g) {
        product = {
          id: g.id,
          title: g.title,
          imageUrl: g.imageUrl,
          finalAzn: computeDisplayPrice(g, settings).finalAzn,
          productType: g.productType,
          store: g.store === "EPIC" || g.platform === "PC" ? "EPIC" : "PS",
          href: gameDetailHref(g) ?? "/oyunlar",
        };
      }
    } else if (r.ctaType === "SERVICE" && r.ctaTargetId) {
      const s = serviceById.get(r.ctaTargetId);
      if (s) {
        product = {
          id: s.id,
          title: s.title,
          imageUrl: s.imageUrl,
          finalAzn: s.priceAznCents / 100,
          productType: s.type,
          store: "SERVICE",
          href: null,
        };
      }
    }

    return {
      id: r.id,
      title: r.title,
      caption: r.caption,
      videoUrl: r.videoUrl,
      posterUrl: r.posterUrl,
      w: r.width,
      h: r.height,
      durationMs: r.durationMs,
      platform: {
        code: r.platformCode,
        label: r.platformLabel,
        logoUrl: r.platformLogoUrl,
      },
      cta: {
        type: r.ctaType,
        label: r.ctaLabel || (product ? "Al" : "Bax"),
        href: r.ctaType === "URL" ? r.ctaHref : (product?.href ?? null),
        product,
      },
      counts: {
        likes: likeById.get(r.id) ?? 0,
        dislikes: dislikeById.get(r.id) ?? 0,
        views: r.viewCount,
        comments: commentById.get(r.id) ?? 0,
      },
    };
  });
}

const REEL_ORDER = [{ sortOrder: "asc" as const }, { createdAt: "desc" as const }, { id: "desc" as const }];

/**
 * Feed səhifəsi (offset kursoru ilə). Publik yalnız `isPublished` reels.
 * `nextCursor` növbəti offset (və ya null).
 */
export async function getReelsPage(opts: {
  cursor?: number;
  limit?: number;
}): Promise<{ items: ReelFeedItem[]; nextCursor: number | null }> {
  const skip = Math.max(0, opts.cursor ?? 0);
  const limit = Math.min(24, Math.max(1, opts.limit ?? REELS_PAGE_SIZE));

  const rows = (await prisma.reel.findMany({
    where: { isPublished: true },
    orderBy: REEL_ORDER,
    skip,
    take: limit + 1, // +1 ilə növbəti səhifə var-yoxunu bilirik
  })) as ReelRow[];

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const items = await hydrateReels(pageRows);
  return { items, nextCursor: hasMore ? skip + limit : null };
}

/** İlk səhifə — keşlənmiş (tag "reels"). RSC ilk paint üçün. */
export const getFirstReelsPageCached = unstable_cache(
  async (): Promise<{ items: ReelFeedItem[]; nextCursor: number | null }> => {
    return getReelsPage({ cursor: 0, limit: REELS_PAGE_SIZE });
  },
  ["reels-feed-v1"],
  { tags: ["reels"], revalidate: 300 },
);
