import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePartnerKey } from "@/lib/partnerAuth";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * CRM → mağaza: telefon nömrəsinə görə sayt hesab(lar)ı + son sifarişlər.
 *
 * `GET /api/partner/customers?phone=<p>[&phone=<p2>]`
 *
 * CRM müştəri səhifəsi bunu canlı oxuyur (data CRM-ə köçürülmür). Uyğunlaşma
 * telefonun SON 9 RƏQƏMİ ilə gedir — CRM-in `findOrCreateCustomerId` qaydası ilə
 * eyni; `User.phone` sərbəst formatda saxlanıldığı üçün ("+994 50 …", "050…")
 * SQL-də rəqəmlərə endirilir. Eyni nömrə ilə bir neçə hesab ola bilər — hamısı
 * qaytarılır (ən çox `MAX_USERS`).
 */

const MAX_USERS = 5;
const RECENT_ORDERS = 15;

function last9(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : null;
}

function parseMeta(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function GET(req: Request) {
  const denied = requirePartnerKey(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const keys = Array.from(
    new Set(url.searchParams.getAll("phone").map(last9).filter((k): k is string => k != null)),
  ).slice(0, 2);
  if (keys.length === 0) {
    return NextResponse.json({ error: "Düzgün telefon nömrəsi tələb olunur." }, { status: 400 });
  }

  const matched = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User"
    WHERE phone IS NOT NULL
      AND right(regexp_replace(phone, '[^0-9]', '', 'g'), 9) = ANY(${keys}::text[])
    ORDER BY "createdAt" ASC
    LIMIT ${MAX_USERS}
  `;
  if (matched.length === 0) return NextResponse.json({ users: [] });

  const ids = matched.map((m) => m.id);
  const [users, totals, recent] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: ids } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        disabled: true,
        emailVerified: true,
        createdAt: true,
        lastLoginAt: true,
        walletBalance: true,
        cashbackBalanceCents: true,
        referralBalanceCents: true,
        tier: { select: { name: true, displayName: true } },
      },
    }),
    prisma.transaction.groupBy({
      by: ["userId"],
      where: {
        userId: { in: ids },
        type: { in: ["PURCHASE", "SERVICE_PURCHASE"] },
        status: { not: "FAILED" },
      },
      _count: { _all: true },
      _sum: { amountAznCents: true },
      _max: { createdAt: true },
    }),
    prisma.transaction.findMany({
      where: { userId: { in: ids }, type: { in: ["PURCHASE", "SERVICE_PURCHASE"] } },
      orderBy: { createdAt: "desc" },
      take: RECENT_ORDERS * ids.length,
      select: {
        id: true,
        userId: true,
        type: true,
        status: true,
        amountAznCents: true,
        createdAt: true,
        metadata: true,
        game: { select: { title: true } },
        serviceProduct: { select: { title: true } },
      },
    }),
  ]);

  const totalsByUser = new Map(totals.map((t) => [t.userId, t]));

  return NextResponse.json({
    users: users.map((u) => {
      const t = totalsByUser.get(u.id);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        disabled: u.disabled,
        emailVerified: u.emailVerified,
        createdAt: u.createdAt.toISOString(),
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        tier: u.tier ? u.tier.displayName || u.tier.name : null,
        walletAzn: u.walletBalance / 100,
        cashbackAzn: u.cashbackBalanceCents / 100,
        referralAzn: u.referralBalanceCents / 100,
        orderCount: t?._count._all ?? 0,
        // Alış sətirləri mənfi yazılır (debet) — xərc müsbət göstərilir.
        spentAzn: Math.abs(t?._sum.amountAznCents ?? 0) / 100,
        lastOrderAt: t?._max.createdAt?.toISOString() ?? null,
        adminUrl: `${SITE_URL}/admin/users/${u.id}`,
        recentOrders: recent
          .filter((r) => r.userId === u.id)
          .slice(0, RECENT_ORDERS)
          .map((r) => {
            const meta = parseMeta(r.metadata);
            return {
              id: r.id,
              type: r.type,
              status: r.status,
              title: r.game?.title ?? r.serviceProduct?.title ?? "Məhsul",
              amountAzn: Math.abs(r.amountAznCents) / 100,
              orderCode: typeof meta.orderCode === "string" ? meta.orderCode : null,
              paymentSource: typeof meta.paymentSource === "string" ? meta.paymentSource : null,
              createdAt: r.createdAt.toISOString(),
            };
          }),
      };
    }),
  });
}
