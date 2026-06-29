import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const data: { name?: string; color?: string | null } = {};
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "Ad boş ola bilməz." }, { status: 400 });
    data.name = name;
  }
  if (typeof body.color === "string" || body.color === null) data.color = body.color;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Dəyişiklik yoxdur." }, { status: 400 });
  }

  const tier = await prisma.customerTier
    .update({ where: { id: params.id }, data, select: { id: true, name: true, color: true } })
    .catch(() => null);
  if (!tier) return NextResponse.json({ error: "Seqment tapılmadı." }, { status: 404 });
  return NextResponse.json({ tier });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tier = await prisma.customerTier.findUnique({
    where: { id: params.id },
    select: { id: true, isDefault: true },
  });
  if (!tier) return NextResponse.json({ error: "Seqment tapılmadı." }, { status: 404 });
  if (tier.isDefault) {
    return NextResponse.json({ error: "Standart seqment silinə bilməz." }, { status: 400 });
  }

  // ReferralRate sətirləri cascade silinir; bu seqmentdəki istifadəçilərin tierId-i
  // NULL olur (FK ON DELETE SET NULL) → onlar standart seqmentə düşür.
  await prisma.customerTier.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
