import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Header + ana səhifə CTA-ları üçün YÜNGÜL sessiya endpoint-i.
 *
 * Niyə: əvvəl header (SiteHeaderServer), referral promo bar, referral CTA və
 * "rəy yaz" düyməsi user-i `getCurrentUser()` (cookies) ilə SERVER-də oxuyurdu →
 * bütün səhifələr dinamik (`no-store`) render olunurdu və edge-də keşlənə bilmirdi.
 * İndi həmin user-vəziyyəti client-də bu endpoint-dən gəlir → səhifələr statik/ISR
 * ola bilir (anında, edge-keşlənən HTML), user məlumatı isə paint-dən sonra yüklənir.
 *
 * Yüngül saxlanılır: ağır `/api/me` (PSN/Epic hesabları, loyalty) əvəzinə yalnız
 * header/CTA-nın ehtiyacı olan sahələr.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null });
  }

  const [commissionAgg, purchaseCount] = await Promise.all([
    prisma.transaction
      .aggregate({
        where: { beneficiaryId: user.id, type: "COMMISSION" },
        _sum: { amountAznCents: true },
      })
      .catch(() => ({ _sum: { amountAznCents: 0 } })),
    prisma.transaction
      .count({
        where: {
          userId: user.id,
          status: "SUCCESS",
          type: { in: ["PURCHASE", "SERVICE_PURCHASE"] },
        },
      })
      .catch(() => 0),
  ]);

  return NextResponse.json({
    user: {
      name: user.name,
      walletBalanceCents: user.walletBalance ?? 0,
      cashbackBalanceCents: user.cashbackBalanceCents ?? 0,
      referralCode: user.referralCode ?? null,
      earnedAznCents: commissionAgg._sum.amountAznCents ?? 0,
      hasPurchases: purchaseCount > 0,
    },
  });
}
