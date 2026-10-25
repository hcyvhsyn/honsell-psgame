import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";
import { applyFlashDeal, getFlashDealOverrides } from "@/lib/flashDeals";
import { resolveBundlesForCart } from "@/lib/gameBundles";
import { resolveServiceBundlesForCart } from "@/lib/serviceBundles";
import { sellableGameWhere, sellableServiceWhere } from "@/lib/storeScope";

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
      // PS-only: Epic oyunu → `missing` → client səbətdən silir (lib/storeScope.ts).
      where: { id: { in: ids }, isActive: true, ...sellableGameWhere() },
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
      where: { id: { in: ids }, isActive: true, ...sellableServiceWhere() },
      select: { id: true, priceAznCents: true },
    }),
    getSettings(),
  ]);

  // `store` is returned so the client can heal cart items that were added
  // without it (older carts in localStorage, or add-paths that omitted the
  // field). The cart UI uses it to pick the PSN vs Epic account selector.
  // "Fürsətləri qaçırma" kampaniya qiymətləri — səbət də ana səhifədə görünən
  // rəqəmi göstərsin deyə eyni override burada da tətbiq olunur.
  const flashDeals = await getFlashDealOverrides(games.map((g) => g.id));

  // `originalAzn` — üstündən xətlənən list qiymət. Səbət onu YALNIZ buradan alır:
  // add-yolları çoxdur (kart, detal, reels, banner, axtarış, AI paneli) və hamısına
  // ayrı-ayrı sahə əlavə etmək əvəzinə tək server mənbəyi saxlanılır. Endirim
  // bitibsə `computeDisplayPrice` onsuz da `null` qaytarır, yəni köhnə səbətdəki
  // xətlənmiş qiymət özü sönür.
  const prices: {
    id: string;
    finalAzn: number;
    originalAzn?: number | null;
    store?: string;
  }[] = [];
  for (const g of games) {
    const display = applyFlashDeal(computeDisplayPrice(g, settings), flashDeals.get(g.id));
    prices.push({
      id: g.id,
      finalAzn: display.finalAzn,
      originalAzn: display.originalAzn,
      store: g.store ?? "PS",
    });
  }
  for (const s of services) {
    prices.push({ id: s.id, finalAzn: s.priceAznCents / 100, originalAzn: null });
  }

  // Oyun paketləri. Satıla bilməyən paket (deaktiv, vaxtı bitmiş, tərkibində
  // deaktiv oyun) map-ə düşmür → `missing` olur və client onu səbətdən silir.
  // Bu addım olmasa localStorage-dəki köhnə paket qiyməti checkout-un serverdə
  // hesabladığı qiymətlə uyğunsuz qalır.
  const bundles = await resolveBundlesForCart(ids);
  for (const b of bundles.values()) {
    prices.push({
      id: b.id,
      finalAzn: b.pricing.totalAznCents / 100,
      originalAzn:
        b.pricing.listTotalAznCents > b.pricing.totalAznCents
          ? b.pricing.listTotalAznCents / 100
          : null,
    });
  }

  // Xidmət dəstləri. Qiymətdən ƏLAVƏ olaraq tam tərkib də qaytarılır: dəst sətri
  // müştəri məlumatlarını (gmail/şifrə/hesablar) üzv-üzv daşıyır və admin dəsti
  // dəyişəndə (üzv əlavə/silmə, tələb olunan məlumatın dəyişməsi) səbətdəki
  // snapshot özünü yeniləməlidir. Client doldurulmuş `details`-i saxlayır.
  const serviceBundles = await resolveServiceBundlesForCart(ids);
  const serviceBundlePayload = Array.from(serviceBundles.values()).map((b) => {
    prices.push({
      id: b.id,
      finalAzn: b.pricing.totalAznCents / 100,
      originalAzn:
        b.pricing.listTotalAznCents > b.pricing.totalAznCents
          ? b.pricing.listTotalAznCents / 100
          : null,
    });
    return {
      id: b.id,
      items: b.pricing.items.map((i) => ({
        serviceProductId: i.serviceProductId,
        title: i.title,
        imageUrl: i.imageUrl,
        serviceType: i.serviceType,
        listAznCents: i.listAznCents,
        bundleAznCents: i.bundleAznCents,
        requirement: i.requirement,
      })),
    };
  });

  const available = new Set(prices.map((p) => p.id));
  const missing = ids.filter((id) => !available.has(id));

  return NextResponse.json({ prices, missing, serviceBundles: serviceBundlePayload });
}
