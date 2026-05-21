import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  await requireAdmin();
  const packages = await prisma.websiteServicePackage.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ packages });
}

function normalizeFeatures(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v ?? "").trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

export async function POST(req: Request) {
  await requireAdmin();
  const body = await req.json().catch(() => ({}));

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const priceRange = typeof body.priceRange === "string" ? body.priceRange.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const features = normalizeFeatures(body.features);
  const deliveryTime =
    typeof body.deliveryTime === "string" ? body.deliveryTime.trim() || null : null;
  const isPopular = Boolean(body.isPopular);
  const isActive = body.isActive === false ? false : true;
  const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;

  if (!name || !priceRange || !description) {
    return NextResponse.json(
      { error: "Ad, qiymət aralığı və təsvir tələb olunur." },
      { status: 400 },
    );
  }

  const created = await prisma.websiteServicePackage.create({
    data: {
      name,
      priceRange,
      description,
      features,
      deliveryTime,
      isPopular,
      isActive,
      sortOrder,
    },
  });

  return NextResponse.json({ ok: true, package: created });
}
