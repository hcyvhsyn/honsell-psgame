import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserPurchasedProducts } from "@/lib/userPurchasedProducts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/reviews/my-products
 * Cari istifadəçinin uğurla aldığı məhsulların siyahısı — anasayfa rəy
 * modalında "hansı məhsula rəy yazırsan?" seçimi üçün.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const products = await getUserPurchasedProducts(user.id);
  return NextResponse.json({
    products,
    name: user.name ?? user.email.split("@")[0],
  });
}
