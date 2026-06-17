import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/testimonials/[id]
 * Body: { isActive?: boolean, sortOrder?: number }
 *
 * isActive=true  → rəy anasayfada görünür (təsdiq)
 * isActive=false → gizlədilir / təsdiq gözləyir
 * sortOrder      → anasayfada sıralama (kiçik əvvəl)
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const data: { isActive?: boolean; sortOrder?: number } = {};

  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (body.sortOrder != null && Number.isFinite(Number(body.sortOrder))) {
    data.sortOrder = Math.trunc(Number(body.sortOrder));
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Dəyişiklik yoxdur." }, { status: 400 });
  }

  try {
    const updated = await prisma.testimonial.update({ where: { id: params.id }, data });
    return NextResponse.json({ ok: true, testimonial: updated });
  } catch {
    return NextResponse.json({ error: "Rəy tapılmadı." }, { status: 404 });
  }
}

/** DELETE /api/admin/testimonials/[id] — rəyi tamamilə silir. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await prisma.testimonial.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Rəy tapılmadı." }, { status: 404 });
  }
}
