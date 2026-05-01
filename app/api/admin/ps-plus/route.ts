import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode");

  // Return pending PS Plus orders
  if (mode === "orders") {
    const orders = await prisma.transaction.findMany({
      where: { type: "SERVICE_PURCHASE", status: "PENDING", serviceProduct: { type: "PS_PLUS" } },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, email: true, name: true } },
        serviceProduct: { select: { id: true, title: true, metadata: true } },
        psnAccount: { select: { id: true, label: true, psnEmail: true } },
      },
    });
    return NextResponse.json(orders);
  }

  // Return PS Plus products
  const products = await prisma.serviceProduct.findMany({
    where: { type: "PS_PLUS" },
    orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
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
      const {
        id,
        tier,
        durationMonths,
        priceAznCents,
        discountedPriceAznCents,
        originalPriceAznCents,
        imageUrl,
        isActive,
        sortOrder,
      } = body;

      const tierStr = String(tier ?? "");
      const dur = Number(durationMonths);
      const basePrice = Number(priceAznCents);
      const discounted = Number(discountedPriceAznCents);
      const originalLegacy = Number(originalPriceAznCents);

      if (!["ESSENTIAL", "EXTRA", "DELUXE"].includes(tierStr)) {
        return NextResponse.json({ error: "Tier düzgün deyil" }, { status: 400 });
      }
      if (![1, 3, 12].includes(dur)) {
        return NextResponse.json({ error: "Müddət 1, 3 və ya 12 ay olmalıdır" }, { status: 400 });
      }
      if (!Number.isFinite(basePrice) || basePrice <= 0) {
        return NextResponse.json({ error: "Qiymət düzgün deyil" }, { status: 400 });
      }

      // New mode: basePrice + optional discounted price.
      if (Number.isFinite(discounted) && discounted > 0 && discounted >= basePrice) {
        return NextResponse.json(
          { error: "Endirimli qiymət satış qiymətindən kiçik olmalıdır" },
          { status: 400 }
        );
      }

      // Back-compat: old payload uses `originalPriceAznCents` where `priceAznCents`
      // already points to the discounted amount.
      const finalPrice = Number.isFinite(discounted) && discounted > 0
        ? Math.round(discounted)
        : Math.round(basePrice);
      const originalPriceForUi =
        Number.isFinite(discounted) && discounted > 0
          ? Math.round(basePrice)
          : Number.isFinite(originalLegacy) && originalLegacy > finalPrice
            ? Math.round(originalLegacy)
            : null;

      const tierLabel: Record<string, string> = { ESSENTIAL: "Essential", EXTRA: "Extra", DELUXE: "Deluxe" };
      const title = `PS Plus ${tierLabel[tierStr]} — ${dur} ay`;

      const payload = {
        type: "PS_PLUS" as const,
        title,
        imageUrl: typeof imageUrl === "string" && imageUrl.trim() ? imageUrl.trim() : null,
        priceAznCents: finalPrice,
        isActive: Boolean(isActive ?? true),
        sortOrder: Number(sortOrder || 0),
        metadata: {
          tier: tierStr,
          durationMonths: dur,
          originalPriceAznCents: originalPriceForUi,
        },
      };

      if (id) {
        const p = await prisma.serviceProduct.update({ where: { id }, data: payload });
        return NextResponse.json(p);
      } else {
        const p = await prisma.serviceProduct.create({ data: payload });
        return NextResponse.json(p);
      }
    }

    if (action === "DELETE_PRODUCT") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });
      await prisma.serviceProduct.delete({ where: { id } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Bilinməyən action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Xəta baş verdi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
