import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEARCH_LIMIT = 30;

/**
 * Kupon scope-u üçün məhsul axtarışı (admin picker). İki mənbə:
 *  - Game (oyuna özəl kuponlar)
 *  - ServiceProduct (platformaya/pakete özəl — Spotify planları, PS Plus və s.)
 *
 * `ids` verilərsə axtarış yox, həmin id-lərin adları qaytarılır (formu açanda
 * yadda saxlanmış scope-u ad kimi göstərmək üçün).
 */
export async function GET(req: Request) {
  await requireAdmin();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const ids = (url.searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (ids.length > 0) {
    const [games, services] = await Promise.all([
      prisma.game.findMany({
        where: { id: { in: ids } },
        select: { id: true, title: true, imageUrl: true, store: true },
      }),
      prisma.serviceProduct.findMany({
        where: { id: { in: ids } },
        select: { id: true, title: true, imageUrl: true, type: true, metadata: true },
      }),
    ]);
    return NextResponse.json({
      games: games.map(toGame),
      services: services.map(toService),
    });
  }

  if (q.length < 2) return NextResponse.json({ games: [], services: [] });

  const [games, services] = await Promise.all([
    prisma.game.findMany({
      where: { isActive: true, title: { contains: q, mode: "insensitive" } },
      select: { id: true, title: true, imageUrl: true, store: true },
      orderBy: { title: "asc" },
      take: SEARCH_LIMIT,
    }),
    prisma.serviceProduct.findMany({
      where: { isActive: true, title: { contains: q, mode: "insensitive" } },
      select: { id: true, title: true, imageUrl: true, type: true, metadata: true },
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
      take: SEARCH_LIMIT,
    }),
  ]);

  return NextResponse.json({ games: games.map(toGame), services: services.map(toService) });
}

function toGame(g: { id: string; title: string; imageUrl: string | null; store: string | null }) {
  return { id: g.id, title: g.title, imageUrl: g.imageUrl, subtitle: g.store === "EPIC" ? "Epic" : "PS" };
}

function toService(s: {
  id: string;
  title: string;
  imageUrl: string | null;
  type: string;
  metadata: unknown;
}) {
  // Platforma məhsullarında brend metadata-dadır (musicBrand / platformKind) —
  // yalnız admin-ə qrup etiketi göstərmək üçün oxunur, scope id ilə saxlanır.
  const m = (s.metadata as Record<string, unknown> | null) ?? {};
  const brand = String(m.musicBrand ?? m.platformKind ?? "").trim();
  return {
    id: s.id,
    title: s.title,
    imageUrl: s.imageUrl,
    type: s.type,
    subtitle: brand ? `${s.type} · ${brand}` : s.type,
  };
}
