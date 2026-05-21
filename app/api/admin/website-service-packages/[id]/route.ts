import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

function normalizeFeatures(raw: unknown): string[] | undefined {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v ?? "").trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return undefined;
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  await requireAdmin();
  const id = String(ctx.params.id ?? "");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const data: {
    name?: string;
    priceRange?: string;
    description?: string;
    features?: string[];
    deliveryTime?: string | null;
    isPopular?: boolean;
    isActive?: boolean;
    sortOrder?: number;
  } = {};

  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.priceRange === "string") data.priceRange = body.priceRange.trim();
  if (typeof body.description === "string") data.description = body.description.trim();
  const features = normalizeFeatures(body.features);
  if (features) data.features = features;
  if (typeof body.deliveryTime === "string") {
    data.deliveryTime = body.deliveryTime.trim() || null;
  } else if (body.deliveryTime === null) {
    data.deliveryTime = null;
  }
  if (typeof body.isPopular === "boolean") data.isPopular = body.isPopular;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (body.sortOrder != null && Number.isFinite(Number(body.sortOrder))) {
    data.sortOrder = Number(body.sortOrder);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Yeniləmək üçün data yoxdur." }, { status: 400 });
  }

  const updated = await prisma.websiteServicePackage.update({
    where: { id },
    data,
  });
  return NextResponse.json({ ok: true, package: updated });
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  await requireAdmin();
  const id = String(ctx.params.id ?? "");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await prisma.websiteServicePackage.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
