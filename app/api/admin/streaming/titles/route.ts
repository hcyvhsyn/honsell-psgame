import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { requireAdmin } from "@/lib/auth";
import { revalidateStreaming } from "@/lib/revalidate";
import { STREAMING_SERVICES } from "@/lib/streamingCart";

export const runtime = "nodejs";

const VALID_KIND = new Set(["MOVIE", "SERIES"]);
const VALID_SERVICE = new Set<string>(STREAMING_SERVICES);

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const service = url.searchParams.get("service");
  const q = (url.searchParams.get("q") ?? "").trim();

  const where: Record<string, unknown> = {};
  if (service && VALID_SERVICE.has(service)) where.service = service;
  if (q.length >= 2) where.title = { contains: q, mode: "insensitive" };

  const items = await prisma.streamingTitle.findMany({
    where,
    orderBy: [{ service: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  try {
    if (action === "UPSERT") {
      const {
        id,
        title,
        slug,
        kind,
        service,
        posterUrl,
        backdropUrl,
        year,
        genres,
        description,
        azAvailable,
        isActive,
        sortOrder,
        externalId,
        originalLanguage,
        dubbedLanguages,
        subtitleLanguages,
        trailerUrl,
      } = body;

      if (!title || typeof title !== "string") {
        return NextResponse.json({ error: "Başlıq tələb olunur" }, { status: 400 });
      }
      const normalizedKind = VALID_KIND.has(String(kind)) ? String(kind) : "MOVIE";
      if (!VALID_SERVICE.has(String(service))) {
        return NextResponse.json({ error: "Düzgün streaming xidməti seçin" }, { status: 400 });
      }

      // Slug avtomatik yaradılır əgər boşdursa. Mövcud title-ı redaktə edirsənsə
      // və yeni slug verilməyibsə, köhnəni saxlayırıq.
      let finalSlug = (slug && String(slug).trim()) || slugify(String(title));
      if (!finalSlug) finalSlug = `title-${Date.now().toString(36)}`;

      // Slug uniqueness — eyni slug-da başqa title yoxdursa keç.
      const existing = await prisma.streamingTitle.findUnique({ where: { slug: finalSlug } });
      if (existing && existing.id !== id) {
        finalSlug = `${finalSlug}-${Math.random().toString(36).slice(2, 6)}`;
      }

      const yearNum = year != null && year !== "" ? Number(year) : null;
      const genresArr = Array.isArray(genres)
        ? genres.map((g) => String(g)).filter(Boolean)
        : [];

      // Prisma JSON sahəsi `null` qəbul etmir — boş massiv yerinə Prisma.JsonNull
      // istifadə edirik ki, sütun NULL kimi yazılsın.
      const dubbedArr = Array.isArray(dubbedLanguages)
        ? dubbedLanguages.map((d) => String(d)).filter(Boolean)
        : [];
      const subsArr = Array.isArray(subtitleLanguages)
        ? subtitleLanguages.map((d) => String(d)).filter(Boolean)
        : [];

      const payload = {
        slug: finalSlug,
        title: String(title),
        kind: normalizedKind,
        service: String(service),
        posterUrl: posterUrl ? String(posterUrl) : null,
        backdropUrl: backdropUrl ? String(backdropUrl) : null,
        year: Number.isFinite(yearNum) ? Number(yearNum) : null,
        genres: genresArr.length > 0 ? (genresArr as Prisma.InputJsonValue) : Prisma.JsonNull,
        description: description ? String(description) : null,
        azAvailable: azAvailable === undefined ? true : Boolean(azAvailable),
        isActive: isActive === undefined ? true : Boolean(isActive),
        sortOrder: Number(sortOrder || 0),
        externalId: externalId ? String(externalId) : null,
        originalLanguage: originalLanguage ? String(originalLanguage) : null,
        dubbedLanguages: dubbedArr.length > 0 ? (dubbedArr as Prisma.InputJsonValue) : Prisma.JsonNull,
        subtitleLanguages: subsArr.length > 0 ? (subsArr as Prisma.InputJsonValue) : Prisma.JsonNull,
        trailerUrl: trailerUrl ? String(trailerUrl) : null,
      };

      const item = id
        ? await prisma.streamingTitle.update({ where: { id }, data: payload })
        : await prisma.streamingTitle.create({ data: payload });
      revalidateStreaming();
      return NextResponse.json(item);
    }

    if (action === "TOGGLE_ACTIVE") {
      const { id, isActive } = body;
      if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });
      const item = await prisma.streamingTitle.update({
        where: { id: String(id) },
        data: { isActive: Boolean(isActive) },
      });
      revalidateStreaming();
      return NextResponse.json(item);
    }

    if (action === "DELETE") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });
      await prisma.streamingTitle.delete({ where: { id: String(id) } });
      revalidateStreaming();
      return NextResponse.json({ ok: true });
    }

    if (action === "REORDER") {
      const { ids } = body;
      if (!Array.isArray(ids)) return NextResponse.json({ error: "ids massiv olmalıdır" }, { status: 400 });
      await prisma.$transaction(
        ids.map((id: string, index: number) =>
          prisma.streamingTitle.update({ where: { id: String(id) }, data: { sortOrder: index } })
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
