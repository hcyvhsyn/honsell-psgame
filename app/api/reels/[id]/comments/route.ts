import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTierBadgesForUsers } from "@/lib/customerTier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bir reel-in şərhləri (gizli olmayanlar), müəllif adı + status nişanı ilə. */
export async function GET(req: Request, ctx: { params: { id: string } }) {
  const reelId = String(ctx.params.id ?? "");
  const comments = await prisma.reelComment.findMany({
    where: { reelId, isHidden: false },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { id: true, name: true } } },
  });

  const badges = await getTierBadgesForUsers(comments.map((c) => c.user.id));
  return NextResponse.json({
    items: comments.map((c) => ({
      id: c.id,
      body: c.body,
      authorName: c.user.name || "İstifadəçi",
      badge: badges.get(c.user.id) ?? null,
      createdAt: c.createdAt,
    })),
  });
}

/** Şərh yaz — dərhal görünür (moderasiya öncədən deyil). */
export async function POST(req: Request, ctx: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş tələb olunur" }, { status: 401 });

  const reelId = String(ctx.params.id ?? "");
  const body = await req.json().catch(() => ({}));
  const text = String(body?.body ?? "").trim();
  if (!text) return NextResponse.json({ error: "Şərh boş ola bilməz" }, { status: 400 });
  if (text.length > 1000) {
    return NextResponse.json({ error: "Şərh çox uzundur (maks 1000)" }, { status: 400 });
  }

  // reel mövcuddur?
  const reel = await prisma.reel.findUnique({ where: { id: reelId }, select: { id: true } });
  if (!reel) return NextResponse.json({ error: "Reel tapılmadı" }, { status: 404 });

  const created = await prisma.reelComment.create({
    data: { reelId, userId: user.id, body: text },
  });
  const badge = (await getTierBadgesForUsers([user.id])).get(user.id) ?? null;

  return NextResponse.json({
    item: {
      id: created.id,
      body: created.body,
      authorName: user.name || "İstifadəçi",
      badge,
      createdAt: created.createdAt,
    },
  });
}
