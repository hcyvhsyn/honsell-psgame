import { prisma } from "./prisma";

export type PricingSettings = {
  tryToAznRate: number;
  /** Legacy global margin (kept for back-compat) */
  profitMarginPct: number;
  profitMarginGamesPct: number;
  profitMarginGiftCardsPct: number;
  profitMarginPsPlusPct: number;
  affiliateRatePct: number;
  /** % of profit margin shared with the referrer per purchase. */
  referralProfitSharePct: number;
  /** Streaming abunəliklər üçün ayrıca komissiya faizi (final qiymət üzərindən). */
  referralStreamingProfitSharePct: number;
  /** Rəy affiliate komissiya faizi (final qiymət üzərindən). */
  reviewAffiliateRatePct: number;
};

export type DisplayPrice = {
  /** Final price the user pays, in AZN */
  finalAzn: number;
  /** Original (non-discounted) price in AZN, only when a discount is active */
  originalAzn: number | null;
  /** Discount percent (0–100) when a discount is active, else null */
  discountPct: number | null;
};

/** Fetch the singleton settings row, creating it on first access. */
export async function getSettings(): Promise<PricingSettings> {
  try {
    const s = await prisma.settings.upsert({
      where: { id: "global" },
      update: {},
      create: { id: "global" },
    });
    return {
      tryToAznRate: s.tryToAznRate,
      profitMarginPct: s.profitMarginPct,
      profitMarginGamesPct: s.profitMarginGamesPct ?? s.profitMarginPct,
      profitMarginGiftCardsPct: s.profitMarginGiftCardsPct ?? s.profitMarginPct,
      profitMarginPsPlusPct: s.profitMarginPsPlusPct ?? s.profitMarginPct,
      affiliateRatePct: s.affiliateRatePct,
      referralProfitSharePct: s.referralProfitSharePct,
      referralStreamingProfitSharePct: s.referralStreamingProfitSharePct ?? 10,
      reviewAffiliateRatePct: s.reviewAffiliateRatePct ?? 5,
    };
  } catch (err) {
    // Prod DB might not be migrated yet (missing new Settings columns).
    const msg = err instanceof Error ? err.message : String(err);
    const missingNewColumns =
      msg.includes("profitMarginGamesPct") ||
      msg.includes("profitMarginGiftCardsPct") ||
      msg.includes("profitMarginPsPlusPct") ||
      msg.includes("referralStreamingProfitSharePct") ||
      msg.includes("reviewAffiliateRatePct");
    if (!missingNewColumns) throw err;

    const rows = await prisma.$queryRaw<
      Array<{
        tryToAznRate: number;
        profitMarginPct: number;
        affiliateRatePct: number;
        referralProfitSharePct: number;
      }>
    >`
      INSERT INTO "Settings" ("id", "updatedAt")
      VALUES ('global', NOW())
      ON CONFLICT ("id") DO UPDATE SET "id" = EXCLUDED."id"
      RETURNING "tryToAznRate", "profitMarginPct", "affiliateRatePct", "referralProfitSharePct";
    `;
    const s = rows[0] ?? {
      tryToAznRate: 0.053,
      profitMarginPct: 20,
      affiliateRatePct: 5,
      referralProfitSharePct: 20,
    };
    return {
      tryToAznRate: s.tryToAznRate,
      profitMarginPct: s.profitMarginPct,
      profitMarginGamesPct: s.profitMarginPct,
      profitMarginGiftCardsPct: s.profitMarginPct,
      profitMarginPsPlusPct: s.profitMarginPct,
      affiliateRatePct: s.affiliateRatePct,
      referralProfitSharePct: s.referralProfitSharePct,
      referralStreamingProfitSharePct: 10,
      reviewAffiliateRatePct: 5,
    };
  }
}

/**
 * Convert TRY price (in kuruş) to the *cost* in AZN — i.e. FX-converted but
 * BEFORE the profit margin is applied. Used to compute store profit per sale.
 */
export function tryCentsToCostAzn(
  tryCents: number,
  settings: PricingSettings
): number {
  const azn = (tryCents / 100) * settings.tryToAznRate;
  return Math.round(azn * 100) / 100;
}

/**
 * Convert a TRY price (in kuruş, integer * 100) into the user-facing AZN price.
 * Formula: (TRY * rate) * (1 + margin/100), rounded to 2 decimals.
 */
export function tryCentsToAzn(
  tryCents: number,
  settings: PricingSettings
): number {
  return tryCentsToAznWithMargin(tryCents, settings.tryToAznRate, settings.profitMarginPct);
}

export function tryCentsToAznWithMargin(
  tryCents: number,
  tryToAznRate: number,
  profitMarginPct: number
): number {
  const tryAmount = tryCents / 100;
  const azn = tryAmount * tryToAznRate;
  const withMargin = azn * (1 + profitMarginPct / 100);
  return Math.round(withMargin * 100) / 100;
}

/**
 * Compute the display price for a game. If a discount is active, the final
 * price uses the discounted TRY amount and `originalAzn` carries the
 * strike-through original.
 *
 * Expiry rules: bir endirim "aktiv" sayılır o zaman ki, `discountTryCents`
 * sıfırdan azdır AND ya `discountEndAt` boşdur, ya da gələcəkdədir. Köhnə
 * skreyp run-larından qalan stale endirimlər sayəsində runtime-da bu yoxlama
 * vacibdir — yoxsa istifadəçi artıq bitmiş endirimlə oyun ala bilər.
 */
export function computeDisplayPrice(
  game: {
    priceTryCents: number;
    discountTryCents: number | null;
    discountEndAt?: Date | string | null;
  },
  settings: PricingSettings
): DisplayPrice {
  const originalAzn = tryCentsToAznWithMargin(
    game.priceTryCents,
    settings.tryToAznRate,
    settings.profitMarginGamesPct ?? settings.profitMarginPct
  );

  const endAt =
    game.discountEndAt instanceof Date
      ? game.discountEndAt
      : game.discountEndAt
        ? new Date(game.discountEndAt)
        : null;
  const expired = endAt != null && endAt.getTime() <= Date.now();

  if (
    !expired &&
    game.discountTryCents != null &&
    game.discountTryCents < game.priceTryCents
  ) {
    const finalAzn = tryCentsToAznWithMargin(
      game.discountTryCents,
      settings.tryToAznRate,
      settings.profitMarginGamesPct ?? settings.profitMarginPct
    );
    const discountPct = Math.round(
      ((game.priceTryCents - game.discountTryCents) / game.priceTryCents) * 100
    );
    return { finalAzn, originalAzn, discountPct };
  }

  return { finalAzn: originalAzn, originalAzn: null, discountPct: null };
}
