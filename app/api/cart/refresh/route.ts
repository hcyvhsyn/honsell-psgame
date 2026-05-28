import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";

export const runtime = "nodejs";

/**
 * Səbətdəki məhsulların fresh qiymətlərini qaytarır.
 * localStorage-də cached olan finalAzn endirim bitdikdən sonra köhnəlir;
 * bu endpoint vasitəsilə client səbəti yeniləyir ki, checkout-da
 * gözlənilməz qiymət dəyişikliyi olmasın.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body?.ids)
    ? Array.from(
        new Set(
          (body.ids as unknown[]).filter(
            (v): v is string => typeof v === "string" && v.length > 0,
          ),
        ),
      )
    : [];

  if (ids.length === 0) {
    return NextResponse.json({ prices: [], missing: [] });
  }

  const [games, services, settings] = await Promise.all([
    prisma.game.findMany({
      where: { id: { in: ids }, isActive: true },
      select: {
        id: true,
        priceTryCents: true,
        discountTryCents: true,
        discountEndAt: true,
        // Needed so Epic rows get positional pricing (computeDisplayPrice
        // delegates to the Epic model on these fields).
        store: true,
        priceUsdCents: true,
        discountUsdCents: true,
      },
    }),
    prisma.serviceProduct.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true, priceAznCents: true },
    }),
    getSettings(),
  ]);

  // `store` is returned so the client can heal cart items that were added
  // without it (older carts in localStorage, or add-paths that omitted the
  // field). The cart UI uses it to pick the PSN vs Epic account selector.
  const prices: { id: string; finalAzn: number; store?: string }[] = [];
  for (const g of games) {
    prices.push({
      id: g.id,
      finalAzn: computeDisplayPrice(g, settings).finalAzn,
      store: g.store ?? "PS",
    });
  }
  for (const s of services) {
    prices.push({ id: s.id, finalAzn: s.priceAznCents / 100 });
  }

  const available = new Set(prices.map((p) => p.id));
  const missing = ids.filter((id) => !available.has(id));

  return NextResponse.json({ prices, missing });
}
