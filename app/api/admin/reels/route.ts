import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { revalidateReels } from "@/lib/revalidate";

export const runtime = "nodejs";

const CTA_TYPES = new Set(["GAME", "SERVICE", "URL"]);

export async function GET() {
  await requireAdmin();
  const items = await prisma.reel.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { comments: true, reactions: true } } },
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
        caption,
        videoUrl,
        posterUrl,
        width,
        height,
        durationMs,
        platformCode,
        platformLabel,
        platformLogoUrl,
        ctaType,
        ctaTargetId,
        ctaHref,
        ctaLabel,
        isPublished,
        sortOrder,
      } = body;

      if (!title || typeof title !== "string") {
        return NextResponse.json({ error: "Başlıq tələb olunur" }, { status: 400 });
      }
      if (!videoUrl || typeof videoUrl !== "string") {
        return NextResponse.json({ error: "Video yüklənməlidir" }, { status: 400 });
      }
      // Poster və CTA opsionaldır: poster boşdursa feed video first-frame-ə düşür;
      // CTA yoxdursa sadəcə "al" düyməsi göstərilmir (toplu qaralamalar üçün lazımdır).
      const finalCtaType = CTA_TYPES.has(String(ctaType)) ? String(ctaType) : "URL";

      const payload = {
        title: String(title),
        caption: caption ? String(caption) : null,
        videoUrl: String(videoUrl),
        posterUrl: posterUrl ? String(posterUrl) : "",
        width: Number(width) > 0 ? Math.round(Number(width)) : 720,
        height: Number(height) > 0 ? Math.round(Number(height)) : 1280,
        durationMs: Number(durationMs) > 0 ? Math.round(Number(durationMs)) : 0,
        platformCode: platformCode ? String(platformCode) : null,
        platformLabel: platformLabel ? String(platformLabel) : null,
        platformLogoUrl: platformLogoUrl ? String(platformLogoUrl) : null,
        ctaType: finalCtaType,
        ctaTargetId: ctaTargetId ? String(ctaTargetId) : null,
        ctaHref: ctaHref ? String(ctaHref) : null,
        ctaLabel: ctaLabel ? String(ctaLabel) : null,
        isPublished: Boolean(isPublished ?? true),
        sortOrder: Number(sortOrder || 0),
      };

      const item = id
        ? await prisma.reel.update({ where: { id: String(id) }, data: payload })
        : await prisma.reel.create({ data: payload });
      revalidateReels();
      return NextResponse.json(item);
    }

    if (action === "TOGGLE_PUBLISHED") {
      const { id, isPublished } = body;
      if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });
      const item = await prisma.reel.update({
        where: { id: String(id) },
        data: { isPublished: Boolean(isPublished) },
      });
      revalidateReels();
      return NextResponse.json(item);
    }

    if (action === "DELETE") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });
      await prisma.reel.delete({ where: { id: String(id) } });
      revalidateReels();
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Bilinməyən action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Xəta baş verdi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
