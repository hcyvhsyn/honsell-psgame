import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getLifetimeSpendAznForLoyalty } from "@/lib/loyaltyCashback";

/**
 * Müştəri tier sistemi — TƏK mənbə (CustomerTier DB).
 *
 *  • AUTO tier-lər (Bronze..Diamond) istifadəçinin ömürlük xərcinə görə avtomatik
 *    təyin olunur (minSpendCents həddi).
 *  • MANUAL tier-lər (Sponsorlu, Ambassador) admin tərəfindən user.tierId ilə
 *    verilir və avtomatik xərc tier-ini ƏVƏZ EDİR.
 *
 * Effektiv tier həm referal faizini (ReferralRate matrisi), həm cashback faizini,
 * həm dəvət bonusunu, həm də status/SVG-ni təyin edir.
 *
 * user.tierId semantikası: MANUAL override (və ya NULL → xərcə görə AUTO).
 */

export type EffectiveTier = {
  id: string;
  slug: string;
  name: string;
  displayName: string;
  icon: string | null;
  color: string | null;
  cashbackPct: number;
  inviteBonusCents: number;
  kind: "AUTO" | "MANUAL";
  isManual: boolean;
};

type TierRow = {
  id: string;
  slug: string;
  name: string;
  displayName: string;
  icon: string | null;
  color: string | null;
  cashbackPct: number;
  inviteBonusCents: number;
  kind: string;
  minSpendCents: number;
  isDefault: boolean;
  sortOrder: number;
};

/** Bütün tier tərifləri — keşlənmiş (tag "customer-tiers" admin redaktədə sıfırlanır). */
const getTiersCached = unstable_cache(
  async (): Promise<TierRow[]> => {
    return prisma.customerTier.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        displayName: true,
        icon: true,
        color: true,
        cashbackPct: true,
        inviteBonusCents: true,
        kind: true,
        minSpendCents: true,
        isDefault: true,
        sortOrder: true,
      },
    });
  },
  ["customer-tiers-v1"],
  { tags: ["customer-tiers"], revalidate: 600 },
);

export async function getAllTiers(): Promise<TierRow[]> {
  return getTiersCached();
}

function toEffective(t: TierRow): EffectiveTier {
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    displayName: t.displayName || t.name,
    icon: t.icon,
    color: t.color,
    cashbackPct: t.cashbackPct,
    inviteBonusCents: t.inviteBonusCents,
    kind: t.kind === "AUTO" ? "AUTO" : "MANUAL",
    isManual: t.kind !== "AUTO",
  };
}

function autoLadder(tiers: TierRow[]): TierRow[] {
  return tiers.filter((t) => t.kind === "AUTO").sort((a, b) => a.minSpendCents - b.minSpendCents);
}

function defaultTier(tiers: TierRow[]): TierRow | null {
  return tiers.find((t) => t.isDefault) ?? autoLadder(tiers)[0] ?? tiers[0] ?? null;
}

/** Verilmiş xərcə (AZN) uyğun AUTO tier (minSpendCents ≤ xərc olan ən yüksək). */
export function pickAutoTier(spentAzn: number, tiers: TierRow[]): TierRow | null {
  const ladder = autoLadder(tiers);
  if (ladder.length === 0) return defaultTier(tiers);
  const cents = Math.max(0, Math.round(spentAzn * 100));
  let pick = ladder[0];
  for (const t of ladder) if (t.minSpendCents <= cents) pick = t;
  return pick;
}

/**
 * İstifadəçinin effektiv tier-i. user.tierId MANUAL tier-ə bağlıdırsa o, əks halda
 * ömürlük xərcə görə AUTO tier. Bütün oxumalar qlobal prisma ilədir (commit olunmuş
 * data; cari sifariş daxil deyil — tier alış-öncəsi xərci əks etdirir).
 */
