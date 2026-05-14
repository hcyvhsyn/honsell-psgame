import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";
import { STREAMING_SERVICE_META } from "@/lib/streamingCart";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vahid axtarış endpoint-i — bütün məhsul/məzmun kateqoriyalarında axtarır:
 *   • PlayStation oyunları (Game.title)
 *   • Servis məhsulları (ServiceProduct.title) — hədiyyə kartları, hesab açma, PS Plus
 *   • Streaming title-ları (StreamingTitle.name) — kataloqdakı film/serial məlumatı
 *   • Streaming xidmətləri (HBO Max, Netflix, Gain, YouTube Premium) — statik
 *
 * Hər nəticə vahid forma ilə qaytarılır ki, modal-da uniform render olunsun.
 * Axtarış hər kateqoriya üzrə ən çox 5 nəticə qaytarır.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ q, results: [] });
  }

  const lower = q.toLowerCase();
  const settings = await getSettings().catch(() => null);

  // Streaming xidmətləri statikdir — DB sorğusu lazım deyil.
  const streamingServices = Object.values(STREAMING_SERVICE_META)
    .filter((s) => s.label.toLowerCase().includes(lower) || s.slug.includes(lower))
    .slice(0, 4)
    .map((s) => ({
      kind: "STREAMING_SERVICE" as const,
      id: `svc-${s.slug}`,
      title: s.label,
      subtitle: "Streaming xidməti",
      imageUrl: null as string | null,
      href: `/streaming/${s.slug}`,
      finalAzn: null as number | null,
      originalAzn: null as number | null,
    }));

  const [games, services, streamingTitles] = await Promise.all([
    prisma.game.findMany({
      where: {
        isActive: true,
        title: { contains: q, mode: "insensitive" },
      },
      select: {
        id: true,
        productId: true,
        title: true,
        imageUrl: true,
        productType: true,
        priceTryCents: true,
        discountTryCents: true,
        discountEndAt: true,
      },
      orderBy: [{ isFeatured: "desc" }, { lastScrapedAt: "desc" }],
      take: 8,
    }),
    prisma.serviceProduct.findMany({
      where: {
        isActive: true,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        imageUrl: true,
        priceAznCents: true,
      },
      orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
      take: 20,
    }),
    prisma.streamingTitle.findMany({
      where: {
        isActive: true,
        title: { contains: q, mode: "insensitive" },
      },
      select: {
        id: true,
        title: true,
        kind: true,
        service: true,
        posterUrl: true,
        year: true,
      },
      orderBy: { sortOrder: "asc" },
      take: 6,
    }),
  ]);

  const gameResults = games.map((g) => {
    const display = settings
      ? computeDisplayPrice(g, settings)
      : { finalAzn: 0, originalAzn: null, discountPct: null };
    const productType = g.productType ?? "GAME";
    return {
      kind: "GAME" as const,
      id: g.id,
      productId: g.productId,
      title: g.title,
      subtitle: productType === "ADDON" ? "DLC / Əlavə" : "PlayStation oyunu",
      imageUrl: g.imageUrl,
      href: `/oyunlar/${encodeURIComponent(g.productId)}`,
      productType,
      finalAzn: display.finalAzn,
      originalAzn: display.originalAzn,
      // Cart-a əlavə üçün lazım olan minimum payload:
      cartPayload: {
        id: g.id,
        title: g.title,
        imageUrl: g.imageUrl ?? null,
        finalAzn: display.finalAzn,
        productType,
      },
    };
  });

  const serviceResults = services.map((s) => {
    const finalAzn = s.priceAznCents / 100;
    const subtitle =
      s.type === "ACCOUNT_CREATION"
        ? "PSN hesab açma"
        : s.type === "TRY_BALANCE"
          ? "TRY balans"
          : s.type === "PS_PLUS"
            ? "PS Plus abunəliyi"
            : s.type === "EA_PLAY"
              ? "EA Play abunəliyi"
              : "Servis məhsulu";
    return {
      kind: "SERVICE" as const,
      id: s.id,
      title: s.title,
      subtitle,
      imageUrl: s.imageUrl,
      href:
        s.type === "ACCOUNT_CREATION"
          ? "/hesab-acma"
          : s.type === "PS_PLUS"
            ? "/ps-plus"
            : s.type === "EA_PLAY"
              ? "/ea-play"
              : "/hediyye-kartlari",
      finalAzn,
      originalAzn: null as number | null,
      cartPayload: {
        id: s.id,
        title: s.title,
        imageUrl: s.imageUrl ?? null,
        finalAzn,
        productType: s.type,
      },
    };
  });

  const streamingTitleResults = streamingTitles.map((t) => {
    const meta = Object.values(STREAMING_SERVICE_META).find(
      (m) => m.code === t.service,
    );
    const platformLabel = meta?.label ?? t.service;
    const subtitle = `${t.kind === "SERIES" ? "Serial" : "Film"}${
      t.year ? ` · ${t.year}` : ""
    } · ${platformLabel}`;
    return {
      kind: "STREAMING_TITLE" as const,
      id: t.id,
      title: t.title,
      subtitle,
      imageUrl: t.posterUrl,
      href: meta ? `/streaming/${meta.slug}` : `/streaming`,
      finalAzn: null as number | null,
      originalAzn: null as number | null,
    };
  });

  return NextResponse.json({
    q,
    results: {
      games: gameResults,
      services: serviceResults,
      streamingServices,
      streamingTitles: streamingTitleResults,
    },
  });
}
