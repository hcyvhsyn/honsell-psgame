import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { revalidateServices } from "@/lib/revalidate";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode");

  if (mode === "orders") {
    const orders = await prisma.transaction.findMany({
      where: {
        type: "SERVICE_PURCHASE",
        status: "PENDING",
        serviceProduct: { type: "ACCOUNT_CREATION" },
      },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, email: true, name: true } },
        serviceProduct: { select: { id: true, title: true } },
      },
    });
    return NextResponse.json(orders);
  }

  // Return the account creation product (should be a single one)
  const products = await prisma.serviceProduct.findMany({
    where: { type: "ACCOUNT_CREATION" },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(products);
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  try {
    if (action === "UPSERT_PRODUCT") {
      const { id, priceAznCents, isActive, description } = body;
      const price = Number(priceAznCents);

      if (!Number.isFinite(price) || price <= 0) {
        return NextResponse.json({ error: "Qiymət düzgün deyil" }, { status: 400 });
      }

      const payload = {
        type: "ACCOUNT_CREATION" as const,
        title: "Türkiyə PSN Hesabının Açılması",
        description: typeof description === "string" ? description : null,
        priceAznCents: price,
        isActive: Boolean(isActive ?? true),
        metadata: {},
      };

      let p;
      if (id) {
        p = await prisma.serviceProduct.update({ where: { id }, data: payload });
      } else {
        const existing = await prisma.serviceProduct.findFirst({ where: { type: "ACCOUNT_CREATION" } });
        p = existing
          ? await prisma.serviceProduct.update({ where: { id: existing.id }, data: payload })
          : await prisma.serviceProduct.create({ data: payload });
      }
      revalidateServices();
      return NextResponse.json(p);
    }

    return NextResponse.json({ error: "Bilinməyən action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Xəta baş verdi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
