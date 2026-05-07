import { prisma } from "@/lib/prisma";

/**
 * Monthly referral cycle bookkeeping.
 *
 * Points are accumulated on the user's OWN row from two sources:
 *   - +1 point per AZN that the user themselves spends on the platform
 *   - +10 points per friend they invite who reaches their first SUCCESS purchase
 *
 * Tier thresholds (configurable via `ReferralTier`) award `bonusAznCents` once
 * a user's per-cycle points cross them. Awards are idempotent
 * (`ReferralCycleReward.@@unique([cycleId, userId, tierId])`).
 */

export type CycleSummary = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  closedAt: Date | null;
};

// `prisma.$transaction(async (tx) => …)` hands back an "Omit<…>" of the
// extended client (no `$extends`, `$transaction`, etc.). Recover that exact
// type so we can accept either the root client or a tx-scoped one.
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type Db = typeof prisma | TxClient;

/** First instant of the calendar month containing `now` (UTC). */
function monthStartUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}
/** First instant of the next calendar month after `now` (UTC). */
function nextMonthStartUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

/**
 * Returns the cycle covering `now`, creating it on first access. Also closes
 * any past cycles whose `endsAt` has elapsed and which never had `closedAt`
 * stamped (lazy rollover — no cron needed).
 */
export async function getCurrentCycle(db: Db = prisma): Promise<CycleSummary> {
  const now = new Date();
  const start = monthStartUtc(now);
  const end = nextMonthStartUtc(now);

  // Lazy-close anything stale before reading current.
  await closeExpiredCycles(db, now);

  const existing = await db.referralCycle.findUnique({ where: { startsAt: start } });
  if (existing) return existing;

  // First request of the month — create it. `unique(startsAt)` makes this safe
  // under concurrent first-hits (the second one will throw and we re-read).
  try {
    return await db.referralCycle.create({
      data: { startsAt: start, endsAt: end },
    });
  } catch {
    const again = await db.referralCycle.findUnique({ where: { startsAt: start } });
    if (again) return again;
    throw new Error("Failed to create referral cycle");
  }
}

/**
 * Stamps `closedAt` and freezes ranks for any cycle whose `endsAt <= now`
 * and which doesn't yet have a `closedAt` value. Called lazily on every
 * `getCurrentCycle()`; safe to call multiple times.
 */
export async function closeExpiredCycles(db: Db = prisma, asOf: Date = new Date()): Promise<void> {
  const expired = await db.referralCycle.findMany({
    where: { endsAt: { lte: asOf }, closedAt: null },
    select: { id: true },
  });
  for (const c of expired) {
    const results = await db.referralCycleResult.findMany({
      where: { cycleId: c.id },
      orderBy: [{ points: "desc" }, { invites: "desc" }, { spendCents: "desc" }],
      select: { id: true },
    });
    // Assign monotonic ranks (ties broken by invites, then spend).
    for (let i = 0; i < results.length; i++) {
      await db.referralCycleResult.update({
        where: { id: results[i].id },
        data: { rank: i + 1 },
      });
    }
    await db.referralCycle.update({
      where: { id: c.id },
      data: { closedAt: asOf },
    });
  }
}

/**
 * Recompute `points` from `invites` and `spendCents` and persist. Always run
 * inside the same transaction as the increments to avoid drift.
 */
function pointsFor(invites: number, spendCents: number): number {
  // 10 pts per invite + 1 pt per AZN (= 100 cents).
  return invites * 10 + Math.floor(spendCents / 100);
}

/**
 * Adds the buyer's own spend to their per-cycle row and re-evaluates tier
 * rewards FOR THE BUYER. Call this on every SUCCESS purchase, regardless of
 * whether the buyer was invited by anyone — own-spending earns own points.
 */
export async function recordPurchaseSpend(
  db: Db,
  buyerId: string,
  spendCents: number
): Promise<void> {
  if (spendCents <= 0) return;
  const cycle = await getCurrentCycle(db);
  const row = await db.referralCycleResult.upsert({
    where: { cycleId_userId: { cycleId: cycle.id, userId: buyerId } },
    create: {
      cycleId: cycle.id,
      userId: buyerId,
      invites: 0,
      spendCents,
      points: pointsFor(0, spendCents),
    },
    update: {
      spendCents: { increment: spendCents },
    },
  });
  // upsert can't compute `points` from incremented values in a single round
  // trip; re-read and rewrite once the `spendCents` increment lands.
  const fresh = await db.referralCycleResult.findUnique({
    where: { id: row.id },
    select: { invites: true, spendCents: true },
  });
  if (fresh) {
    await db.referralCycleResult.update({
      where: { id: row.id },
      data: { points: pointsFor(fresh.invites, fresh.spendCents) },
    });
  }
  await evaluateCycleTiers(db, cycle.id, buyerId);
}

