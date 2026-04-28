import { prisma } from "./prisma";

export type PricingSettings = {
  tryToAznRate: number;
  profitMarginPct: number;
  affiliateRatePct: number;
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
  const s = await prisma.settings.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global" },
  });
  return {
    tryToAznRate: s.tryToAznRate,
    profitMarginPct: s.profitMarginPct,
    affiliateRatePct: s.affiliateRatePct,
  };
}

/**
 * Convert a TRY price (in kuruş, integer * 100) into the user-facing AZN price.
 * Formula: (TRY * rate) * (1 + margin/100), rounded to 2 decimals.
 */
export function tryCentsToAzn(
  tryCents: number,
  settings: PricingSettings
): number {
  const tryAmount = tryCents / 100;
  const azn = tryAmount * settings.tryToAznRate;
  const withMargin = azn * (1 + settings.profitMarginPct / 100);
  return Math.round(withMargin * 100) / 100;
}

/**
 * Compute the display price for a game. If a discount is active, the final
 * price uses the discounted TRY amount and `originalAzn` carries the
 * strike-through original.
 */
export function computeDisplayPrice(
  game: { priceTryCents: number; discountTryCents: number | null },
  settings: PricingSettings
): DisplayPrice {
  const originalAzn = tryCentsToAzn(game.priceTryCents, settings);

  if (game.discountTryCents != null && game.discountTryCents < game.priceTryCents) {
    const finalAzn = tryCentsToAzn(game.discountTryCents, settings);
    const discountPct = Math.round(
      ((game.priceTryCents - game.discountTryCents) / game.priceTryCents) * 100
    );
    return { finalAzn, originalAzn, discountPct };
  }

  return { finalAzn: originalAzn, originalAzn: null, discountPct: null };
}
