import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendReviewInviteEmail } from "@/lib/resend";

const INVITE_TTL_DAYS = 30;

export type ReviewProductType =
  | "GAME"
  | "EPIC_GAMES"
  | "PS_PLUS"
  | "GIFT_CARD"
  | "ACCOUNT_CREATION";

function generateToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://honsell.site";
}

function reviewUrlFor(token: string): string {
  return `${getBaseUrl().replace(/\/$/, "")}/review/${token}`;
}

/**
 * Creates a one-time review invite for a completed transaction and emails the
 * customer a unique URL to leave a review. Idempotent — if an invite already
 * exists for this transaction, returns the existing one without re-sending.
 *
 * Returns the review URL so the WhatsApp approval message can carry the SAME
 * link (one invite per order — the customer can't review it twice). `null` when
 * the invite is used/expired or creation failed.
 *
 * Failures are swallowed so the order completion flow is never blocked.
 */
export async function issueReviewInvite(params: {
  transactionId: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  productTitle: string;
  productType: ReviewProductType;
}): Promise<string | null> {
  const { transactionId, userId, userEmail, userName, productTitle, productType } = params;
  try {
    const existing = await prisma.reviewInvite.findUnique({ where: { transactionId } });
    if (existing) {
      return existing.usedAt || existing.expiresAt.getTime() <= Date.now()
        ? null
        : reviewUrlFor(existing.token);
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

    await prisma.reviewInvite.create({
      data: {
        token,
        transactionId,
        userId,
        productTitle,
        productType,
        expiresAt,
      },
    });

    const reviewUrl = reviewUrlFor(token);
    // Email xətası linki itirməməlidir — dəvət artıq yaranıb, WhatsApp onu daşıyacaq.
    try {
      await sendReviewInviteEmail({
        email: userEmail,
        userName: userName?.trim() || userEmail.split("@")[0] || "dost",
        productTitle,
        reviewUrl,
      });
    } catch (err) {
      console.error("review invite email failed", { transactionId, err });
    }
    return reviewUrl;
  } catch (err) {
    // Don't break the order flow — just log.
    console.error("issueReviewInvite failed", { transactionId, err });
    return null;
  }
}
