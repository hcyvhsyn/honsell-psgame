import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addMonthsClamped, readPsPlusMeta } from "@/lib/subscriptions";
import {
  sendAdminSubscriptionDigest,
  sendSubscriptionExpiringIn3DaysEmail,
  sendSubscriptionExpiringTomorrowEmail,
  sendSubscriptionRenewalFailedEmail,
  sendSubscriptionRenewedEmail,
} from "@/lib/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily cron — runs every day. Three jobs in one pass:
 *
 *  1. Mark already-expired ACTIVE subscriptions → EXPIRED.
 *  2. For ACTIVE+autoRenew subscriptions whose expiresAt is today/tomorrow:
 *     debit wallet, create a renewal Transaction, push expiresAt forward by
 *     `durationMonths`. If wallet is short, send renewal-failed email and let
 *     the row expire.
 *  3. Send "expiring in 3 days" and "expiring tomorrow" notifications (with
 *     low-balance warning if applicable). Email is de-duped via remind*SentAt
 *     fields keyed off the current expiry date.
 *
 * Auth: shared CRON_SECRET via Authorization: Bearer <secret> header.
 * Vercel Cron sets this via the cron config; for AWS / manual invocation,
 * any HTTPS scheduler that can attach a header works.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  const dayAfterTomorrowStart = new Date(startOfDay.getTime() + 2 * 24 * 60 * 60 * 1000);
  const in3DaysEnd = new Date(startOfDay.getTime() + 4 * 24 * 60 * 60 * 1000);

  const stats = {
    expired: 0,
    renewed: 0,
    renewalFailed: 0,
    remind3Sent: 0,
    remind1Sent: 0,
    errors: [] as string[],
  };

  // ── 1. Expire past-due rows ──────────────────────────────────────────────
  const expiredResult = await prisma.subscription.updateMany({
    where: {
      status: "ACTIVE",
      expiresAt: { lt: startOfDay },
    },
    data: { status: "EXPIRED" },
  });
  stats.expired = expiredResult.count;

  // ── 2. Auto-renew rows expiring today or tomorrow ────────────────────────
  const renewCandidates = await prisma.subscription.findMany({
    where: {
      status: "ACTIVE",
      autoRenew: true,
      expiresAt: { gte: startOfDay, lt: dayAfterTomorrowStart },
    },
    include: {
      user: { select: { id: true, email: true, name: true, walletBalance: true } },
      serviceProduct: { select: { id: true, title: true, type: true, metadata: true, priceAznCents: true } },
    },
  });

  for (const sub of renewCandidates) {
    try {
      const meta = readPsPlusMeta(sub.serviceProduct.metadata);
      const durationMonths = meta?.durationMonths ?? sub.durationMonths;
      const renewalCost = sub.serviceProduct.priceAznCents ?? sub.priceAznCents;

      if (sub.user.walletBalance < renewalCost) {
        // Insufficient balance — fail the renewal and notify.
        await sendSubscriptionRenewalFailedEmail({
          email: sub.user.email,
          userName: sub.user.name ?? sub.user.email.split("@")[0],
          productTitle: sub.serviceProduct.title,
          priceAznCents: renewalCost,
          walletBalanceCents: sub.user.walletBalance,
        }).catch((err) => stats.errors.push(`renewal-failed-email ${sub.id}: ${err}`));

        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: "EXPIRED" },
        });
        stats.renewalFailed += 1;
        continue;
      }

      // Atomic: debit wallet, log transaction, extend subscription.
      const newExpiresAt = addMonthsClamped(sub.expiresAt, durationMonths);

      await prisma.$transaction(async (ptx) => {
        await ptx.user.update({
          where: { id: sub.userId },
          data: { walletBalance: { decrement: renewalCost } },
        });

        const renewalTx = await ptx.transaction.create({
          data: {
            userId: sub.userId,
            type: "SERVICE_PURCHASE",
            status: "SUCCESS",
            amountAznCents: -renewalCost,
            serviceProductId: sub.serviceProductId,
            psnAccountId: sub.psnAccountId,
            metadata: JSON.stringify({
              kind: "PS_PLUS",
              autoRenew: true,
              subscriptionId: sub.id,
            }),
          },
        });

        await ptx.subscription.update({
          where: { id: sub.id },
          data: {
            expiresAt: newExpiresAt,
            priceAznCents: renewalCost,
            durationMonths,
            lastRenewedAt: now,
            lastRenewalTxId: renewalTx.id,
            // Reset reminder cycle for the new expiry.
            remind3SentAt: null,
            remind1SentAt: null,
            lowBalanceSentAt: null,
          },
        });
      });

      await sendSubscriptionRenewedEmail({
        email: sub.user.email,
        userName: sub.user.name ?? sub.user.email.split("@")[0],
        productTitle: sub.serviceProduct.title,
        newExpiresAt,
        amountAznCents: renewalCost,
      }).catch((err) => stats.errors.push(`renewed-email ${sub.id}: ${err}`));

      stats.renewed += 1;
    } catch (err) {
      stats.errors.push(`renew ${sub.id}: ${(err as Error).message}`);
    }
  }

  // ── 3. Reminders for ACTIVE rows still in window (NOT renewed above) ─────
  const activeUpcoming = await prisma.subscription.findMany({
    where: {
      status: "ACTIVE",
      expiresAt: { gte: startOfDay, lt: in3DaysEnd },
    },
    include: {
      user: { select: { id: true, email: true, name: true, walletBalance: true } },
      serviceProduct: { select: { title: true, priceAznCents: true } },
    },
  });

  const adminDigest: Array<{
    productTitle: string;
    userEmail: string;
    expiresAt: Date;
    autoRenew: boolean;
    balanceShortfallCents: number | null;
  }> = [];

  for (const sub of activeUpcoming) {
    const expiresAtDay = new Date(sub.expiresAt);
    expiresAtDay.setHours(0, 0, 0, 0);
    const isTomorrow = expiresAtDay.getTime() === tomorrowStart.getTime();
    const renewalCost = sub.serviceProduct.priceAznCents ?? sub.priceAznCents;
    const shortfall =
      sub.user.walletBalance < renewalCost
        ? renewalCost - sub.user.walletBalance
        : null;

    adminDigest.push({
      productTitle: sub.serviceProduct.title,
      userEmail: sub.user.email,
      expiresAt: sub.expiresAt,
      autoRenew: sub.autoRenew,
      balanceShortfallCents: shortfall,
    });

    // De-dup: only send once per current expiry date.
    const remind3AlreadyForThisExpiry =
      sub.remind3SentAt && sub.remind3SentAt > sub.updatedAt
        ? false
        : !!sub.remind3SentAt &&
          sub.remind3SentAt.getTime() > sub.expiresAt.getTime() - 5 * 24 * 60 * 60 * 1000;

    if (!isTomorrow && !sub.remind3SentAt) {
      try {
        await sendSubscriptionExpiringIn3DaysEmail({
          email: sub.user.email,
          userName: sub.user.name ?? sub.user.email.split("@")[0],
          productTitle: sub.serviceProduct.title,
          expiresAt: sub.expiresAt,
          autoRenew: sub.autoRenew,
          priceAznCents: renewalCost,
          walletBalanceCents: sub.user.walletBalance,
        });
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { remind3SentAt: now },
        });
        stats.remind3Sent += 1;
      } catch (err) {
        stats.errors.push(`remind3 ${sub.id}: ${(err as Error).message}`);
      }
    } else if (isTomorrow && !sub.remind1SentAt) {
      try {
        await sendSubscriptionExpiringTomorrowEmail({
          email: sub.user.email,
          userName: sub.user.name ?? sub.user.email.split("@")[0],
          productTitle: sub.serviceProduct.title,
          expiresAt: sub.expiresAt,
          autoRenew: sub.autoRenew,
          priceAznCents: renewalCost,
          walletBalanceCents: sub.user.walletBalance,
        });
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { remind1SentAt: now },
        });
        stats.remind1Sent += 1;
      } catch (err) {
        stats.errors.push(`remind1 ${sub.id}: ${(err as Error).message}`);
      }
    }

    void remind3AlreadyForThisExpiry; // reserved for future stricter check
  }

  // Admin digest (idempotent only by frequency — once per cron run; fine daily).
  if (adminDigest.length > 0) {
    try {
      await sendAdminSubscriptionDigest({ expiringSoon: adminDigest });
    } catch (err) {
      stats.errors.push(`admin-digest: ${(err as Error).message}`);
    }
  }

  return NextResponse.json({ ok: true, runAt: now.toISOString(), stats });
}
