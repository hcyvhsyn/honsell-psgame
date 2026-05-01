/**
 * Loyalty programme — cashback only.
 *
 * Lifetime spend places the customer in one of five named tiers. Each tier
 * unlocks a higher cashback % that is credited to the cashback balance automatically
 * after every purchase. There are no checkout-time discounts.
 */

export type LoyaltyAccent =
  | "indigo"
  | "amber"
  | "slate"
  | "yellow"
  | "cyan";

export type LoyaltyTierDef = {
  label: string;
  /** Lifetime AZN that unlocks this tier. */
  minSpendAzn: number;
  /** Cashback % credited to wallet after every purchase. */
  cashbackPct: number;
  /** Visual accent used by badges and the tiers modal. */
  accent: LoyaltyAccent;
  /** Localized perks shown to the customer. */
  rewards: string[];
};

export const LOYALTY_TIERS: LoyaltyTierDef[] = [
  {
    label: "Yeni",
    minSpendAzn: 0,
    cashbackPct: 0,
    accent: "indigo",
    rewards: [
      "Hesabın aktivdir — ilk alışına başla",
      "Referal proqramında iştirak hüququ",
      "Bronze səviyyəsi 500 AZN xərcdən sonra açılır",
    ],
  },
  {
    label: "Bronze",
    minSpendAzn: 500,
    cashbackPct: 1,
    accent: "amber",
    rewards: [
      "Hər alışdan 1% cashback — cashback balansına avtomatik düşür",
      "Profilində Bronze rozetkası",
    ],
  },
  {
    label: "Silver",
    minSpendAzn: 1000,
    cashbackPct: 2,
    accent: "slate",
    rewards: [
      "Hər alışdan 2% cashback — cashback balansına avtomatik düşür",
      "Profilində Silver rozetkası",
    ],
  },
  {
    label: "Gold",
    minSpendAzn: 2500,
    cashbackPct: 3,
    accent: "yellow",
    rewards: [
      "Hər alışdan 3% cashback — cashback balansına avtomatik düşür",
      "Profilində Gold rozetkası",
    ],
  },
  {
    label: "Diamond",
    minSpendAzn: 5000,
    cashbackPct: 5,
    accent: "cyan",
    rewards: [
      "Hər alışdan 5% cashback — maksimum (cashback balansına avtomatik düşür)",
      "Profilində Diamond rozetkası",
    ],
  },
];

export type LoyaltyTier = {
  label: string;
  cashbackPct: number;
  minSpendAzn: number;
  spentAzn: number;
  accent: LoyaltyAccent;
  rewards: string[];

  /** Lifetime AZN remaining until the next tier; null when at top. */
  toNextAzn: number | null;
  nextLabel: string | null;
  nextCashbackPct: number | null;
  /** 0–100 — progress within the current tier toward the next. */
  progressPct: number;
};

export function getLoyaltyTier(spentAzn: number): LoyaltyTier {
  const spend = Math.max(0, spentAzn);

  let currentIdx = 0;
  for (let i = 0; i < LOYALTY_TIERS.length; i++) {
    if (spend >= LOYALTY_TIERS[i].minSpendAzn) currentIdx = i;
  }
  const current = LOYALTY_TIERS[currentIdx];
  const next = LOYALTY_TIERS[currentIdx + 1] ?? null;

  const toNextAzn = next ? Math.max(0, next.minSpendAzn - spend) : null;
  const span = next ? next.minSpendAzn - current.minSpendAzn : 1;
  const progressPct = next
    ? Math.min(100, Math.round(((spend - current.minSpendAzn) / span) * 100))
    : 100;

  return {
    label: current.label,
    cashbackPct: current.cashbackPct,
    minSpendAzn: current.minSpendAzn,
    spentAzn: spend,
    accent: current.accent,
    rewards: current.rewards,
    toNextAzn,
    nextLabel: next?.label ?? null,
    nextCashbackPct: next?.cashbackPct ?? null,
    progressPct,
  };
}
