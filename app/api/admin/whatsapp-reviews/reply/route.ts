import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

const REPLY_MAX = 1000;

/**
 * Müştəri rəyinə (Testimonial) admin cavabı yazır/yeniləyir/silir.
 * Boş mətn + şəkilsiz → cavabı silir.
 */
export async function POST(req: Request) {
  await requireAdmin();
  const body = await req.json().catch(() => ({}));

  const testimonialId = String(body.testimonialId ?? "").trim();
  if (!testimonialId) {
    return NextResponse.json({ error: "Rəy ID tələb olunur." }, { status: 400 });
  }

  const reply = typeof body.reply === "string" ? body.reply.trim() : "";
  const imageUrl = typeof body.imageUrl === "string" && body.imageUrl.trim() ? body.imageUrl.trim() : null;

  if (reply.length > REPLY_MAX) {
    return NextResponse.json(
      { error: `Cavab çox uzundur (max ${REPLY_MAX} simvol).` },
      { status: 400 }
    );
  }

  const existing = await prisma.testimonial.findUnique({
    where: { id: testimonialId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Rəy tapılmadı." }, { status: 404 });
  }

  const hasContent = reply.length > 0 || imageUrl != null;

  const updated = await prisma.testimonial.update({
    where: { id: testimonialId },
    data: {
      adminReply: reply.length > 0 ? reply : null,
      adminReplyImageUrl: imageUrl,
      adminReplyAt: hasContent ? new Date() : null,
    },
    select: {
      adminReply: true,
      adminReplyImageUrl: true,
      adminReplyAt: true,
    },
  });

  revalidateTag("home");

  return NextResponse.json({
    ok: true,
    adminReply: updated.adminReply,
    adminReplyImageUrl: updated.adminReplyImageUrl,
    adminReplyAt: updated.adminReplyAt?.toISOString() ?? null,
  });
}