export async function getEffectiveTier(
  userId: string,
  spentAznOverride?: number,
): Promise<EffectiveTier | null> {
  const [user, tiers] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { tierId: true } }),
    getTiersCached(),
  ]);
  if (tiers.length === 0) return null;

  if (user?.tierId) {
    const manual = tiers.find((t) => t.id === user.tierId && t.kind !== "AUTO");
    if (manual) return toEffective(manual);
  }

  const spentAzn =
    spentAznOverride ?? (await getLifetimeSpendAznForLoyalty(prisma, userId));
  const auto = pickAutoTier(spentAzn, tiers);
  return auto ? toEffective(auto) : null;
}

/** Effektiv tier id-si (referal faizi resolver-inə ötürmək üçün). */
export async function resolveEffectiveTierId(userId: string): Promise<string | null> {
  const t = await getEffectiveTier(userId);
  return t?.id ?? null;
}

/**
 * Bir siyahıdakı istifadəçilərin effektiv tier-lərini TOPLU hesablayır (admin
 * istifadəçilər siyahısı üçün — N sorğudan qaçmaq). Manual override-ları tier
 * cədvəlindən, qalanları üçün xərci tək groupBy ilə alır.
 */
export async function getEffectiveTiersForUsers(
  users: { id: string; tierId: string | null }[],
): Promise<Map<string, EffectiveTier>> {
  const tiers = await getTiersCached();
  const tierById = new Map(tiers.map((t) => [t.id, t]));
  const result = new Map<string, EffectiveTier>();
  const needSpend: string[] = [];

  for (const u of users) {
    const manual = u.tierId ? tierById.get(u.tierId) : null;
    if (manual && manual.kind !== "AUTO") result.set(u.id, toEffective(manual));
    else needSpend.push(u.id);
  }

  if (needSpend.length > 0 && tiers.length > 0) {
    const grouped = await prisma.transaction.groupBy({
      by: ["userId"],
      where: { userId: { in: needSpend }, type: { in: ["PURCHASE", "SERVICE_PURCHASE"] } },
      _sum: { amountAznCents: true },
    });
    const spendByUser = new Map(
      grouped.map((g) => [g.userId, Math.abs(g._sum.amountAznCents ?? 0) / 100]),
    );
    for (const uid of needSpend) {
      const auto = pickAutoTier(spendByUser.get(uid) ?? 0, tiers);
      if (auto) result.set(uid, toEffective(auto));
    }
  }
  return result;
}

export type EffectiveTierView = EffectiveTier & {
  spentAzn: number;
  toNextAzn: number | null;
  nextName: string | null;
  nextDisplayName: string | null;
  nextCashbackPct: number | null;
  progressPct: number;
};

/** Display üçün: effektiv tier + xərc nərdivanı üzrə irəliləyiş (cart, /api/me). */
export async function getEffectiveTierView(
  userId: string,
  spentAznOverride?: number,
): Promise<EffectiveTierView | null> {
  const tiers = await getTiersCached();
  if (tiers.length === 0) return null;
  const spentAzn =
    spentAznOverride ?? (await getLifetimeSpendAznForLoyalty(prisma, userId));
  const eff = await getEffectiveTier(userId, spentAzn);
  if (!eff) return null;

  const base = {
    ...eff,
    spentAzn,
    toNextAzn: null as number | null,
    nextName: null as string | null,
    nextDisplayName: null as string | null,
    nextCashbackPct: null as number | null,
    progressPct: 100,
  };
  // Manual status nərdivanda deyil — irəliləyiş yoxdur.
  if (eff.isManual) return base;

  const ladder = autoLadder(tiers);
  const cents = Math.max(0, Math.round(spentAzn * 100));
  let curIdx = 0;
  for (let i = 0; i < ladder.length; i++) if (ladder[i].minSpendCents <= cents) curIdx = i;
  const cur = ladder[curIdx];
  const next = ladder[curIdx + 1] ?? null;
  if (!next) return base;

  const span = next.minSpendCents - cur.minSpendCents || 1;
  return {
    ...base,
    toNextAzn: Math.max(0, next.minSpendCents / 100 - spentAzn),
    nextName: next.name,
    nextDisplayName: next.displayName || next.name,
    nextCashbackPct: next.cashbackPct,
    progressPct: Math.min(100, Math.round(((cents - cur.minSpendCents) / span) * 100)),
  };
}
