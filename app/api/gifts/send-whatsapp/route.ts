import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { SITE_URL } from "@/lib/site";
import {
  isWasenderConfigured,
  normalizeToE164,
  sendWasenderText,
} from "@/lib/wasender";
import {
  formatProductGiftCode,
  isValidProductGiftFormat,
  normalizeProductGiftCode,
  PRODUCT_GIFT_CLAIM_PATH,
} from "@/lib/productGift";

export const runtime = "nodejs";

/**
 * Alıcının dostuna hədiyyə kodunu WhatsApp ilə göndərir. Mesajda: kimdən olduğu,
 * məhsul, alıcının mesajı, 11 simvollu kod və açma linki olur. WaSender qurulmayıbsa
 * client tərəfin açması üçün wa.me linki qaytarılır (fallback).
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const code = normalizeProductGiftCode(typeof body?.code === "string" ? body.code : "");
  const phone = normalizeToE164(typeof body?.phone === "string" ? body.phone : "");

  if (!isValidProductGiftFormat(code)) {
    return NextResponse.json({ ok: false, reason: "INVALID_FORMAT" }, { status: 400 });
  }
  if (!phone) {
    return NextResponse.json({ ok: false, reason: "INVALID_PHONE" }, { status: 400 });
  }

  const gift = await prisma.productGift.findUnique({ where: { code } });
  if (!gift || gift.purchasedById !== user.id) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }
  if (gift.status !== "UNCLAIMED") {
    return NextResponse.json({ ok: false, reason: "ALREADY_CLAIMED" }, { status: 409 });
  }

  const senderName = user.name?.trim() || "Bir dostunuz";
  const claimLink = `${SITE_URL}${PRODUCT_GIFT_CLAIM_PATH}?code=${code}`;
  const lines = [
    "🎁 Honsell PS Store — sizə hədiyyə var!",
    "",
    `${senderName} sizə «${gift.titleSnap}» hədiyyə etdi.`,
  ];
  if (gift.giftMessage) lines.push("", `💬 «${gift.giftMessage}»`);
  lines.push(
    "",
    `🔑 Hədiyyə kodu: ${formatProductGiftCode(code)}`,
    "",
    "Hədiyyəni açmaq üçün bu linkə keçin və kodu daxil edin:",
    claimLink,
  );
  const text = lines.join("\n");

  // WaSender qurulmayıbsa client wa.me ilə özü açsın.
  if (!isWasenderConfigured()) {
    return NextResponse.json({
      ok: false,
      reason: "WHATSAPP_UNAVAILABLE",
      waLink: `https://wa.me/${phone.replace(/^\+/, "")}?text=${encodeURIComponent(text)}`,
    });
  }

  const sent = await sendWasenderText({ to: phone, text });
  if (!sent.ok) {
    console.error("gift whatsapp send failed", sent.error);
    return NextResponse.json({
      ok: false,
      reason: "SEND_FAILED",
      waLink: `https://wa.me/${phone.replace(/^\+/, "")}?text=${encodeURIComponent(text)}`,
    });
  }

  return NextResponse.json({ ok: true });
}
