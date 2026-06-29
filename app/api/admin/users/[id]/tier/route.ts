import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAdminAction } from "@/lib/adminAudit";
import { getSettings } from "@/lib/pricing";
import { sendSponsoredWhatsApp } from "@/lib/orderNotifications";

export const runtime = "nodejs";

/**
 * İstifadəçinin müştəri seqmentini (tier) təyin edir.
 *   body: { tierId: string | null }   — null → standart (default) seqment.
 * Köhnə `isSponsored` bayrağı seçilmiş tier-in slug-una görə sinxronlaşır
 * ("sponsorlu" → true, əks halda false) ki, geriyə uyğunluq pozulmasın.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const tierId = typeof body.tierId === "string" && body.tierId ? body.tierId : null;

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, phone: true, referralCode: true, isSponsored: true },
  });
  if (!target) return NextResponse.json({ error: "İstifadəçi tapılmadı." }, { status: 404 });

  let tierSlug: string | null = null;
  let tierName = "Standart";
  if (tierId) {
    const tier = await prisma.customerTier.findUnique({
      where: { id: tierId },
      select: { slug: true, name: true },
    });
    if (!tier) return NextResponse.json({ error: "Seqment tapılmadı." }, { status: 404 });
    tierSlug = tier.slug;
    tierName = tier.name;
  }

  const becomesSponsor = tierSlug === "sponsorlu";

  await prisma.user.update({
    where: { id: params.id },
    data: {
      tierId,
      isSponsored: becomesSponsor,
      ...(becomesSponsor && !target.isSponsored ? { sponsoredAt: new Date() } : {}),
      ...(!becomesSponsor ? { sponsoredAt: null } : {}),
    },
  });

  await logAdminAction({
    actorId: admin.id,
    targetUserId: params.id,
    action: "user.tier.set",
    details: JSON.stringify({ tierId, tierSlug, tierName }),
  });

  // Yeni sponsorlu edildikdə müştəriyə WhatsApp (best-effort), köhnə davranış.
  let whatsapp: { ok: boolean; reason?: string } | null = null;
  if (becomesSponsor && !target.isSponsored) {
    const settings = await getSettings();
    whatsapp = await sendSponsoredWhatsApp({
      phone: target.phone,
      userName: target.name,
      pct: settings.sponsoredReferralGamesPct,
      referralCode: target.referralCode,
    });
  }

  return NextResponse.json({ ok: true, whatsapp });
}
