import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { normalizePromoCode } from "@/lib/promoCodes";

export const runtime = "nodejs";

function parseDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

export async function GET() {
  await requireAdmin();
  const items = await prisma.promoCode.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    include: { _count: { select: { redemptions: true } } },
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
        code,
        kind,
        value,
        maxDiscountCents,
        minOrderCents,
        productTypes,
        usageLimit,
        perUserLimit,
        startsAt,
        expiresAt,
        isActive,
      } = body;

      const finalCode = normalizePromoCode(String(code ?? ""));
      if (!finalCode) return NextResponse.json({ error: "Kod tələb olunur" }, { status: 400 });
      const finalKind = kind === "FIXED" ? "FIXED" : "PERCENT";
      const finalValue = Math.round(Number(value) || 0);
      if (finalValue <= 0) return NextResponse.json({ error: "Dəyər 0-dan böyük olmalıdır" }, { status: 400 });
      if (finalKind === "PERCENT" && finalValue > 100) {
        return NextResponse.json({ error: "Faiz 100-dən çox ola bilməz" }, { status: 400 });
      }

      // Unikal kod yoxlaması (create və ya kod dəyişən update).
      const existing = await prisma.promoCode.findUnique({ where: { code: finalCode } });
      if (existing && existing.id !== id) {
        return NextResponse.json({ error: "Bu kod artıq mövcuddur" }, { status: 400 });
      }

      const types: string[] = Array.isArray(productTypes)
        ? productTypes.map((t: unknown) => String(t).trim().toUpperCase()).filter(Boolean)
        : [];

      const data = {
        code: finalCode,
        kind: finalKind,
        value: finalValue,
        maxDiscountCents:
          finalKind === "PERCENT" && Number(maxDiscountCents) > 0
            ? Math.round(Number(maxDiscountCents))
            : null,
        minOrderCents: Math.max(0, Math.round(Number(minOrderCents) || 0)),
        productTypes: types,
        usageLimit: Number(usageLimit) > 0 ? Math.round(Number(usageLimit)) : null,
        perUserLimit: Math.max(1, Math.round(Number(perUserLimit) || 1)),
        startsAt: parseDate(startsAt),
        expiresAt: parseDate(expiresAt),
        isActive: Boolean(isActive ?? true),
      };

      const item = id
        ? await prisma.promoCode.update({ where: { id: String(id) }, data })
        : await prisma.promoCode.create({ data: { ...data, source: "ADMIN" } });
      return NextResponse.json(item);
    }

    if (action === "TOGGLE_ACTIVE") {
      const { id, isActive } = body;
      if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });
      const item = await prisma.promoCode.update({
        where: { id: String(id) },
        data: { isActive: Boolean(isActive) },
      });
      return NextResponse.json(item);
    }

    if (action === "DELETE") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });
      await prisma.promoCode.delete({ where: { id: String(id) } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Bilinməyən action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Xəta baş verdi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
