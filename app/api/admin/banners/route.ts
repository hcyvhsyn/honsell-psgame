import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { revalidateBanners } from "@/lib/revalidate";

export const runtime = "nodejs";

const VALID_SCOPES = new Set<string>(["HOME", "PLAYSTATION"]);

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const url = new URL(req.url);
    const scope = url.searchParams.get("scope");
    const where = scope && VALID_SCOPES.has(scope) ? { scope } : {};

    const banners = await prisma.banner.findMany({
      where,
      orderBy: [{ scope: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
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
      const { id, title, subtitle, imageUrl, mobileImageUrl, linkUrl, isActive, sortOrder, actionType, gameId, scope } = body;
      const normalizedScope = scope && VALID_SCOPES.has(String(scope)) ? String(scope) : "HOME";

      const normalizedAction = actionType === "ADD_TO_CART" ? "ADD_TO_CART" : "LINK";
      if (normalizedAction === "ADD_TO_CART" && !gameId) {
        return NextResponse.json({ error: "Səbətə əlavə üçün oyun seçilməlidir" }, { status: 400 });
      }

      // Oyun seçilibsə və admin şəkil yükləməyibsə, oyunun hero/cover şəklindən
      // istifadə edirik. Bu sayədə banner sadəcə oyun adı seçməklə qurula bilir.
      let resolvedImageUrl: string | null = imageUrl ? String(imageUrl) : null;
      if (!resolvedImageUrl && gameId) {
        const g = await prisma.game.findUnique({
          where: { id: String(gameId) },
          select: { heroImageUrl: true, imageUrl: true },
        });
        resolvedImageUrl = g?.heroImageUrl ?? g?.imageUrl ?? null;
      }
      if (!resolvedImageUrl) {
        return NextResponse.json({ error: "Şəkil tələb olunur (oyun seçin və ya yükləyin)" }, { status: 400 });
      }

      const payload = {
        title: title || null,
        subtitle: subtitle || null,
        imageUrl: resolvedImageUrl,
        mobileImageUrl: mobileImageUrl ? String(mobileImageUrl) : null,
        linkUrl: normalizedAction === "LINK" ? (linkUrl || null) : null,
        actionType: normalizedAction,
        gameId: normalizedAction === "ADD_TO_CART" ? String(gameId) : null,
        isActive: Boolean(isActive ?? true),
        sortOrder: Number(sortOrder || 0),
        scope: normalizedScope,
      };

      const b = id
        ? await prisma.banner.update({ where: { id }, data: payload })
        : await prisma.banner.create({ data: payload });
      revalidateBanners();
      return NextResponse.json(b);
    }

    if (action === "TOGGLE_ACTIVE") {
      const { id, isActive } = body;
      if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });
      const b = await prisma.banner.update({
        where: { id: String(id) },
        data: { isActive: Boolean(isActive) },
      });
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
