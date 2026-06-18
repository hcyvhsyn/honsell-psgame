import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserReviewablePurchases } from "@/lib/userPurchasedProducts";
import { getSettings } from "@/lib/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/reviews/my-products
 * Cari istifadəçinin rəy yazıla bilən (hələ rəy yazılmamış) uğurlu alışları —
 * anasayfa rəy modalında "hansı məhsula rəy yazırsan?" seçimi üçün. Hər alışda
 * qiymət var ki, modal 1% cashback məbləğini göstərə bilsin.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [purchases, settings] = await Promise.all([
    getUserReviewablePurchases(user.id),
    getSettings(),
  ]);

  return NextResponse.json({
    purchases,
    cashbackRatePct: settings.reviewCashbackRatePct,
    name: user.name ?? user.email.split("@")[0],
  });
}
