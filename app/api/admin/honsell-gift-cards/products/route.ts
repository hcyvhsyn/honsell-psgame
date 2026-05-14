import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import {
  HONSELL_GIFT_CARD_PRODUCT_IDS,
  HONSELL_GIFT_CARD_SERVICE_TYPE,
} from "@/lib/honsellGiftCard";

export const runtime = "nodejs";

/**
 * Honsell hədiyyə kart nominal məhsulunu (ServiceProduct) yeniləyir.
 * Yalnız `title`, `description`, `imageUrl`, `isActive` redaktə oluna bilər —
 * `priceAznCents` və `metadata.denominationAzn` migration ilə sabit qalır.
 */
export async function PATCH(req: Request) {
  await requireAdmin();

  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : "";

  if (!HONSELL_GIFT_CARD_PRODUCT_IDS.includes(id as (typeof HONSELL_GIFT_CARD_PRODUCT_IDS)[number])) {
    return NextResponse.json(
      { error: "Etibarsız hədiyyə kart məhsulu." },
      { status: 400 },
    );
  }

  const data: {
    title?: string;
    description?: string | null;
    imageUrl?: string | null;
    isActive?: boolean;
  } = {};

  if (typeof body.title === "string" && body.title.trim()) {
    data.title = body.title.trim();
  }
  if (typeof body.description === "string") {
    data.description = body.description.trim() || null;
  }
  if (typeof body.imageUrl === "string") {
    const v = body.imageUrl.trim();
    data.imageUrl = v.length > 0 ? v : null;
  }
  if (typeof body.isActive === "boolean") {
    data.isActive = body.isActive;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Yenilənəcək sahə yoxdur." }, { status: 400 });
  }

  // Şərt: yalnız type=HONSELL_GIFT_CARD olan sətri yenilə (təhlükəsizlik).
  const updated = await prisma.serviceProduct.updateMany({
    where: { id, type: HONSELL_GIFT_CARD_SERVICE_TYPE },
    data,
  });

  if (updated.count !== 1) {
    return NextResponse.json({ error: "Məhsul tapılmadı." }, { status: 404 });
  }

  const product = await prisma.serviceProduct.findUnique({ where: { id } });
  return NextResponse.json({ ok: true, product });
}
