import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  buildCampaignWhatsappText,
  buildCampaignReviewWhatsappText,
  reviewInviteUrl,
  snapshotGamesByProductIds,
} from "@/lib/campaigns";
import { isWasenderConfigured, normalizeToE164, sendWasenderText } from "@/lib/wasender";
import { unsubscribeUrl } from "@/lib/marketing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST → kampaniya məzmununu cari adminin öz email/nömrəsinə test kimi göndərir.
 * body: { title, messageText, productIds[], sendEmail, sendWhatsapp }
 */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  const body = await req.json().catch(() => ({}));

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const kind = body.kind === "REVIEW_INVITE" ? "REVIEW_INVITE" : "PROMO";
  const isReview = kind === "REVIEW_INVITE";
  const messageText = typeof body.messageText === "string" ? body.messageText.trim() : "";
  const productIds: string[] = Array.isArray(body.productIds)
    ? body.productIds.filter((x: unknown): x is string => typeof x === "string")
    : [];
  const sendEmail = Boolean(body.sendEmail);
  const sendWhatsapp = Boolean(body.sendWhatsapp);

  if (!title) return NextResponse.json({ error: "Başlıq boş ola bilməz." }, { status: 400 });
  if (!isReview && productIds.length === 0) {
    return NextResponse.json({ error: "Ən azı bir oyun seçin." }, { status: 400 });
  }
  if (!sendEmail && !sendWhatsapp) {
    return NextResponse.json({ error: "Ən azı bir kanal seçin." }, { status: 400 });
  }

  const games = productIds.length ? await snapshotGamesByProductIds(productIds) : [];
  if (!isReview && games.length === 0) {
    return NextResponse.json({ error: "Seçilmiş oyunlar tapılmadı." }, { status: 400 });
  }

  const out: { email?: string; whatsapp?: string } = {};

  if (sendEmail) {
    try {
      const { sendCampaignEmail } = await import("@/lib/resend");
      await sendCampaignEmail({
        email: admin.email,
        userName: admin.name?.split(" ")[0] ?? admin.email.split("@")[0],
        title,
        messageText,
        unsubscribeUrl: unsubscribeUrl(admin.id),
        games,
        kind,
        reviewUrl: reviewInviteUrl(),
      });
      out.email = "sent";
    } catch (e) {
      out.email = `error: ${e instanceof Error ? e.message : "send error"}`;
    }
  }

  if (sendWhatsapp) {
    const to = normalizeToE164(admin.phone);
    if (!isWasenderConfigured()) {
      out.whatsapp = "error: WhatsApp inteqrasiyası konfiqurasiya edilməyib.";
    } else if (!to) {
      out.whatsapp = "error: Admin nömrəsi yoxdur və ya yanlış formatdadır.";
    } else {
      const waText = isReview
        ? buildCampaignReviewWhatsappText(messageText)
        : buildCampaignWhatsappText(messageText, games);
      const res = await sendWasenderText({ to, text: waText });
      out.whatsapp = res.ok ? "sent" : `error: ${res.error}`;
    }
  }

  return NextResponse.json({ ok: true, result: out });
}
