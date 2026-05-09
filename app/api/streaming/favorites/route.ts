import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

const VALID_KIND = new Set(["MOVIE", "SERIES"]);

/** GET — istifadəçinin streaming favorit listi. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login tələb olunur" }, { status: 401 });

  const items = await prisma.streamingTitleFavorite.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    items: items.map((it) => ({
      id: it.id,
      tmdbId: it.tmdbId,
      kind: it.kind,
      titleSnap: it.titleSnap,
      posterUrlSnap: it.posterUrlSnap,
      yearSnap: it.yearSnap,
      createdAt: it.createdAt.toISOString(),
    })),
  });
}

/**
 * POST — toggle favorit.
 *   Body: { tmdbId, kind, titleSnap, posterUrlSnap?, yearSnap? }
 * Cavab: { favorited: boolean }
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login tələb olunur" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const tmdbIdNum = Number(body.tmdbId);
  const kind = String(body.kind ?? "");
  const titleSnap = typeof body.titleSnap === "string" ? body.titleSnap.trim() : "";

  if (!Number.isFinite(tmdbIdNum) || tmdbIdNum <= 0) {
    return NextResponse.json({ error: "Düzgün tmdbId tələb olunur" }, { status: 400 });
  }
  if (!VALID_KIND.has(kind)) {
    return NextResponse.json({ error: "Növ MOVIE və ya SERIES olmalıdır" }, { status: 400 });
  }
  if (!titleSnap) {
    return NextResponse.json({ error: "Başlıq tələb olunur" }, { status: 400 });
  }

  const existing = await prisma.streamingTitleFavorite.findUnique({
    where: { userId_tmdbId_kind: { userId: user.id, tmdbId: tmdbIdNum, kind } },
  });

  if (existing) {
    await prisma.streamingTitleFavorite.delete({ where: { id: existing.id } });
    return NextResponse.json({ favorited: false });
  }

  const yearNum = body.yearSnap != null && body.yearSnap !== "" ? Number(body.yearSnap) : null;

  await prisma.streamingTitleFavorite.create({
    data: {
      userId: user.id,
      tmdbId: tmdbIdNum,
      kind,
      titleSnap,
      posterUrlSnap: body.posterUrlSnap ? String(body.posterUrlSnap) : null,
      yearSnap: Number.isFinite(yearNum) ? Number(yearNum) : null,
    },
  });

  return NextResponse.json({ favorited: true });
}
