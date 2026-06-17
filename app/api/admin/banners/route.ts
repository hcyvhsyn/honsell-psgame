import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { revalidateBanners } from "@/lib/revalidate";
import { isValidBannerScope } from "@/lib/contentScopes";
import { normalizeBannerPosition, normalizeBannerTheme } from "@/components/bannerLayout";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const url = new URL(req.url);
    const scope = url.searchParams.get("scope");
    const where = scope && isValidBannerScope(scope) ? { scope } : {};

    const banners = await prisma.banner.findMany({
      where,
      orderBy: [{ scope: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
      include: {
        game: { select: { id: true, title: true, imageUrl: true } },
        serviceProduct: { select: { id: true, title: true, imageUrl: true } },
      },
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
      const { id, title, subtitle, imageUrl, mobileImageUrl, linkUrl, isActive, sortOrder, actionType, gameId, serviceProductId, scope, contentPosition, contentPositionMobile, contentTheme } = body;
      const normalizedScope = scope && isValidBannerScope(String(scope)) ? String(scope) : "HOME";

      const normalizedAction = actionType === "ADD_TO_CART" ? "ADD_TO_CART" : "LINK";
      // ADD_TO_CART banneri ya bir oyuna, ya da bir xidmət/məhsula bağlanır —
      // ikisindən yalnız biri seçilir.
      const isCart = normalizedAction === "ADD_TO_CART";
      const finalGameId = isCart && gameId ? String(gameId) : null;
      const finalServiceProductId = isCart && !finalGameId && serviceProductId ? String(serviceProductId) : null;
      if (isCart && !finalGameId && !finalServiceProductId) {
        return NextResponse.json({ error: "Səbətə əlavə üçün məhsul seçilməlidir" }, { status: 400 });
      }

      // Məhsul seçilibsə və admin şəkil yükləməyibsə, məhsulun hero/cover/logo
      // şəklindən istifadə edirik. Bu sayədə banner sadəcə məhsul seçməklə qurulur.
      let resolvedImageUrl: string | null = imageUrl ? String(imageUrl) : null;
      if (!resolvedImageUrl && finalGameId) {
        const g = await prisma.game.findUnique({
          where: { id: finalGameId },
          select: { heroImageUrl: true, imageUrl: true },
        });
        resolvedImageUrl = g?.heroImageUrl ?? g?.imageUrl ?? null;
      }
      if (!resolvedImageUrl && finalServiceProductId) {
        const s = await prisma.serviceProduct.findUnique({
          where: { id: finalServiceProductId },
          select: { imageUrl: true },
        });
        resolvedImageUrl = s?.imageUrl ?? null;
      }
      if (!resolvedImageUrl) {
        return NextResponse.json({ error: "Şəkil tələb olunur (məhsul seçin və ya yükləyin)" }, { status: 400 });
      }

      const payload = {
        title: title || null,
        subtitle: subtitle || null,
        imageUrl: resolvedImageUrl,
        mobileImageUrl: mobileImageUrl ? String(mobileImageUrl) : null,
        linkUrl: normalizedAction === "LINK" ? (linkUrl || null) : null,
        actionType: normalizedAction,
        gameId: finalGameId,
        serviceProductId: finalServiceProductId,
        contentPosition: normalizeBannerPosition(contentPosition),
        contentPositionMobile: normalizeBannerPosition(contentPositionMobile),
        contentTheme: normalizeBannerTheme(contentTheme),
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
