import { prisma } from "@/lib/prisma";
import { readPlatformMeta, type PlatformCategory } from "@/lib/platformSubscriptions";

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
 * Read durationMonths from an EA Play ServiceProduct.metadata JSON.
 * EA Play has no tier dimension — just a duration (1 or 12 months).
 */
export function readEaPlayMeta(metadata: unknown): {
  durationMonths: number;
} | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;
  const durationRaw = Number(m.durationMonths);
  if (!Number.isFinite(durationRaw) || durationRaw <= 0) return null;
  return { durationMonths: Math.round(durationRaw) };
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

/**
 * Create a Subscription record for an EA Play SERVICE_PURCHASE that just went
 * SUCCESS. Idempotent on `lastRenewalTxId`. Stores `tier: "EA_PLAY"` so the
 * row can be filtered without joining ServiceProduct.
 */
export async function createEaPlaySubscriptionFromTransaction(
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
  const meta = readEaPlayMeta(params.serviceProductMetadata);
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
      tier: "EA_PLAY",
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

/**
 * Create a Subscription record for a PLATFORM (Music / AI / Work) SERVICE_PURCHASE.
 * The `tier` field stores the platform category code (e.g. "AI") so queries can
 * filter without joining; the productTitle for UI comes from the ServiceProduct join.
 *
 * Idempotent on `lastRenewalTxId`. Returns null if the metadata is unusable
 * (missing durationMonths).
 */
export async function createPlatformSubscriptionFromTransaction(
  ptx: Tx,
  params: {
    transactionId: string;
    userId: string;
    serviceProductId: string;
    priceAznCents: number;
    serviceProductMetadata: unknown;
    now?: Date;
  }
) {
  const meta = readPlatformMeta(
    (params.serviceProductMetadata as Record<string, unknown> | null) ?? null
  );
  if (!meta.durationMonths) return null;

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
      psnAccountId: null,
      tier: meta.category satisfies PlatformCategory,
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

/**
 * Idempotent: for each AI/PLATFORM SERVICE_PURCHASE the user has, create a
 * matching Subscription row if missing AND the transaction's start+duration is
 * still in the future. Expired purchases are left alone (visible as legacy in UI).
 *
 * Returns the count of newly-created rows. Safe to call on every profile view.
 */
export async function backfillPlatformSubscriptionsForUser(userId: string): Promise<number> {
  const txs = await prisma.transaction.findMany({
    where: {
      userId,
      type: "SERVICE_PURCHASE",
      status: "SUCCESS",
      serviceProduct: { type: "PLATFORM" },
    },
    include: { serviceProduct: { select: { metadata: true } } },
  });

  const candidates = txs.filter((tx) => {
    const meta = readPlatformMeta(
      (tx.serviceProduct?.metadata as Record<string, unknown> | null) ?? null
    );
    if (!meta.durationMonths) return false;
    const expiresAt = addMonthsClamped(tx.createdAt, meta.durationMonths);
    return expiresAt.getTime() > Date.now();
  });

  if (candidates.length === 0) return 0;

  const existingByTxId = new Set(
    (
      await prisma.subscription.findMany({
        where: { lastRenewalTxId: { in: candidates.map((c) => c.id) } },
        select: { lastRenewalTxId: true },
      })
    )
      .map((s) => s.lastRenewalTxId)
      .filter((v): v is string => !!v)
  );

  let created = 0;
  for (const tx of candidates) {
    if (existingByTxId.has(tx.id)) continue;
    if (!tx.serviceProductId) continue;
    await prisma.$transaction(async (ptx) => {
      const result = await createPlatformSubscriptionFromTransaction(ptx, {
        transactionId: tx.id,
        userId: tx.userId,
        serviceProductId: tx.serviceProductId!,
        priceAznCents: tx.amountAznCents,
        serviceProductMetadata: tx.serviceProduct?.metadata,
        now: tx.createdAt,
      });
      if (result) created += 1;
    });
  }

  return created;
}

/**
 * Returns the renewal duration (months) for a Subscription, by inspecting the
 * linked ServiceProduct.metadata. Falls back to the snapshot `durationMonths`
 * on the Subscription row when metadata is unreadable.
 */
export function readRenewalMonths(
  serviceProductType: string | null | undefined,
  serviceProductMetadata: unknown,
  fallback: number
): number {
  if (serviceProductType === "PS_PLUS") {
    const meta = readPsPlusMeta(serviceProductMetadata);
    return meta?.durationMonths ?? fallback;
  }
  if (serviceProductType === "EA_PLAY") {
    const meta = readEaPlayMeta(serviceProductMetadata);
    return meta?.durationMonths ?? fallback;
  }
  if (serviceProductType === "PLATFORM") {
    const meta = readPlatformMeta(
      (serviceProductMetadata as Record<string, unknown> | null) ?? null
    );
    return meta.durationMonths ?? fallback;
  }
  return fallback;
}
