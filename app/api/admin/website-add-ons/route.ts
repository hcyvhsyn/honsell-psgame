import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

const PRICING_TYPES = new Set(["FLAT", "PER_UNIT"]);

function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[əğıöüçş]/g, (c) =>
      ({ ə: "e", ğ: "g", ı: "i", ö: "o", ü: "u", ç: "c", ş: "s" })[c] ?? c,
    )
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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

export async function GET() {
  await requireAdmin();
  const addOns = await prisma.websiteServiceAddOn.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ addOns });
}

export async function POST(req: Request) {
  await requireAdmin();
  const body = await req.json().catch(() => ({}));

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Ad tələb olunur." }, { status: 400 });
  }

  const slug =
    typeof body.slug === "string" && body.slug.trim()
      ? slugify(body.slug)
      : slugify(name);
  if (!slug) {
    return NextResponse.json({ error: "Slug yaradıla bilmədi." }, { status: 400 });
  }

  const pricingType =
    typeof body.pricingType === "string" && PRICING_TYPES.has(body.pricingType)
      ? body.pricingType
      : "FLAT";

  const description =
    typeof body.description === "string" ? body.description.trim() || null : null;
  const category =
    typeof body.category === "string" ? body.category.trim() || null : null;
  const isActive = body.isActive === false ? false : true;
  const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;

  const flatPrice = pricingType === "FLAT" ? num(body.flatPrice) : null;
  const freeUnits = pricingType === "PER_UNIT" ? intOrNull(body.freeUnits) : null;
  const unitPrice = pricingType === "PER_UNIT" ? num(body.unitPrice) : null;
  const unitLabel =
    pricingType === "PER_UNIT" && typeof body.unitLabel === "string"
      ? body.unitLabel.trim() || null
      : null;

  if (pricingType === "FLAT" && flatPrice === null) {
    return NextResponse.json(
      { error: "FLAT tip üçün sabit qiymət lazımdır." },
      { status: 400 },
    );
  }
  if (pricingType === "PER_UNIT" && unitPrice === null) {
    return NextResponse.json(
      { error: "PER_UNIT tip üçün vahid qiymət lazımdır." },
      { status: 400 },
    );
  }

  try {
    const created = await prisma.websiteServiceAddOn.create({
      data: {
        slug,
        name,
        description,
        category,
        pricingType,
        flatPrice,
        freeUnits,
        unitPrice,
        unitLabel,
        isActive,
        sortOrder,
      },
    });
    return NextResponse.json({ ok: true, addOn: created });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Unique") || msg.includes("unique")) {
      return NextResponse.json(
        { error: "Bu slug artıq mövcuddur." },
        { status: 409 },
      );
    }
    throw err;
  }
}
