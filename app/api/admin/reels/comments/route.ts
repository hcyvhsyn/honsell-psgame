import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

/** Reels şərhlərinin moderasiyası — siyahı + gizlə/göstər + sil. */
export async function GET(req: Request) {
  await requireAdmin();
  const url = new URL(req.url);
  const reelId = url.searchParams.get("reelId");
  const items = await prisma.reelComment.findMany({
    where: reelId ? { reelId } : {},
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: { select: { name: true, email: true } },
      reel: { select: { title: true } },
    },
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  await requireAdmin();
  const body = await req.json().catch(() => ({}));
  const { action, id } = body;
  if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });

  try {
    if (action === "TOGGLE_HIDDEN") {
      const item = await prisma.reelComment.update({
        where: { id: String(id) },
        data: { isHidden: Boolean(body.isHidden) },
      });
      return NextResponse.json(item);
    }
    if (action === "DELETE") {
      await prisma.reelComment.delete({ where: { id: String(id) } });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Bilinməyən action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Xəta baş verdi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
