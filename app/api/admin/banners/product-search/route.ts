import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";
import { serviceProductLabel } from "@/lib/serviceProductLabel";

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
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const [games, services, settings] = await Promise.all([
    prisma.game.findMany({
      where: { isActive: true, title: { contains: q, mode: "insensitive" } },
      orderBy: { title: "asc" },
      take: 8,
      select: {
        id: true,
        title: true,
        imageUrl: true,
        heroImageUrl: true,
        screenshots: true,
        store: true,
        priceTryCents: true,
        discountTryCents: true,
        discountEndAt: true,
        priceUsdCents: true,
        discountUsdCents: true,
      },
    }),
    prisma.serviceProduct.findMany({
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
