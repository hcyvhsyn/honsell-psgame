import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { revalidateCollections } from "@/lib/revalidate";

export const runtime = "nodejs";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/ə/g, "e")
    .replace(/ı/g, "i")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ğ/g, "g")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const collections = await prisma.collection.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      games: {
        orderBy: { position: "asc" },
        include: {
          game: { select: { id: true, productId: true, title: true, imageUrl: true, platform: true } },
        },
      },
    },
  });
  return NextResponse.json(collections);
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  try {
    if (action === "UPSERT") {
      const { id, slug, title, description, imageUrl, isActive, isFeatured, sortOrder } = body;
      if (!title) return NextResponse.json({ error: "Başlıq tələb olunur" }, { status: 400 });
      const finalSlug = slug ? slugify(String(slug)) : slugify(String(title));
      if (!finalSlug) return NextResponse.json({ error: "Slug yaradıla bilmədi" }, { status: 400 });

      const payload = {
        slug: finalSlug,
        title: String(title),
        description: description || null,
        imageUrl: imageUrl || null,
        isActive: Boolean(isActive ?? true),
        isFeatured: Boolean(isFeatured ?? false),
        sortOrder: Number(sortOrder || 0),
      };

      const c = id
        ? await prisma.collection.update({ where: { id }, data: payload })
        : await prisma.collection.create({ data: payload });
      revalidateCollections();
      return NextResponse.json(c);
    }

    if (action === "DELETE") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });
      await prisma.collection.delete({ where: { id } });
      revalidateCollections();
      return NextResponse.json({ ok: true });
    }

    if (action === "REORDER") {
      const { ids } = body;
      if (!Array.isArray(ids)) return NextResponse.json({ error: "ids massiv olmalıdır" }, { status: 400 });
      await prisma.$transaction(
        ids.map((id: string, index: number) =>
          prisma.collection.update({ where: { id: String(id) }, data: { sortOrder: index } })
        )
      );
      revalidateCollections();
      return NextResponse.json({ ok: true });
    }

    if (action === "ADD_GAME") {
      const { collectionId, gameId } = body;
      if (!collectionId || !gameId) return NextResponse.json({ error: "collectionId və gameId tələb olunur" }, { status: 400 });
      const max = await prisma.collectionGame.aggregate({
        where: { collectionId: String(collectionId) },
        _max: { position: true },
      });
      const nextPos = (max._max.position ?? -1) + 1;
      await prisma.collectionGame.upsert({
        where: { collectionId_gameId: { collectionId: String(collectionId), gameId: String(gameId) } },
        create: { collectionId: String(collectionId), gameId: String(gameId), position: nextPos },
        update: {},
      });
      revalidateCollections();
      return NextResponse.json({ ok: true });
    }

    if (action === "REMOVE_GAME") {
      const { collectionId, gameId } = body;
      if (!collectionId || !gameId) return NextResponse.json({ error: "collectionId və gameId tələb olunur" }, { status: 400 });
      await prisma.collectionGame.delete({
        where: { collectionId_gameId: { collectionId: String(collectionId), gameId: String(gameId) } },
      });
      revalidateCollections();
      return NextResponse.json({ ok: true });
    }

    if (action === "REORDER_GAMES") {
      const { collectionId, gameIds } = body;
      if (!collectionId || !Array.isArray(gameIds))
        return NextResponse.json({ error: "collectionId və gameIds tələb olunur" }, { status: 400 });
      await prisma.$transaction(
        gameIds.map((gameId: string, index: number) =>
          prisma.collectionGame.update({
            where: { collectionId_gameId: { collectionId: String(collectionId), gameId: String(gameId) } },
            data: { position: index },
          })
        )
      );
      revalidateCollections();
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Bilinməyən action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Xəta baş verdi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
