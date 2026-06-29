import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[əğıöüçş]/g, (c) => ({ ə: "e", ğ: "g", ı: "i", ö: "o", ü: "u", ç: "c", ş: "s" }[c] ?? c))
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "tier";
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tiers = await prisma.customerTier.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      isDefault: true,
      sortOrder: true,
      color: true,
      inviteBonusCents: true,
      _count: { select: { users: true } },
    },
  });
  return NextResponse.json({ tiers });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Ad daxil edin." }, { status: 400 });

  // Unikal slug təmin et.
  let slug = slugify(name);
  const existing = await prisma.customerTier.findMany({ select: { slug: true } });
  const taken = new Set(existing.map((t) => t.slug));
  if (taken.has(slug)) {
    let i = 2;
    while (taken.has(`${slug}-${i}`)) i += 1;
    slug = `${slug}-${i}`;
  }

  const [maxOrder, defaultTier] = await Promise.all([
    prisma.customerTier.aggregate({ _max: { sortOrder: true } }),
    prisma.customerTier.findFirst({ where: { isDefault: true }, select: { inviteBonusCents: true } }),
  ]);

  const tier = await prisma.customerTier.create({
    data: {
      name,
      slug,
      isDefault: false,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      inviteBonusCents: defaultTier?.inviteBonusCents ?? 30,
    },
    select: { id: true, name: true, slug: true, isDefault: true, sortOrder: true, inviteBonusCents: true },
  });
  return NextResponse.json({ tier });
}
