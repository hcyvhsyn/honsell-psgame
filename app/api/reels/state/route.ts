import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Feed-dəki reels-lərin CARI istifadəçiyə aid vəziyyəti (bəyəndim/dislike +
 * saxladım). `/api/session` şablonu: dynamic, cookie oxuyur — feed səhifəsi statik
 * qalsın deyə bu məlumat client-də paint-dən sonra yüklənir. Giriş etməyibsə boş
 * qaytarır.
 *
 * ⚠️ `saved` YALNIZ `ReelBookmark`-dan gəlir (film/serial). Oyun reels-lərində
 * "saxlanıldı" vəziyyəti `useFavorites()`-dən oxunur — orada saxlanan reel deyil,
 * konkret OYUN-dur.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body?.ids)
    ? Array.from(new Set((body.ids as unknown[]).filter((v): v is string => typeof v === "string")))
    : [];

  if (!user || ids.length === 0) {
    return NextResponse.json({ state: {} });
  }

  const [reactions, bookmarks] = await Promise.all([
    prisma.reelReaction.findMany({
      where: { userId: user.id, reelId: { in: ids } },
      select: { reelId: true, value: true },
    }),
    prisma.reelBookmark.findMany({
      where: { userId: user.id, reelId: { in: ids } },
      select: { reelId: true },
    }),
  ]);

  const state: Record<string, { myReaction: number; saved: boolean }> = {};
  for (const id of ids) state[id] = { myReaction: 0, saved: false };
  for (const r of reactions) state[r.reelId].myReaction = r.value;
  for (const b of bookmarks) state[b.reelId].saved = true;
  return NextResponse.json({ state });
}
