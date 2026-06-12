import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/pricing";
import { readReferralRateFromMeta } from "@/lib/referralCalculatorOptions";

/**
 * Referal komissiya faizlərinin mərkəzi həll edicisi (resolver).
 *
 * Faizlər (müştəri seqmenti × hədəf) matrisi ilə idarə olunur:
 *   • Seqment = CustomerTier. İstifadəçinin `tierId`-i NULL isə `isDefault` seqment.
 *   • Hədəf = PS Store kateqoriyası (PS_GAMES/PS_PLUS/GIFT_CARDS/ACCOUNT_CREATION)
 *     və ya konkret ServiceProduct sətiri (SERVICE_PRODUCT — hər abunəlik müddəti).
 *
 * Bütün komissiya verən nöqtələr (game-orders, service-orders, cart checkout) və
 * müştəri-tərəf kalkulyatoru bu funksiyadan keçir — tək həqiqət mənbəyi.
 */

export type ReferralTargetType =
  | "PS_GAMES"
  | "PS_PLUS"
  | "GIFT_CARDS"
  | "ACCOUNT_CREATION"
  | "SERVICE_PRODUCT";

export const REFERRAL_CATEGORY_TARGETS: ReferralTargetType[] = [
  "PS_GAMES",
  "PS_PLUS",
  "GIFT_CARDS",
  "ACCOUNT_CREATION",
];

export type ReferralTarget =
  | { type: "PS_GAMES" }
  | { type: "PS_PLUS" } // EA_PLAY də bu kateqoriyaya düşür (mövcud davranış)
  | { type: "GIFT_CARDS" } // TRY balansı + Honsell hədiyyə kartı
  | { type: "ACCOUNT_CREATION" } // PSN + Epic hesab açma
  | { type: "SERVICE_PRODUCT"; serviceProductId: string };

