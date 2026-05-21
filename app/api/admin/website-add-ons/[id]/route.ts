import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import type { Prisma } from "@/lib/generated/prisma/client";

export const runtime = "nodejs";

const PRICING_TYPES = new Set(["FLAT", "PER_UNIT"]);

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function intOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? n : null;
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  await requireAdmin();
  const id = String(ctx.params.id ?? "");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const data: Prisma.WebsiteServiceAddOnUpdateInput = {};

  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.description === "string") {
    data.description = body.description.trim() || null;
  }
  if (typeof body.category === "string") {
    data.category = body.category.trim() || null;
  }
  if (typeof body.pricingType === "string" && PRICING_TYPES.has(body.pricingType)) {
    data.pricingType = body.pricingType;
  }
  if ("flatPrice" in body) data.flatPrice = num(body.flatPrice);
  if ("freeUnits" in body) data.freeUnits = intOrNull(body.freeUnits);
  if ("unitPrice" in body) data.unitPrice = num(body.unitPrice);
  if ("unitLabel" in body) {
    data.unitLabel =
      typeof body.unitLabel === "string" ? body.unitLabel.trim() || null : null;
  }
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (body.sortOrder != null && Number.isFinite(Number(body.sortOrder))) {
    data.sortOrder = Number(body.sortOrder);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Yeniləmək üçün data yoxdur." }, { status: 400 });
  }

  const updated = await prisma.websiteServiceAddOn.update({ where: { id }, data });
  return NextResponse.json({ ok: true, addOn: updated });
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  await requireAdmin();
  const id = String(ctx.params.id ?? "");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await prisma.websiteServiceAddOn.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
