import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  BONUS_WALLET_MIN_CENTS,
  BONUS_WALLET_CREDIT_CENTS,
  BONUS_COUPON_MIN_CENTS,
  BONUS_COMMUNITY_MIN_ITEMS,
  BONUS_COUPON_PERCENT,
  BONUS_COUPON_VALID_DAYS,
} from "@/lib/bonusThresholds";

export {
  BONUS_WALLET_MIN_CENTS,
  BONUS_WALLET_CREDIT_CENTS,
  BONUS_COUPON_MIN_CENTS,
  BONUS_COMMUNITY_MIN_ITEMS,
  BONUS_COUPON_PERCENT,
  BONUS_COUPON_VALID_DAYS,
};

/**
 * Checkout bonus mükafatları — HƏR İKİ settlement yolu (cüzdan + epoint) eyni
 * funksiyanı çağırır. Yalnız ödəniş TƏSDİQLƏNƏNDƏ (tx içində) verilir.
 *
 * Qaydalar:
 *   • sifariş ≥ 12 AZN → cüzdana +1 AZN
 *   • sifariş ≥ 20 AZN → növbəti alışa 10% xüsusi kupon (userId-yə bağlı)
 *   • məhsul sayı ≥ 2 → community kampaniyasına giriş
 *
 * İdempotentlik: `BonusGrant.orderCode @unique` — hər sifariş üçün bir dəfə.
 */

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomBonusCode(): string {
  const bytes = randomBytes(6);
  let out = "BONUS-";
  for (let i = 0; i < 6; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

/** Unikal bonus kupon kodu (tx-dən KƏNARDA çağırılır). */
export async function generateUniqueBonusPromoCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomBonusCode();
    const existing = await prisma.promoCode.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw new Error("Bonus kupon kodu generasiyası uğursuz oldu (kolliziya).");
}

type BonusDb = {
  bonusGrant: {
    create(args: {
      data: { userId: string; orderCode: string; orderTotalCents: number; itemCount: number };
    }): Promise<unknown>;
    update(args: {
      where: { orderCode: string };
      data: {
        walletCreditCents: number;
        bonusPromoCodeId: string | null;
        communityAccess: boolean;
      };
    }): Promise<unknown>;
  };
  user: {
    update(args: {
      where: { id: string };
      data:
        | { walletBalance: { increment: number } }
        | { communityCampaignAccess: boolean };
    }): Promise<unknown>;
  };
  transaction: {
    create(args: {
      data: { userId: string; type: string; status: string; amountAznCents: number; metadata: string };
    }): Promise<unknown>;
  };
  promoCode: {
    create(args: {
      data: {
        code: string;
        kind: string;
        value: number;
        userId: string;
        source: string;
        perUserLimit: number;
        usageLimit: number;
        isActive: boolean;
        expiresAt: Date;
      };
    }): Promise<{ id: string }>;
  };
};

export type BonusGrantResult = {
  walletCreditCents: number;
  bonusCouponCode: string | null;
  communityAccess: boolean;
};

/**
 * Bonusları tətbiq edir (tx içində, atomik). Artıq verilibsə (BonusGrant.orderCode
 * mövcud) null qaytarır. `bonusCouponCode` tx-dən əvvəl generasiya olunub ötürülür.
 */
export async function grantCheckoutBonuses(
  db: BonusDb,
  p: {
    userId: string;
    orderCode: string;
    orderTotalCents: number;
    itemCount: number;
    bonusCouponCode: string;
  },
): Promise<BonusGrantResult | null> {
  // İdempotentlik markerini əvvəlcə iddia et.
  try {
    await db.bonusGrant.create({
      data: {
        userId: p.userId,
        orderCode: p.orderCode,
        orderTotalCents: p.orderTotalCents,
        itemCount: p.itemCount,
      },
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") return null; // artıq verilib
    throw err;
  }

  const walletCreditCents = p.orderTotalCents >= BONUS_WALLET_MIN_CENTS ? BONUS_WALLET_CREDIT_CENTS : 0;
  if (walletCreditCents > 0) {
    await db.user.update({
      where: { id: p.userId },
      data: { walletBalance: { increment: walletCreditCents } },
    });
    await db.transaction.create({
      data: {
        userId: p.userId,
        type: "DEPOSIT",
        status: "SUCCESS",
        amountAznCents: walletCreditCents,
        metadata: JSON.stringify({ kind: "BONUS_WALLET_CREDIT", orderCode: p.orderCode }),
      },
    });
  }

  let bonusPromoCodeId: string | null = null;
  let bonusCouponCode: string | null = null;
  if (p.orderTotalCents >= BONUS_COUPON_MIN_CENTS) {
    const expiresAt = new Date(Date.now() + BONUS_COUPON_VALID_DAYS * 24 * 60 * 60 * 1000);
    const promo = await db.promoCode.create({
      data: {
        code: p.bonusCouponCode,
        kind: "PERCENT",
        value: BONUS_COUPON_PERCENT,
        userId: p.userId,
        source: "BONUS_REWARD",
        perUserLimit: 1,
        usageLimit: 1,
        isActive: true,
        expiresAt,
      },
    });
    bonusPromoCodeId = promo.id;
    bonusCouponCode = p.bonusCouponCode;
  }

  const communityAccess = p.itemCount >= BONUS_COMMUNITY_MIN_ITEMS;
  if (communityAccess) {
    await db.user.update({
      where: { id: p.userId },
      data: { communityCampaignAccess: true },
    });
  }

  await db.bonusGrant.update({
    where: { orderCode: p.orderCode },
    data: { walletCreditCents, bonusPromoCodeId, communityAccess },
  });

  return { walletCreditCents, bonusCouponCode, communityAccess };
}
