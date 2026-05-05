import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/favorites — current user's favorite gameIds (for hydrating UI). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ids: [] });
  }
  const rows = await prisma.favorite.findMany({
    where: { userId: user.id },
    select: { gameId: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ ids: rows.map((r) => r.gameId) });
}

/**
 * POST /api/favorites — toggle a favorite.
 * Body: { gameId: string, action?: "add" | "remove" }
 * If `action` is omitted, behaves as a toggle.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Favorilərə əlavə etmək üçün hesaba daxil olmalısan." },
      { status: 401 }
    );
  }

  let body: { gameId?: unknown; action?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Yanlış sorğu." }, { status: 400 });
  }

  const gameId = typeof body.gameId === "string" ? body.gameId : null;
  if (!gameId) {
    return NextResponse.json({ error: "gameId tələb olunur." }, { status: 400 });
  }

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true },
  });
  if (!game) {
    return NextResponse.json({ error: "Oyun tapılmadı." }, { status: 404 });
  }

  const action = body.action === "add" || body.action === "remove" ? body.action : null;

  if (action === "remove") {
    await prisma.favorite.deleteMany({ where: { userId: user.id, gameId } });
    return NextResponse.json({ favorited: false });
  }

  if (action === "add") {
    await prisma.favorite.upsert({
      where: { userId_gameId: { userId: user.id, gameId } },
      create: { userId: user.id, gameId },
      update: {},
    });
    return NextResponse.json({ favorited: true });
  }

  // Toggle
  const existing = await prisma.favorite.findUnique({
    where: { userId_gameId: { userId: user.id, gameId } },
    select: { userId: true },
  });
  if (existing) {
    await prisma.favorite.delete({
      where: { userId_gameId: { userId: user.id, gameId } },
    });
    return NextResponse.json({ favorited: false });
  }
  await prisma.favorite.create({ data: { userId: user.id, gameId } });
  return NextResponse.json({ favorited: true });
}
