import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

const ALLOWED_STATUSES = new Set([
  "NEW",
  "CONTACTED",
  "PRICE_GIVEN",
  "ACCEPTED",
  "REJECTED",
  "COMPLETED",
]);

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  await requireAdmin();
  const id = String(ctx.params.id ?? "");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const application = await prisma.websiteServiceApplication.findUnique({
    where: { id },
    include: {
      package: { select: { id: true, name: true, priceRange: true } },
    },
  });

  if (!application) {
    return NextResponse.json({ error: "Tapılmadı." }, { status: 404 });
  }

  return NextResponse.json({ application });
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  await requireAdmin();
  const id = String(ctx.params.id ?? "");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const data: { status?: string; adminNotes?: string | null } = {};

  if (typeof body.status === "string" && ALLOWED_STATUSES.has(body.status)) {
    data.status = body.status;
  }
  if (typeof body.adminNotes === "string") {
    data.adminNotes = body.adminNotes.trim() || null;
  } else if (body.adminNotes === null) {
    data.adminNotes = null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Yeniləmək üçün data yoxdur." }, { status: 400 });
  }

  const updated = await prisma.websiteServiceApplication.update({
    where: { id },
    data,
    include: {
      package: { select: { id: true, name: true, priceRange: true } },
    },
  });

  return NextResponse.json({ ok: true, application: updated });
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  await requireAdmin();
  const id = String(ctx.params.id ?? "");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await prisma.websiteServiceApplication.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
