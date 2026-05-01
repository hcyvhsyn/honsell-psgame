import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const banners = await prisma.banner.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
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
      const { id, title, subtitle, imageUrl, linkUrl, isActive, sortOrder } = body;
      if (!imageUrl) return NextResponse.json({ error: "imageUrl tələb olunur" }, { status: 400 });

      const payload = {
        title: title || null,
        subtitle: subtitle || null,
        imageUrl: String(imageUrl),
        linkUrl: linkUrl || null,
        isActive: Boolean(isActive ?? true),
        sortOrder: Number(sortOrder || 0),
      };

      if (id) {
        const b = await prisma.banner.update({ where: { id }, data: payload });
        return NextResponse.json(b);
      } else {
        const b = await prisma.banner.create({ data: payload });
        return NextResponse.json(b);
      }
    }

    if (action === "DELETE") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });
      await prisma.banner.delete({ where: { id } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Bilinməyən action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Xəta baş verdi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
