import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { isValidContentScope } from "@/lib/contentScopes";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function revalidateScopes() {
  revalidatePath("/");
  revalidatePath("/playstation");
  revalidatePath("/streaming");
  revalidatePath("/streaming/[slug]", "page");
}

export async function GET(req: Request) {
  await requireAdmin();
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope");
  const where = scope && isValidContentScope(scope) ? { scope } : {};
  const items = await prisma.platformGuide.findMany({
    where,
    orderBy: [{ scope: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  await requireAdmin();
  const body = await req.json().catch(() => ({}));
  const { action } = body;

  try {
    if (action === "UPSERT") {
      const { id, title, slug, summary, body: text, scope, isActive, sortOrder, videoUrl } = body;
      if (!title || typeof title !== "string") {
        return NextResponse.json({ error: "Başlıq tələb olunur" }, { status: 400 });
      }
      if (!text || typeof text !== "string") {
        return NextResponse.json({ error: "Mətn tələb olunur" }, { status: 400 });
      }
      if (!isValidContentScope(String(scope))) {
        return NextResponse.json({ error: "Düzgün scope seçin" }, { status: 400 });
      }

      const videoUrlClean =
        typeof videoUrl === "string" && videoUrl.trim().length > 0 ? videoUrl.trim() : null;
      if (videoUrlClean && !/^https?:\/\//i.test(videoUrlClean)) {
        return NextResponse.json({ error: "Video linki http(s):// ilə başlamalıdır." }, { status: 400 });
      }

      let finalSlug = (slug && String(slug).trim()) || slugify(String(title));
      if (!finalSlug) finalSlug = `guide-${Date.now().toString(36)}`;
      const existing = await prisma.platformGuide.findUnique({ where: { slug: finalSlug } });
      if (existing && existing.id !== id) {
        finalSlug = `${finalSlug}-${Math.random().toString(36).slice(2, 6)}`;
      }

      const payload = {
        slug: finalSlug,
        title: String(title),
        summary: summary ? String(summary) : null,
        body: String(text),
        videoUrl: videoUrlClean,
        scope: String(scope),
        isActive: Boolean(isActive ?? true),
        sortOrder: Number(sortOrder || 0),
      };

      const item = id
        ? await prisma.platformGuide.update({ where: { id: String(id) }, data: payload })
        : await prisma.platformGuide.create({ data: payload });
      revalidateScopes();
      return NextResponse.json(item);
    }

    if (action === "TOGGLE_ACTIVE") {
      const { id, isActive } = body;
      if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });
      const item = await prisma.platformGuide.update({
        where: { id: String(id) },
        data: { isActive: Boolean(isActive) },
      });
      revalidateScopes();
      return NextResponse.json(item);
    }

    if (action === "DELETE") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });
      await prisma.platformGuide.delete({ where: { id: String(id) } });
      revalidateScopes();
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Bilinməyən action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Xəta baş verdi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
