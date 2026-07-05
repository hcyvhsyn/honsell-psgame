import type { PromoCode } from "@/lib/generated/prisma/client";

/**
 * Kupon validasiyası — TƏK mənbə. Həm `/api/cart/coupon` preview endpoint-i,
 * həm də HƏR İKİ checkout settlement yolu (cüzdan + epoint) eyni məntiqi işlədir
 * ki, endirim hesablanması fərqlənməsin.
 */

export function normalizePromoCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export type PromoScopeItem = { productType: string; lineCents: number };

export type PromoValidation =
  | { ok: true; discountCents: number; promo: PromoCode }
  | { ok: false; message: string };

type ValidateDb = {
  promoCode: {
    findUnique(args: { where: { code: string } }): Promise<PromoCode | null>;
  };
  promoRedemption: {
    count(args: { where: { promoCodeId: string; userId: string } }): Promise<number>;
  };
};

const MSG = {
  notFound: "Bu kupon kodu tapılmadı.",
  expired: "Bu kuponun istifadə müddəti bitib.",
  scope: "Bu kupon bu məhsullara tətbiq olunmur.",
  min: "Minimum sifariş məbləği tamamlanmayıb.",
} as const;

/** Endirimi hesablayır (yoxlama keçibsə). scope + total qəpiklə. */
export function computePromoDiscount(
  promo: PromoCode,
  scopeCents: number,
  totalCents: number,
): number {
  let discount = 0;
  if (promo.kind === "FIXED") {
    discount = Math.min(promo.value, scopeCents);
  } else {
    discount = Math.round((scopeCents * promo.value) / 100);
    if (promo.maxDiscountCents != null) discount = Math.min(discount, promo.maxDiscountCents);
  }
  return Math.max(0, Math.min(discount, totalCents));
}

export async function validatePromoForOrder(
  db: ValidateDb,
  params: { code: string; userId: string; items: PromoScopeItem[]; now?: Date },
): Promise<PromoValidation> {
  const code = normalizePromoCode(params.code);
  if (!code) return { ok: false, message: MSG.notFound };

  const promo = await db.promoCode.findUnique({ where: { code } });
  // Tapılmır / deaktiv / başqa istifadəçiyə xüsusi → "tapılmadı" (mövcudluğu sızdırma).
  if (!promo || !promo.isActive || (promo.userId && promo.userId !== params.userId)) {
    return { ok: false, message: MSG.notFound };
  }

  const now = params.now ?? new Date();
  if (promo.startsAt && now < promo.startsAt) return { ok: false, message: MSG.expired };
  if (promo.expiresAt && now > promo.expiresAt) return { ok: false, message: MSG.expired };
  if (promo.usageLimit != null && promo.usedCount >= promo.usageLimit) {
    return { ok: false, message: MSG.expired };
  }

  const usedByUser = await db.promoRedemption.count({
    where: { promoCodeId: promo.id, userId: params.userId },
  });
  if (usedByUser >= promo.perUserLimit) return { ok: false, message: MSG.expired };

  const totalCents = params.items.reduce((s, i) => s + Math.max(0, i.lineCents), 0);
  const scopeCents =
    promo.productTypes.length === 0
      ? totalCents
      : params.items
          .filter((i) => promo.productTypes.includes(i.productType))
          .reduce((s, i) => s + Math.max(0, i.lineCents), 0);

  if (promo.productTypes.length > 0 && scopeCents === 0) {
    return { ok: false, message: MSG.scope };
  }
  if (scopeCents < promo.minOrderCents) return { ok: false, message: MSG.min };

  const discountCents = computePromoDiscount(promo, scopeCents, totalCents);
  return { ok: true, discountCents, promo };
}

type RedeemDb = {
  promoRedemption: {
    create(args: {
      data: {
        promoCodeId: string;
        userId: string;
        discountCents: number;
        orderCode: string;
        transactionId: string | null;
      };
    }): Promise<unknown>;
  };
  promoCode: {
    update(args: {
      where: { id: string };
      data: { usedCount: { increment: number } };
    }): Promise<unknown>;
  };
};

/** Settle anında (tx içində) redemption yazır + usedCount++. orderCode @unique
 *  ikiqat redemption-u bloklayır (eyni tx-də increment olduğundan sayğac artmır). */
export async function applyPromoRedemption(
  db: RedeemDb,
  p: { promo: PromoCode; userId: string; orderCode: string; discountCents: number; transactionId: string | null },
): Promise<void> {
  if (p.discountCents <= 0) return;
  await db.promoRedemption.create({
    data: {
      promoCodeId: p.promo.id,
      userId: p.userId,
      discountCents: p.discountCents,
      orderCode: p.orderCode,
      transactionId: p.transactionId,
    },
  });
  await db.promoCode.update({
    where: { id: p.promo.id },
    data: { usedCount: { increment: 1 } },
  });
}
