import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  buildCampaignWhatsappText,
  buildCampaignReviewWhatsappText,
  reviewInviteUrl,
  snapshotGamesByProductIds,
} from "@/lib/campaigns";
import { renderCampaignEmailHtml } from "@/lib/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST → kampaniyanın göndərmədən əvvəlki önizləməsi.
 * body: { title, messageText, productIds[] }
 * Cavab: { emailHtml, whatsappText }
 *
 * Önizləmədə alıcı yoxdur, ona görə linklər izləməsiz birbaşa oyun səhifəsidir.
 */
export async function POST(req: Request) {
  await requireAdmin();
  const body = await req.json().catch(() => ({}));

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const kind = body.kind === "REVIEW_INVITE" ? "REVIEW_INVITE" : "PROMO";
  const isReview = kind === "REVIEW_INVITE";
  const messageText = typeof body.messageText === "string" ? body.messageText.trim() : "";
  const productIds: string[] = Array.isArray(body.productIds)
    ? body.productIds.filter((x: unknown): x is string => typeof x === "string")
    : [];

  const games = productIds.length ? await snapshotGamesByProductIds(productIds) : [];

  const emailHtml = renderCampaignEmailHtml({
    userName: "Müştəri",
    title: title || "Başlıq",
    messageText,
    unsubscribeUrl: "#",
    games,
    kind,
    reviewUrl: reviewInviteUrl(),
  });

  const whatsappText = isReview
    ? buildCampaignReviewWhatsappText(messageText)
    : buildCampaignWhatsappText(messageText, games);

  return NextResponse.json({ emailHtml, whatsappText });
}
