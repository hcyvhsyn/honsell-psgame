import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";
import { serviceProductLabel } from "@/lib/serviceProductLabel";
import { Prisma as PrismaSql } from "@/lib/generated/prisma/client";
import { buildGameSearchTerms } from "@/lib/gameSearchTerms";
import {
  gameSearchFromSql,
  gameSearchMatchSql,
  gameSearchRelevanceSql,
} from "@/lib/gameSearchSql";
import { PLAYSTATION_ONLY, sellableGameWhere } from "@/lib/storeScope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Banner ADD_TO_CART product picker — vahid axtarış.
 *
 * Həm oyunları (`Game`), həm də bütün xidmət/məhsulları (`ServiceProduct` —
 * streaming, platform, PS Plus, EA Play, hədiyyə kartı, TRY balans...) başlığa
 * görə axtarır və storefront-da səbətə əlavə üçün lazım olan normallaşdırılmış
 * `{ id, kind, productType, title, imageUrl, finalAzn, originalAzn, discountPct }`
 * formatında qaytarır.
 */
const GAME_SELECT = {
  id: true,
  title: true,
  imageUrl: true,
  heroImageUrl: true,
  screenshots: true,
  store: true,
  priceTryCents: true,
  discountTryCents: true,
  customMarginPct: true,
  customPriceAznCents: true,
  discountEndAt: true,
  priceUsdCents: true,
  discountUsdCents: true,
} as const;

/**
 * Oyunlar vitrin axtarışı ilə EYNİ fuzzy mühərrikdən keçir (lib/gameSearchSql.ts) —
 * əvvəl `title contains` + əlifba sırası + 8 limit idi: "gta 5", "spiderman"
 * heç nə tapmırdı, çox sürümlü oyunların qalanı isə siyahıya düşmürdü.
 */
async function searchGames(q: string, limit: number) {
  try {
    const terms = buildGameSearchTerms(q);
    const storeSql = PLAYSTATION_ONLY ? PrismaSql.sql` AND g."store" = 'PS'` : PrismaSql.empty;
    const ranked = (await prisma.$queryRaw(
      PrismaSql.sql`SELECT g."id"
         FROM ${gameSearchFromSql()}
         WHERE g."isActive" = true${storeSql} AND ${gameSearchMatchSql(terms)}
         ORDER BY ${gameSearchRelevanceSql(terms)},
           (CASE WHEN g."productType" = 'GAME' THEN 0 ELSE 1 END) ASC,
           g."title" ASC
         LIMIT ${limit}`,
    )) as { id: string }[];
    const rows = await prisma.game.findMany({
      where: { id: { in: ranked.map((r) => r.id) } },
      select: GAME_SELECT,
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ranked.map((r) => byId.get(r.id)).filter((r): r is (typeof rows)[number] => !!r);
  } catch {
    return prisma.game.findMany({
      where: { isActive: true, ...sellableGameWhere(), title: { contains: q, mode: "insensitive" } },
      orderBy: { title: "asc" },
      take: limit,
      select: GAME_SELECT,
    });
  }
}

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  // `kind=GAME` — yalnız kataloq oyunları (flash deal picker xidmət məhsullarını
  // seçə bilmir, ona görə onları heç axtarmırıq).
  const gamesOnly = url.searchParams.get("kind") === "GAME";

  const [games, services, settings] = await Promise.all([
    searchGames(q, gamesOnly ? 40 : 12),
    gamesOnly
      ? Promise.resolve([])
      : prisma.serviceProduct.findMany({
          where: { isActive: true, title: { contains: q, mode: "insensitive" } },
          orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
          take: 8,
          select: { id: true, title: true, imageUrl: true, type: true, priceAznCents: true, metadata: true },
        }),
    getSettings(),
  ]);

  const gameResults = games.map((g) => {
    const price = computeDisplayPrice(g, settings);
    // Banner üçün seçilə bilən bütün şəkillər: hero + cover + screenshot-lar (dedup).
    const screenshots = Array.isArray(g.screenshots) ? (g.screenshots as string[]) : [];
    const images = Array.from(
      new Set([g.heroImageUrl, g.imageUrl, ...screenshots].filter((u): u is string => !!u)),
    );
    return {
      id: g.id,
      kind: "GAME" as const,
      productType: "GAME",
      title: g.title,
      imageUrl: g.imageUrl ?? g.heroImageUrl,
      images,
      finalAzn: price.finalAzn,
      originalAzn: price.originalAzn,
      discountPct: price.discountPct,
      // Flash deal formu üçün: admin bitmə tarixi yazmasa bu işlənir.
      discountEndAt:
        price.discountPct != null && g.discountEndAt ? g.discountEndAt.toISOString() : null,
    };
  });

  const serviceResults = services.map((s) => {
    const meta = (s.metadata as Record<string, unknown> | null) ?? {};
    const origCents =
      typeof meta.originalPriceAznCents === "number" && meta.originalPriceAznCents > s.priceAznCents
        ? meta.originalPriceAznCents
        : null;
    const finalAzn = s.priceAznCents / 100;
    const originalAzn = origCents != null ? origCents / 100 : null;
    const discountPct = origCents != null ? Math.round((1 - s.priceAznCents / origCents) * 100) : null;
    return {
      id: s.id,
      kind: "SERVICE" as const,
      productType: s.type,
      title: serviceProductLabel(s.title, s.metadata),
      imageUrl: s.imageUrl,
      images: s.imageUrl ? [s.imageUrl] : [],
      finalAzn,
      originalAzn,
      discountPct,
    };
  });

  return NextResponse.json({ results: [...gameResults, ...serviceResults] });
}
