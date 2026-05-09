import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { revalidateStreaming } from "@/lib/revalidate";
import { STREAMING_SERVICES } from "@/lib/streamingCart";

export const runtime = "nodejs";

const VALID_SCOPE = new Set<string>(["OVERVIEW", ...STREAMING_SERVICES]);

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope");

  const where: Record<string, unknown> = {};
  if (scope && VALID_SCOPE.has(scope)) where.scope = scope;

  const items = await prisma.streamingFeatured.findMany({
    where,
    orderBy: [{ scope: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    include: { title: true },
  });
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  try {
    if (action === "ADD") {
      const { scope, titleId, sortOrder } = body;
      if (!VALID_SCOPE.has(String(scope))) {
        return NextResponse.json({ error: "Düzgün scope seçin" }, { status: 400 });
      }
      if (!titleId) return NextResponse.json({ error: "titleId tələb olunur" }, { status: 400 });

      const title = await prisma.streamingTitle.findUnique({ where: { id: String(titleId) } });
      if (!title) return NextResponse.json({ error: "Title tapılmadı" }, { status: 404 });

      // Eyni scope-a eyni title iki dəfə əlavə olunmasın.
      const exists = await prisma.streamingFeatured.findFirst({
        where: { scope: String(scope), titleId: String(titleId) },
      });
      if (exists) return NextResponse.json(exists);

      const item = await prisma.streamingFeatured.create({
        data: {
          scope: String(scope),
          titleId: String(titleId),
          sortOrder: Number(sortOrder ?? 0),
          isActive: true,
        },
        include: { title: true },
      });
      revalidateStreaming();
      return NextResponse.json(item);
    }

    if (action === "TOGGLE_ACTIVE") {
      const { id, isActive } = body;
      if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });
      const item = await prisma.streamingFeatured.update({
        where: { id: String(id) },
        data: { isActive: Boolean(isActive) },
        include: { title: true },
      });
      revalidateStreaming();
      return NextResponse.json(item);
    }

    if (action === "DELETE") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });
      await prisma.streamingFeatured.delete({ where: { id: String(id) } });
      revalidateStreaming();
      return NextResponse.json({ ok: true });
    }

    if (action === "REORDER") {
      const { ids } = body;
      if (!Array.isArray(ids)) return NextResponse.json({ error: "ids massiv olmalıdır" }, { status: 400 });
      await prisma.$transaction(
        ids.map((id: string, index: number) =>
          prisma.streamingFeatured.update({ where: { id: String(id) }, data: { sortOrder: index } })
        )
      );
      revalidateStreaming();
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Bilinməyən action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Xəta baş verdi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
