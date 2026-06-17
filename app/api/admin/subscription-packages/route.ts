import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { revalidateServices } from "@/lib/revalidate";
import { LANDING_SERVICE_TYPES, LANDING_SERVICE_ORDER } from "@/lib/landingServices";

export const runtime = "nodejs";

// Ana səhifədəki "Abunəlik paketləri" vitrinində iştirak edən servis
// məhsullarını idarə edir: vitrindən gizlət/göstər və ya tamamilə sil.

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const products = await prisma.serviceProduct.findMany({
    where: { type: { in: [...LANDING_SERVICE_TYPES] } },
    select: {
      id: true,
      type: true,
      title: true,
      imageUrl: true,
      priceAznCents: true,
      isActive: true,
      sortOrder: true,
      metadata: true,
    },
  });

  const sorted = products.slice().sort((a, b) => {
    const orderA = LANDING_SERVICE_ORDER.get(a.type) ?? 999;
    const orderB = LANDING_SERVICE_ORDER.get(b.type) ?? 999;
    return orderA - orderB || a.sortOrder - b.sortOrder || a.priceAznCents - b.priceAznCents;
  });

  return NextResponse.json(sorted);
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { action, id } = body;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });
  }

  try {
    if (action === "TOGGLE_LANDING") {
      const hidden = Boolean(body.hidden);

      const product = await prisma.serviceProduct.findUnique({
        where: { id },
        select: { type: true, metadata: true },
      });
      if (!product) {
        return NextResponse.json({ error: "Məhsul tapılmadı" }, { status: 404 });
      }
      if (!LANDING_SERVICE_TYPES.includes(product.type as (typeof LANDING_SERVICE_TYPES)[number])) {
        return NextResponse.json({ error: "Bu məhsul vitrin tipinə aid deyil" }, { status: 400 });
      }

      const meta =
        product.metadata && typeof product.metadata === "object" && !Array.isArray(product.metadata)
          ? (product.metadata as Record<string, unknown>)
          : {};

      await prisma.serviceProduct.update({
        where: { id },
        data: { metadata: { ...meta, hideFromLanding: hidden } },
      });

      revalidateServices();
      return NextResponse.json({ ok: true, hidden });
    }

    if (action === "DELETE_PRODUCT") {
      try {
        await prisma.serviceProduct.delete({ where: { id } });
      } catch {
        // FK: məhsul sifariş/abunəlik/kodlarla bağlıdırsa silinə bilmir.
        return NextResponse.json(
          {
            error:
              "Bu məhsul sifariş və ya abunəliklərlə bağlı olduğu üçün silinə bilmir. Onun əvəzinə vitrindən gizlədin.",
          },
          { status: 409 },
        );
      }
      revalidateServices();
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Bilinməyən action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Xəta baş verdi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