/**
 * Increments the invite count by 1 if `referee` made their first SUCCESS
 * purchase in this cycle. Idempotent: if the referrer's row already counted
 * this referee, this is a no-op. Designed to be called immediately after
 * crediting commission inside the same transaction.
 */
export async function recordSuccessfulInvite(
  db: Db,
  referrerId: string,
  refereeId: string
): Promise<void> {
  // Was this referee's first successful purchase prior to today? If yes, the
  // invite was already counted in some earlier cycle and we skip.
  const olderSuccess = await db.transaction.findFirst({
    where: {
      userId: refereeId,
      type: { in: ["PURCHASE", "SERVICE_PURCHASE"] },
      status: "SUCCESS",
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, createdAt: true },
  });
  // The just-recorded SUCCESS row is included; any row strictly earlier than
  // the current cycle's start means this isn't a "new invite" event.
  const cycle = await getCurrentCycle(db);
  if (olderSuccess && olderSuccess.createdAt < cycle.startsAt) return;

  // Did THIS cycle already count this referee for this referrer? Check via
  // a dedicated marker transaction we'll write once.
  const marker = await db.transaction.findFirst({
    where: {
      userId: referrerId,
      beneficiaryId: referrerId,
      type: "REFERRAL_INVITE_COUNTED",
      metadata: { contains: `"refereeId":"${refereeId}"` },
    },
    select: { id: true },
  });
  if (marker) return;

  await db.transaction.create({
    data: {
      userId: referrerId,
      beneficiaryId: referrerId,
      type: "REFERRAL_INVITE_COUNTED",
      status: "SUCCESS",
      amountAznCents: 0,
      metadata: JSON.stringify({
        kind: "REFERRAL_INVITE_COUNTED",
        cycleId: cycle.id,
        refereeId,
      }),
    },
  });

  const row = await db.referralCycleResult.upsert({
    where: { cycleId_userId: { cycleId: cycle.id, userId: referrerId } },
    create: {
      cycleId: cycle.id,
      userId: referrerId,
      invites: 1,
      spendCents: 0,
      points: pointsFor(1, 0),
    },
    update: { invites: { increment: 1 } },
  });
  const fresh = await db.referralCycleResult.findUnique({
    where: { id: row.id },
    select: { invites: true, spendCents: true },
  });
  if (fresh) {
    await db.referralCycleResult.update({
      where: { id: row.id },
      data: { points: pointsFor(fresh.invites, fresh.spendCents) },
    });
  }
  await evaluateCycleTiers(db, cycle.id, referrerId);
}

/**
 * Awards any tier rewards the user has just unlocked inside the given cycle.
 * Idempotent — duplicate awards are blocked by the unique constraint.
 */
export async function evaluateCycleTiers(
  db: Db,
  cycleId: string,
  userId: string
): Promise<void> {
  const tiers = await db.referralTier.findMany({
    where: { isActive: true },
    orderBy: { thresholdPoints: "asc" },
  });
  if (tiers.length === 0) return;

  const result = await db.referralCycleResult.findUnique({
    where: { cycleId_userId: { cycleId, userId } },
    select: { points: true },
  });
  if (!result) return;

  for (const tier of tiers) {
    if (result.points < tier.thresholdPoints) break;
    try {
      await db.referralCycleReward.create({
        data: {
          cycleId,
          userId,
          tierId: tier.id,
          bonusAznCents: tier.bonusAznCents,
        },
      });
      await db.user.update({
        where: { id: userId },
        data: { referralBalanceCents: { increment: tier.bonusAznCents } },
      });
      await db.transaction.create({
        data: {
          userId,
          beneficiaryId: userId,
          type: "REFERRAL_TIER_BONUS",
          status: "SUCCESS",
          amountAznCents: tier.bonusAznCents,
          metadata: JSON.stringify({
            kind: "REFERRAL_TIER_BONUS",
            cycleId,
            tierId: tier.id,
            tierLabel: tier.label,
            thresholdPoints: tier.thresholdPoints,
          }),
        },
      });
    } catch {
      // Unique constraint hit — already awarded for this cycle.
      continue;
    }
  }
}

/** Convenience: ms remaining in current cycle (for countdown timer). */
export function remainingMs(cycle: { endsAt: Date }, now: Date = new Date()): number {
  return Math.max(0, cycle.endsAt.getTime() - now.getTime());
}

/**
 * Latest cycle that has been closed (i.e. snapshotted). Used for "Keçən ay"
 * archive in the UI. Returns null if no cycle has closed yet.
 */
export async function getLastClosedCycle(db: Db = prisma) {
  return db.referralCycle.findFirst({
    where: { closedAt: { not: null } },
    orderBy: { endsAt: "desc" },
  });
}
