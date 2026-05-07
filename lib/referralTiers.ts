/**
 * Referal tier mükafatları — başqa kasıb dəvət sayında bonus AZN.
 *
 * "Uğurlu dəvət" = referal kodu ilə qeydiyyatdan keçən və ən azı bir
 * uğurlu alış (PURCHASE və ya SERVICE_PURCHASE, status SUCCESS) etmiş istifadəçi.
 */

export type ReferralTier = {
  threshold: number;       // ən azı neçə uğurlu dəvət
  bonusAznCents: number;   // verilən birdəfəlik bonus
  label: string;
  emoji: string;
};

export const REFERRAL_TIERS: ReferralTier[] = [
  { threshold: 5, bonusAznCents: 500, label: "Bronze", emoji: "🥉" },
  { threshold: 10, bonusAznCents: 1500, label: "Silver", emoji: "🥈" },
  { threshold: 25, bonusAznCents: 5000, label: "Gold", emoji: "🥇" },
];

/** Cari tier-i (boş ola bilər) və növbəti tier-i (yoxdursa null) qaytarır. */
export function describeReferralProgress(successfulCount: number): {
  current: ReferralTier | null;
  next: ReferralTier | null;
  toNext: number;
  progressPct: number; // 0-100, cari → növbəti aralıqda
} {
  let current: ReferralTier | null = null;
  let next: ReferralTier | null = null;
  for (const t of REFERRAL_TIERS) {
    if (successfulCount >= t.threshold) current = t;
    else {
      next = t;
      break;
    }
  }
  if (!next) return { current, next: null, toNext: 0, progressPct: 100 };
  const start = current?.threshold ?? 0;
  const span = next.threshold - start;
  const done = Math.max(0, successfulCount - start);
  const pct = Math.max(0, Math.min(100, Math.round((done / span) * 100)));
  return {
    current,
    next,
    toNext: Math.max(0, next.threshold - successfulCount),
    progressPct: pct,
  };
}

/** DB-yə baxan dar interfeys — verilmiş user üçün uğurlu dəvət sayını hesablayır. */
type CountDb = {
  user: {
    findMany(args: {
      where: { referredById: string };
      select: { id: true };
    }): Promise<{ id: string }[]>;
  };
  transaction: {
    count(args: {
      where: {
        userId: { in: string[] };
        type: { in: string[] };
        status: string;
      };
    }): Promise<number>;
    findFirst(args: {
      where: {
        userId: { in: string[] };
        type: { in: string[] };
        status: string;
      };
      select: { id: true };
    }): Promise<{ id: string } | null>;
    findMany(args: {
      where: {
        beneficiaryId: string;
        type: string;
        metadata: { contains: string };
      };
      select: { metadata: true };
    }): Promise<{ metadata: string | null }[]>;
    create(args: {
      data: {
        userId: string;
        beneficiaryId: string;
        type: string;
        status: string;
        amountAznCents: number;
        metadata: string;
      };
    }): Promise<unknown>;
  };
  user2?: never; // type tag
};

/** "Uğurlu dəvət" sayı: user-in invite etdiyi və ən azı 1 uğurlu alış edən referee-lər. */
export async function countSuccessfulReferrals(
  db: CountDb,
  userId: string
): Promise<number> {
  const referees = await db.user.findMany({
    where: { referredById: userId },
    select: { id: true },
  });
  if (referees.length === 0) return 0;

  // Hər referee üçün "ən azı 1 uğurlu alış var" yoxlaması:
  // Sadə yanaşma: bütün referee-lərin üzərində distinct userId görmək lazımdır.
  // Prisma-da `distinct` `count` ilə təbii dəstəklənmir, ona görə manual:
  let successCount = 0;
  for (const r of referees) {
    const has = await db.transaction.findFirst({
      where: {
        userId: { in: [r.id] },
        type: { in: ["PURCHASE", "SERVICE_PURCHASE"] },
        status: "SUCCESS",
      },
      select: { id: true },
    });
    if (has) successCount += 1;
  }
  return successCount;
}

/** Verilmiş user üçün hansı tier bonusları artıq verilib (idempotent yoxlama). */
export async function listAwardedTierThresholds(
  db: CountDb,
  userId: string
): Promise<Set<number>> {
  const rows = await db.transaction.findMany({
    where: {
      beneficiaryId: userId,
      type: "REFERRAL_TIER_BONUS",
      metadata: { contains: '"kind":"REFERRAL_TIER_BONUS"' },
    },
    select: { metadata: true },
  });
  const out = new Set<number>();
  for (const r of rows) {
    if (!r.metadata) continue;
    try {
      const m = JSON.parse(r.metadata) as { threshold?: number };
      if (typeof m.threshold === "number") out.add(m.threshold);
    } catch {
      /* ignore */
    }
  }
  return out;
}

/**
 * User üçün uyğun tier bonuslarını yaradır (idempotent — eyni threshold ikinci dəfə verilməz).
 * Komissiya yaradılan kimi və ya manual yoxlama nəticəsində çağırıla bilər.
 */
export async function evaluateReferralTiers(db: CountDb, userId: string) {
  const successful = await countSuccessfulReferrals(db, userId);
  if (successful < REFERRAL_TIERS[0].threshold) return [];

  const already = await listAwardedTierThresholds(db, userId);
  const newlyAwarded: ReferralTier[] = [];

  for (const tier of REFERRAL_TIERS) {
    if (successful < tier.threshold) break;
    if (already.has(tier.threshold)) continue;
    // Bonusu yaz
    const dbAny = db as unknown as {
      user: { update(args: unknown): Promise<unknown> };
      transaction: CountDb["transaction"];
    };
    await dbAny.user.update({
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
          threshold: tier.threshold,
          tierLabel: tier.label,
        }),
      },
    });
    newlyAwarded.push(tier);
  }

  return newlyAwarded;
}
