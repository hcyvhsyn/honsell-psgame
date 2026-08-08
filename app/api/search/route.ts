import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma as PrismaSql } from "@/lib/generated/prisma/client";
import type { Game } from "@/lib/generated/prisma/client";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";
import { STREAMING_SERVICE_META } from "@/lib/streamingCart";
import { gameDetailHref } from "@/lib/gameSlug";
import { buildGameSearchTerms } from "@/lib/gameSearchTerms";
import {
  gameSearchFromSql,
  gameSearchMatchSql,
  gameSearchRelevanceSql,
} from "@/lib/gameSearchSql";

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
 *
 * Oyun axtarışı kataloqla EYNİ mühərrikdən keçir (lib/gameSearchSql.ts) —
 * abbreviatura, rum rəqəmi, defis/diakritik fərqləri və typo toleransı ilə.
 * `offset` ilə səhifələnir: modal "Daha çox göstər" düyməsində eyni sorğunu
 * növbəti offset-lə təkrarlayır, ona görə istifadəçi kataloqdakı BÜTÜN
 * uyğun oyunlara modaldan çata bilir (əvvəl sərt 8 sətir limiti var idi).
 */

/** Modalda bir "səhifə" oyun. */
const GAMES_PAGE_SIZE = 12;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ q, results: [] });
  }

  const offset = Math.max(0, Math.min(500, Number(url.searchParams.get("offset")) || 0));
  // Sonrakı səhifələrdə yalnız oyunlar çəkilir — servis/streaming siyahısı
  // onsuz da tam gəlib və təkrar sorğu boşuna yük olardı.
  const gamesOnly = offset > 0;

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
    searchGames(q, offset),
    gamesOnly ? Promise.resolve([]) : prisma.serviceProduct.findMany({
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
    gamesOnly ? Promise.resolve([]) : prisma.streamingTitle.findMany({
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

  // `take: PAGE + 1` — ayrıca COUNT sorğusu vurmadan "daha var?" cavabı.
  const hasMoreGames = games.length > GAMES_PAGE_SIZE;
  const pageGames = hasMoreGames ? games.slice(0, GAMES_PAGE_SIZE) : games;

  const gameResults = pageGames.map((g) => {
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
      href: gameDetailHref(g) ?? "/oyunlar",
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
        store: g.store ?? "PS",
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
    offset,
    hasMoreGames,
    results: {
      games: gameResults,
      services: serviceResults,
      streamingServices,
      streamingTitles: streamingTitleResults,
    },
  });
}

/** `computeDisplayPrice` + kart üçün lazım olan minimum sütunlar. */
type GameRow = Pick<
  Game,
  | "id"
  | "productId"
  | "slug"
  | "title"
  | "imageUrl"
  | "productType"
  | "priceTryCents"
  | "discountTryCents"
  | "discountEndAt"
  | "store"
>;

/**
 * Oyun axtarışı — kataloqla eyni fuzzy mühərriki (lib/gameSearchSql.ts).
 *
 * Sıralamada tam oyunlar DLC/valyutadan öndədir: "fifa 26" yazan istifadəçi
 * əvvəlcə oyunun özünü görməlidir, "FC Points 500" paketlərini yox.
 *
 * pg_trgm olmayan Postgres-də (və ya ifadə xətasında) sadə `contains`
 * axtarışına düşür — /api/games modeli ilə eyni.
 */
async function searchGames(q: string, offset: number): Promise<GameRow[]> {
  const terms = buildGameSearchTerms(q);
  try {
    const where = PrismaSql.sql`g."isActive" = true AND ${gameSearchMatchSql(terms)}`;
    const order = PrismaSql.sql`${gameSearchRelevanceSql(terms)},
      (CASE WHEN g."productType" = 'GAME' THEN 0 ELSE 1 END) ASC,
      g."isFeatured" DESC,
      g."lastScrapedAt" DESC,
      g."id" ASC`;
    return (await prisma.$queryRaw(
      PrismaSql.sql`SELECT g."id", g."productId", g."slug", g."title", g."imageUrl",
                          g."productType", g."priceTryCents", g."discountTryCents",
                          g."discountEndAt", g."store"
         FROM ${gameSearchFromSql()}
         WHERE ${where}
         ORDER BY ${order}
         LIMIT ${GAMES_PAGE_SIZE + 1} OFFSET ${offset}`
    )) as GameRow[];
  } catch {
    return prisma.game.findMany({
      where: { isActive: true, title: { contains: q, mode: "insensitive" } },
      select: {
        id: true,
        productId: true,
        slug: true,
        title: true,
        imageUrl: true,
        productType: true,
        priceTryCents: true,
        discountTryCents: true,
        discountEndAt: true,
        store: true,
      },
      orderBy: [{ isFeatured: "desc" }, { lastScrapedAt: "desc" }],
      take: GAMES_PAGE_SIZE + 1,
      skip: offset,
    });
  }
}
