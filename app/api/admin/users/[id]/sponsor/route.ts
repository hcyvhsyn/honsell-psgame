import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAdminAction } from "@/lib/adminAudit";
import { getSettings } from "@/lib/pricing";
import { sendSponsoredWhatsApp } from "@/lib/orderNotifications";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const sponsor = Boolean(body.sponsor);

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      phone: true,
      referralCode: true,
      isSponsored: true,
    },
  });
  if (!target) return NextResponse.json({ error: "İstifadəçi tapılmadı." }, { status: 404 });

  await prisma.user.update({
    where: { id: params.id },
    data: sponsor
      ? { isSponsored: true, sponsoredAt: new Date() }
      : { isSponsored: false, sponsoredAt: null },
  });

  await logAdminAction({
    actorId: admin.id,
    targetUserId: params.id,
    action: sponsor ? "user.sponsor.enable" : "user.sponsor.disable",
    details: null,
  });

  // Statusu yeni açanda müştəriyə WhatsApp ilə məlumat göndər (best-effort).
  let whatsapp: { ok: boolean; reason?: string } | null = null;
  if (sponsor && !target.isSponsored) {
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
