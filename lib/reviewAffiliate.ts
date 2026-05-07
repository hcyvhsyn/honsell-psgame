/**
 * Rəy affiliate sisteminin nüvəsi:
 *  - Oyun səhifəsi `?via=<reviewId>` ilə açıldıqda 30 günlük HTTP-only cookie qoyulur.
 *  - Sifariş SUCCESS olduqda cookie-dən rəy ID-si oxunur, müəllifə komissiya yazılır.
 *  - Self-referral (alıcı == rəy müəllifi) qadağandır.
 *  - Eyni alış üçün təkrar komissiya yazılmır (idempotent).
 */

import { cookies } from "next/headers";

import {
  REVIEW_AFFILIATE_COOKIE,
  REVIEW_BODY_MIN,
  REVIEW_BODY_MAX,
  REVIEW_RATING_MIN,
  REVIEW_RATING_MAX,
  REVIEW_COMMENT_BODY_MIN,
  REVIEW_COMMENT_BODY_MAX,
} from "./reviewAffiliateConstants";

// Server-side modullar artıq mövcud import yolunu (`@/lib/reviewAffiliate`) saxlasın deyə re-export.
export {
  REVIEW_AFFILIATE_COOKIE,
  REVIEW_BODY_MIN,
  REVIEW_BODY_MAX,
  REVIEW_RATING_MIN,
  REVIEW_RATING_MAX,
  REVIEW_COMMENT_BODY_MIN,
  REVIEW_COMMENT_BODY_MAX,
};

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 gün

/**
 * `?via=<reviewId>` parametrini cookie-yə yazır. Boş və ya etibarsız id-lər nəzərə alınmır.
 * Yalnız route handler / server action / server component-də çağırıla bilər.
 */
export async function captureReviewAffiliateFromQuery(via: string | null | undefined) {
  if (!via || typeof via !== "string") return;
  const trimmed = via.trim();
  // CUID-lər təxmini olaraq 25 simvol olur — sərt deyil, yalnız zibili filtirləyir.
  if (trimmed.length < 8 || trimmed.length > 64) return;
  if (!/^[a-z0-9]+$/i.test(trimmed)) return;

  const store = await cookies();
  store.set(REVIEW_AFFILIATE_COOKIE, trimmed, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

/** Mövcud rəy ID-sini cookie-dən oxuyur. */
export async function readReviewAffiliateCookie(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(REVIEW_AFFILIATE_COOKIE)?.value ?? null;
  if (!raw) return null;
  if (raw.length < 8 || raw.length > 64) return null;
  if (!/^[a-z0-9]+$/i.test(raw)) return null;
  return raw;
}

/** Sifariş tamamlandıqdan sonra cookie-ni təmizləyir. */
export async function clearReviewAffiliateCookie() {
  const store = await cookies();
  store.delete(REVIEW_AFFILIATE_COOKIE);
}

/** Prisma client (yaxud tx client) üçün dar interfeys. */
type ReviewAffiliateDb = {
  gameReview: {
    findUnique(args: {
      where: { id: string };
      select: { id: true; userId: true; gameId: true; status: true };
    }): Promise<{ id: string; userId: string; gameId: string; status: string } | null>;
  };
  user: {
    update(args: {
      where: { id: string };
      data: { referralBalanceCents: { increment: number } };
    }): Promise<unknown>;
  };
  transaction: {
    findFirst(args: {
      where: { type: string; metadata: { contains: string } };
      select: { id: true };
    }): Promise<{ id: string } | null>;
    create(args: {
      data: {
        userId: string;
        beneficiaryId: string;
        type: string;
        status: string;
        amountAznCents: number;
        gameId?: string | null;
        metadata: string;
      };
    }): Promise<unknown>;
  };
};

/**
 * Rəy affiliate komissiyasını yazır. `gameOrders/[id] SUCCESS` yolundan çağırılır.
 *
 * Şərtlər:
 *  - Rəy mövcud və APPROVED olmalıdır;
 *  - Rəyin oyunu ilə alışın oyunu uyğun gəlməlidir;
 *  - Alıcı != rəy müəllifi (self-referral qadağası);
 *  - Eyni `sourcePurchaseId` üçün COMMISSION rəkordu yoxdur.
 *
 * Komissiya `referralBalanceCents`-ə artırılır və ayrıca `Transaction` rəkordu yazılır.
 * Pattern olaraq `lib/streamingReferral.ts`-i izləyir.
 */
export async function awardReviewAffiliateCommission(
  ptx: ReviewAffiliateDb,
  params: {
    reviewId: string;
    sourcePurchaseId: string;
    buyerUserId: string;
    gameId: string;
    /** Pozitiv qəpik (AZN * 100) — alışın final məbləği. */
    lineCents: number;
    /** `Settings.reviewAffiliateRatePct`. */
    reviewAffiliateRatePct: number;
  }
) {
  const {
    reviewId,
    sourcePurchaseId,
    buyerUserId,
    gameId,
    lineCents,
    reviewAffiliateRatePct,
  } = params;

  if (lineCents <= 0 || reviewAffiliateRatePct <= 0) return null;

  const review = await ptx.gameReview.findUnique({
    where: { id: reviewId },
    select: { id: true, userId: true, gameId: true, status: true },
  });
  if (!review) return null;
  if (review.status !== "APPROVED") return null;
  if (review.gameId !== gameId) return null;
  // Self-referral qadağası.
  if (review.userId === buyerUserId) return null;

  // İdempotent: eyni alış üçün təkrar rəy affiliate komissiyası yazılmır.
  // Klassik referrer komissiyası ilə qarışmasın deyə xüsusi marker istifadə olunur:
  // `reviewAffiliateForPurchase` alanı yalnız bu növ kayıtda mövcud olur.
  const needle = `"reviewAffiliateForPurchase":"${sourcePurchaseId}"`;
  const existing = await ptx.transaction.findFirst({
    where: { type: "COMMISSION", metadata: { contains: needle } },
    select: { id: true },
  });
  if (existing) return null;

  const commissionCents = Math.round((lineCents * reviewAffiliateRatePct) / 100);
  if (commissionCents <= 0) return null;

  await ptx.user.update({
    where: { id: review.userId },
    data: { referralBalanceCents: { increment: commissionCents } },
  });

  await ptx.transaction.create({
    data: {
      userId: review.userId,
      beneficiaryId: review.userId,
      type: "COMMISSION",
      status: "SUCCESS",
      amountAznCents: commissionCents,
      gameId,
      metadata: JSON.stringify({
        // Unikal marker — klassik referrer komissiyasından ayırır.
        reviewAffiliateForPurchase: sourcePurchaseId,
        kind: "REVIEW_AFFILIATE",
        reviewId,
        buyerUserId,
        lineCents,
        shareRate: reviewAffiliateRatePct,
      }),
    },
  });

  return { commissionCents, beneficiaryId: review.userId };
}

