import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validatePromoForOrder, type PromoScopeItem } from "@/lib/promoCodes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kupon preview validasiyası. Client səbətdəki sətirləri göndərir, endirimi
 * göstərmək üçün yoxlanılır. Checkout-da server YENİDƏN (server qiymətləri ilə)
 * validasiya edir — bu endpoint yalnız UI preview üçündür.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Giriş tələb olunur", discountCents: 0 }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const code = String(body?.code ?? "");
  const rawItems: unknown[] = Array.isArray(body?.items) ? body.items : [];

  const items: PromoScopeItem[] = rawItems
    .map((it) => {
      const o = it as { id?: unknown; productType?: unknown; finalAzn?: unknown; qty?: unknown };
      const productId = String(o.id ?? "");
      const productType = String(o.productType ?? "");
      const finalAzn = Number(o.finalAzn ?? 0);
      const qty = Math.max(1, Number(o.qty ?? 1));
      const lineCents = Math.round(finalAzn * 100) * qty;
      return { productId, productType, lineCents };
    })
    .filter((i) => i.lineCents > 0);

  if (items.length === 0) {
    return NextResponse.json({ ok: false, message: "Səbət boşdur", discountCents: 0 });
  }

  const result = await validatePromoForOrder(prisma, { code, userId: user.id, items });
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message, discountCents: 0 });
  }
  return NextResponse.json({
    ok: true,
    message: "",
    discountCents: result.discountCents,
    code: result.promo.code,
  });
}
