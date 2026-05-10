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
    .replace(/ə/g, "e")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
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

/// Ana səhifə "all news" view-i üçün — admin paneldə bütün scope-ların xəbərlərini
/// göstərmək lazım gələndə istifadə olunur.
function isHomeListing(url: URL): boolean {
  return url.searchParams.get("view") === "ALL";
}

export async function GET(req: Request) {
  await requireAdmin();
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope");
  const where = isHomeListing(url)
    ? {}
    : scope && isValidContentScope(scope)
      ? { scope }
      : {};
  const items = await prisma.newsArticle.findMany({
    where,
    orderBy: [
      { scope: "asc" },
      { isFeatured: "desc" },
      { sortOrder: "asc" },
      { publishedAt: "desc" },
      { createdAt: "desc" },
    ],
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  await requireAdmin();
  const body = await req.json().catch(() => ({}));
  const { action } = body;

  try {
    if (action === "UPSERT") {
      const {
        id,
        title,
        slug,
        excerpt,
        body: text,
        coverImageUrl,
        category,
        scope,
        isFeatured,
        isPublished,
        showOnHome,
        publishedAt,
        sortOrder,
      } = body;
      if (!title || typeof title !== "string") {
        return NextResponse.json({ error: "Başlıq tələb olunur" }, { status: 400 });
      }
      if (!text || typeof text !== "string") {
        return NextResponse.json({ error: "Mətn tələb olunur" }, { status: 400 });
      }
      if (!isValidContentScope(String(scope))) {
        return NextResponse.json({ error: "Düzgün scope seçin" }, { status: 400 });
      }

      let finalSlug = (slug && String(slug).trim()) || slugify(String(title));
      if (!finalSlug) finalSlug = `news-${Date.now().toString(36)}`;
      const existing = await prisma.newsArticle.findUnique({ where: { slug: finalSlug } });
      if (existing && existing.id !== id) {
        finalSlug = `${finalSlug}-${Math.random().toString(36).slice(2, 6)}`;
      }

      const willPublish = Boolean(isPublished ?? true);
      let effectivePublishedAt: Date | null = null;
      if (publishedAt) {
        const parsed = new Date(publishedAt);
        if (!isNaN(parsed.getTime())) effectivePublishedAt = parsed;
      } else if (willPublish) {
        // Yeni post-larda və publishedAt boş qaldıqda — indiki tarixə bərabərləşdiririk.
        effectivePublishedAt = id ? null : new Date();
      }

      const payload = {
        slug: finalSlug,
        title: String(title),
        excerpt: excerpt ? String(excerpt) : null,
        body: String(text),
        coverImageUrl: coverImageUrl ? String(coverImageUrl) : null,
        category: category ? String(category) : null,
        scope: String(scope),
        isFeatured: Boolean(isFeatured ?? false),
        isPublished: willPublish,
        showOnHome: Boolean(showOnHome ?? false),
        ...(effectivePublishedAt !== null ? { publishedAt: effectivePublishedAt } : {}),
        sortOrder: Number(sortOrder || 0),
      };

      const item = id
        ? await prisma.newsArticle.update({ where: { id: String(id) }, data: payload })
        : await prisma.newsArticle.create({ data: payload });
      revalidateScopes();
      return NextResponse.json(item);
    }

    if (action === "TOGGLE_PUBLISHED") {
      const { id, isPublished } = body;
      if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });
      const item = await prisma.newsArticle.update({
        where: { id: String(id) },
        data: {
          isPublished: Boolean(isPublished),
          ...(isPublished ? { publishedAt: new Date() } : {}),
        },
      });
      revalidateScopes();
      return NextResponse.json(item);
    }

    if (action === "TOGGLE_FEATURED") {
      const { id, isFeatured } = body;
      if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });
      const item = await prisma.newsArticle.update({
        where: { id: String(id) },
        data: { isFeatured: Boolean(isFeatured) },
      });
      revalidateScopes();
      return NextResponse.json(item);
    }

    if (action === "TOGGLE_HOME") {
      const { id, showOnHome } = body;
      if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });
      const item = await prisma.newsArticle.update({
        where: { id: String(id) },
        data: { showOnHome: Boolean(showOnHome) },
      });
      revalidateScopes();
      return NextResponse.json(item);
    }

    if (action === "DELETE") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });
      await prisma.newsArticle.delete({ where: { id: String(id) } });
      revalidateScopes();
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Bilinməyən action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Xəta baş verdi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
