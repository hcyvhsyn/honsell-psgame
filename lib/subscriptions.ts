import { prisma } from "@/lib/prisma";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Add `months` calendar months to a date, clamping the day-of-month so that
 * Jan 31 + 1 month → Feb 28/29 (rather than rolling into March).
 */
export function addMonthsClamped(base: Date, months: number): Date {
  const d = new Date(base.getTime());
  const targetMonth = d.getMonth() + months;
  const targetYear = d.getFullYear() + Math.floor(targetMonth / 12);
  const normMonth = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(targetYear, normMonth + 1, 0).getDate();
  d.setFullYear(targetYear, normMonth, Math.min(d.getDate(), lastDay));
  return d;
}

/**
 * Read tier and durationMonths from the ServiceProduct.metadata JSON.
 * Returns null if the product isn't a usable PS_PLUS configuration.
 */
export function readPsPlusMeta(metadata: unknown): {
  tier: string;
  durationMonths: number;
} | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;
  const tierRaw = typeof m.tier === "string" ? m.tier.toUpperCase() : "";
  const durationRaw = Number(m.durationMonths);
  if (!["ESSENTIAL", "EXTRA", "DELUXE"].includes(tierRaw)) return null;
  if (!Number.isFinite(durationRaw) || durationRaw <= 0) return null;
  return { tier: tierRaw, durationMonths: Math.round(durationRaw) };
}

/**
 * Create a Subscription record for a PS Plus SERVICE_PURCHASE that just went
 * SUCCESS. Idempotent: if one already exists for the transaction, returns it.
 *
 * Auto-renew defaults to OFF — user opts in from /profile/subscriptions.
 */
export async function createSubscriptionFromTransaction(
  ptx: Tx,
  params: {
    transactionId: string;
    userId: string;
    serviceProductId: string;
    psnAccountId: string | null;
    priceAznCents: number;
    serviceProductMetadata: unknown;
    now?: Date;
  }
) {
  const meta = readPsPlusMeta(params.serviceProductMetadata);
  if (!meta) return null;

  const existing = await ptx.subscription.findFirst({
    where: { lastRenewalTxId: params.transactionId },
  });
  if (existing) return existing;

  const startsAt = params.now ?? new Date();
  const expiresAt = addMonthsClamped(startsAt, meta.durationMonths);

  return ptx.subscription.create({
    data: {
      userId: params.userId,
      serviceProductId: params.serviceProductId,
      psnAccountId: params.psnAccountId,
      tier: meta.tier,
      durationMonths: meta.durationMonths,
      priceAznCents: Math.abs(params.priceAznCents),
      startsAt,
      expiresAt,
      status: "ACTIVE",
      autoRenew: false,
      lastRenewalTxId: params.transactionId,
    },
  });
}