/** Həll edicinin istifadə etdiyi dar Prisma interfeysi (client və ya tx). */
export type ReferralRateDb = {
  user: {
    findUnique(args: {
      where: { id: string };
      select: { tierId: true };
    }): Promise<{ tierId: string | null } | null>;
  };
  customerTier: {
    findFirst(args: {
      where: { isDefault: true };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
  referralRate: {
    findFirst(args: {
      where: { tierId: string; targetType: string; serviceProductId: string };
      select: { ratePct: true; enabled: true };
    }): Promise<{ ratePct: number; enabled: boolean } | null>;
  };
};

function roundPct(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * 10) / 10;
}

function targetKey(target: ReferralTarget): {
  targetType: ReferralTargetType;
  serviceProductId: string;
} {
  if (target.type === "SERVICE_PRODUCT") {
    return { targetType: "SERVICE_PRODUCT", serviceProductId: target.serviceProductId };
  }
  return { targetType: target.type, serviceProductId: "" };
}

function isMissingReferralSchema(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("ReferralRate") ||
    msg.includes("CustomerTier") ||
    msg.includes("tierId") ||
    msg.includes("does not exist")
  );
}

/**
 * Miqrasiyadan əvvəlki köhnə davranış — yeni cədvəllər hələ yoxdursa istifadə
 * olunur (prod-da kod miqrasiyadan əvvəl deploy oluna bilər). Komissiya köhnə
 * qlobal/metadata faizləri ilə ödənilir, error atılmır. Təmizlik PR-da silinəcək.
 */
async function legacyRatePct(target: ReferralTarget): Promise<number> {
  const settings = await getSettings();
  switch (target.type) {
    case "PS_GAMES":
      return roundPct(settings.referralGamesPct);
    case "PS_PLUS":
      return roundPct(settings.referralPsPlusPct);
    case "GIFT_CARDS":
      return roundPct(settings.referralGiftCardsPct);
    case "ACCOUNT_CREATION":
      return roundPct(settings.referralAccountCreationPct);
    case "SERVICE_PRODUCT": {
      const product = await prisma.serviceProduct.findUnique({
        where: { id: target.serviceProductId },
        select: { metadata: true },
      });
      return readReferralRateFromMeta(product?.metadata, 0);
    }
  }
}

/**
 * Verilmiş seqment (və ya referrer istifadəçi) üçün hədəfə aid aktiv komissiya
 * faizini qaytarır. `tierId` (NULL ola bilər) və ya `referrerUserId` ötürülür.
 *
 * Seçilmiş seqmentdə hədəf üçün sətir yoxdursa **default seqmentin dəyərinə düşür**
 * — beləliklə admin yeni seqmentdə hər xananı doldurmasa belə komissiya səhvən 0
 * olmur (default seqmentdən miras). `enabled = false` isə 0 qaytarır.
 */
export async function resolveReferralRatePct(args: {
  tierId?: string | null;
  referrerUserId?: string;
  target: ReferralTarget;
  db?: ReferralRateDb;
}): Promise<number> {
  const db = args.db ?? (prisma as unknown as ReferralRateDb);
  const { targetType, serviceProductId } = targetKey(args.target);

  try {
    // 1) Effektiv seqmenti tap.
    let tierId: string | null | undefined = args.tierId;
    if (tierId === undefined && args.referrerUserId) {
      const u = await db.user.findUnique({
        where: { id: args.referrerUserId },
        select: { tierId: true },
      });
      tierId = u?.tierId ?? null;
    }

    const defaultTier = await db.customerTier.findFirst({
      where: { isDefault: true },
      select: { id: true },
    });
    const defaultTierId = defaultTier?.id ?? null;
    const effectiveTierId = tierId ?? defaultTierId;
    if (!effectiveTierId) return 0; // heç bir seqment yoxdur

    // 2) Seqmentin hədəf üçün dəyəri.
    let row = await db.referralRate.findFirst({
      where: { tierId: effectiveTierId, targetType, serviceProductId },
      select: { ratePct: true, enabled: true },
    });

    // 3) Yoxdursa default seqmentin dəyərinə düş.
    if (!row && defaultTierId && effectiveTierId !== defaultTierId) {
      row = await db.referralRate.findFirst({
        where: { tierId: defaultTierId, targetType, serviceProductId },
        select: { ratePct: true, enabled: true },
      });
    }

    if (!row) return 0;
    if (!row.enabled) return 0;
    return roundPct(Math.min(100, row.ratePct));
  } catch (err) {
    if (isMissingReferralSchema(err)) return legacyRatePct(args.target);
    throw err;
  }
}

export type TierReferralRate = {
  targetType: ReferralTargetType;
  serviceProductId: string;
  ratePct: number;
  enabled: boolean;
};

/**
 * Bir seqmentin BÜTÜN faizlərini bir sorğuda qaytarır (kalkulyator + admin matris
 * üçün N sorğudan qaçmaq). Yalnız o seqment üçün mövcud sətirlər qayıdır —
 * default-mirasını çağıran tərəf tətbiq edir (bax: getReferralCalculatorOptions).
 */
export async function getTierReferralRates(tierId: string): Promise<TierReferralRate[]> {
  const rows = await prisma.referralRate.findMany({
    where: { tierId },
    select: { targetType: true, serviceProductId: true, ratePct: true, enabled: true },
  });
  return rows.map((r) => ({
    targetType: r.targetType as ReferralTargetType,
    serviceProductId: r.serviceProductId,
    ratePct: roundPct(Math.min(100, r.ratePct)),
    enabled: r.enabled,
  }));
}

/** `isDefault = true` olan seqmenti qaytarır (yoxdursa null). */
export async function getDefaultTier() {
  return prisma.customerTier.findFirst({
    where: { isDefault: true },
    orderBy: { sortOrder: "asc" },
  });
}

/**
 * Verilmiş seqmentin hədəf üçün effektiv faizini, default-seqment mirasını da
 * nəzərə alaraq, əvvəlcədən yüklənmiş matrislərdən hesablayır (sorğusuz).
 * Kalkulyator kimi çox hədəfli görünüşlərdə istifadə üçün.
 */
export function pickRateWithFallback(
  target: { targetType: ReferralTargetType; serviceProductId?: string },
  tierRates: TierReferralRate[],
  defaultRates: TierReferralRate[],
): number {
  const spid = target.serviceProductId ?? "";
  const match = (rows: TierReferralRate[]) =>
    rows.find((r) => r.targetType === target.targetType && r.serviceProductId === spid);
  const own = match(tierRates);
  if (own) return own.enabled ? own.ratePct : 0;
  const def = match(defaultRates);
  if (def) return def.enabled ? def.ratePct : 0;
  return 0;
}
