import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { revalidateBanners } from "@/lib/revalidate";

export const runtime = "nodejs";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const banners = await prisma.banner.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: { game: { select: { id: true, title: true, imageUrl: true } } },
    });
    return NextResponse.json(banners);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  try {
    if (action === "UPSERT") {
      const { id, title, subtitle, imageUrl, linkUrl, isActive, sortOrder, actionType, gameId } = body;
      if (!imageUrl) return NextResponse.json({ error: "imageUrl tələb olunur" }, { status: 400 });

      const normalizedAction = actionType === "ADD_TO_CART" ? "ADD_TO_CART" : "LINK";
      if (normalizedAction === "ADD_TO_CART" && !gameId) {
        return NextResponse.json({ error: "Səbətə əlavə üçün oyun seçilməlidir" }, { status: 400 });
      }

      const payload = {
        title: title || null,
        subtitle: subtitle || null,
        imageUrl: String(imageUrl),
        linkUrl: normalizedAction === "LINK" ? (linkUrl || null) : null,
        actionType: normalizedAction,
        gameId: normalizedAction === "ADD_TO_CART" ? String(gameId) : null,
        isActive: Boolean(isActive ?? true),
        sortOrder: Number(sortOrder || 0),
      };

      const b = id
        ? await prisma.banner.update({ where: { id }, data: payload })
        : await prisma.banner.create({ data: payload });
      revalidateBanners();
      return NextResponse.json(b);
    }

    if (action === "DELETE") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });
      await prisma.banner.delete({ where: { id } });
      revalidateBanners();
      return NextResponse.json({ ok: true });
    }

    if (action === "REORDER") {
      const { ids } = body;
      if (!Array.isArray(ids)) return NextResponse.json({ error: "ids massiv olmalıdır" }, { status: 400 });
      await prisma.$transaction(
        ids.map((id: string, index: number) =>
          prisma.banner.update({ where: { id: String(id) }, data: { sortOrder: index } })
        )
      );
      revalidateBanners();
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Bilinməyən action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Xəta baş verdi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
