import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isValidProductGiftFormat,
  normalizeProductGiftCode,
  productGiftKindLabel,
  productGiftNeedsAccount,
} from "@/lib/productGift";

export const runtime = "nodejs";

/**
 * Hədiyyə kodunu yoxlayır (claim ETMƏDƏN) — açma səhifəsi məhsulu və lazım olan
 * çatdırılma hesabını (PSN/Epic) əvvəlcədən göstərə bilsin deyə.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const raw = typeof body?.code === "string" ? body.code : "";
  const code = normalizeProductGiftCode(raw);

  if (!isValidProductGiftFormat(code)) {
    return NextResponse.json({ ok: false, reason: "INVALID_FORMAT" }, { status: 400 });
  }

  const gift = await prisma.productGift.findUnique({
    where: { code },
    select: {
      status: true,
      productKind: true,
      store: true,
      titleSnap: true,
      imageSnap: true,
      amountAznCents: true,
      giftMessage: true,
      expiresAt: true,
    },
  });

  if (!gift) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }
  if (gift.status !== "UNCLAIMED") {
    return NextResponse.json({ ok: false, reason: "ALREADY_CLAIMED" }, { status: 409 });
  }
  if (gift.expiresAt.getTime() <= Date.now()) {
    return NextResponse.json({ ok: false, reason: "EXPIRED" }, { status: 410 });
  }

  return NextResponse.json({
    ok: true,
    gift: {
      productKind: gift.productKind,
      kindLabel: productGiftKindLabel(gift.productKind),
      store: gift.store,
      title: gift.titleSnap,
      imageUrl: gift.imageSnap,
      amountAzn: gift.amountAznCents / 100,
      message: gift.giftMessage,
      needsAccount: productGiftNeedsAccount(gift.productKind, gift.store),
    },
  });
}
