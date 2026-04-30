import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const products = await prisma.serviceProduct.findMany({
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { priceAznCents: "asc" }],
    include: {
      _count: {
        select: {
          codes: { where: { isUsed: false } },
        },
      },
    },
  });

  return NextResponse.json(products);
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  try {
    if (action === "ADD_CODES") {
      const { serviceProductId, codesText } = body;
      const codes = codesText
        .split("\n")
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);

      if (!codes.length) return NextResponse.json({ error: "Kod daxil edilməyib" }, { status: 400 });

      await prisma.serviceCode.createMany({
        data: codes.map((c: string) => ({
          serviceProductId,
          code: c,
        })),
        skipDuplicates: true,
      });
      return NextResponse.json({ ok: true, count: codes.length });
    }

    if (action === "UPSERT_PRODUCT") {
      const { id, type, title, priceAznCents, isActive, metadata, sortOrder } = body;
      
      const payload = {
        type,
        title,
        priceAznCents: Number(priceAznCents),
        isActive: Boolean(isActive),
        metadata: metadata || {},
        sortOrder: Number(sortOrder || 0),
      };

      if (id) {
        const p = await prisma.serviceProduct.update({ where: { id }, data: payload });
        return NextResponse.json(p);
      } else {
        const p = await prisma.serviceProduct.create({ data: payload });
        return NextResponse.json(p);
      }
    }

    return NextResponse.json({ error: "Bilinməyən action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Xəta baş verdi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
