import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePartnerKey } from "@/lib/partnerAuth";
import { createWhatsappReviewInvite, reviewInviteBaseUrl } from "@/lib/whatsappReviewInvites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * CRM (crm.honsell.store) → rəy dəvəti. Bank ödənişi qeyd olunanda admin
 * CRM-dən məhsulu seçir, buraya vurulur, müştəriyə WhatsApp-la /rey/<token>
 * linki gedir.
 *
 *   POST /api/partner/review-invites
 *   Header: X-API-Key: <PARTNER_API_KEY>
 *   Body:   { phone, items: [{kind:"GAME"|"SERVICE", id}], platform?, externalRef? }
 *
 *   GET  /api/partner/review-invites?refs=a,b,c   → status sinxronu
 *
 * Bütün ağır məntiq (qiymət hesablama, satış qeydi, WhatsApp) admin route ilə
 * ortaq [lib/whatsappReviewInvites.ts] içindədir.
 */
export async function POST(req: Request) {
  const denied = requirePartnerKey(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const result = await createWhatsappReviewInvite(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    alreadyExists: result.alreadyExists,
    invite: result.invite,
    customer: result.customer,
    whatsappSent: result.whatsappSent,
    whatsappError: result.whatsappError,
  });
}

/** Verilmiş xarici açarlar üzrə dəvətin son vəziyyəti (CRM-də ⭐ göstərmək üçün). */
export async function GET(req: Request) {
  const denied = requirePartnerKey(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const refs = (url.searchParams.get("refs") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 200);
  if (refs.length === 0) return NextResponse.json({ items: [] });

  const rows = await prisma.whatsappReviewInvite.findMany({
    where: { externalRef: { in: refs } },
    select: {
      externalRef: true,
      token: true,
      status: true,
      rating: true,
      testimonialId: true,
      usedAt: true,
    },
  });

  return NextResponse.json({
    items: rows.map((r) => ({
      externalRef: r.externalRef,
      status: r.status,
      rating: r.rating,
      testimonialId: r.testimonialId,
      usedAt: r.usedAt?.toISOString() ?? null,
      url: `${reviewInviteBaseUrl()}/rey/${r.token}`,
    })),
  });
}
