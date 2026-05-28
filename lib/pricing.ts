import { prisma } from "./prisma";

export type PricingSettings = {
  tryToAznRate: number;
  /** Epic Azərbaycan (USD) price → AZN multiplier. */
  usdToAznRate: number;
  /** Epic sale-price position (%) between TR cost (0) and AZ reference (100). */
  epicPositionPct: number;
  /** Minimum profit buffer (%) the Epic referral-aware price floor enforces. */
  epicMinProfitPct: number;
  /** Legacy global margin (kept for back-compat) */
  profitMarginPct: number;
  profitMarginGamesPct: number;
  profitMarginGiftCardsPct: number;
  profitMarginPsPlusPct: number;
  affiliateRatePct: number;
  /** % of profit margin shared with the referrer per purchase. */
  referralProfitSharePct: number;
  /** PS Store oyunları üçün final satış məbləği üzərindən referal faizi. */
  referralGamesPct: number;
  /** "Sponsorlu" müştərilərin dəvət etdiyi istifadəçilərin oyun alışları üçün artırılmış referal faizi. */
  sponsoredReferralGamesPct: number;
  /** PS Plus üçün final satış məbləği üzərindən referal faizi. */
  referralPsPlusPct: number;
  /** TRY hədiyyə kartları üçün final satış məbləği üzərindən referal faizi. */
  referralGiftCardsPct: number;
  /** Hesab açma xidməti üçün final satış məbləği üzərindən referal faizi. */
  referralAccountCreationPct: number;
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

function roundPct(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * 10) / 10;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function computeLegacyGameReferralRatePct(
  referralProfitSharePct: number,
  marginPct: number,
) {
  if (referralProfitSharePct <= 0 || marginPct <= 0) return 0;
  return roundPct((referralProfitSharePct * marginPct) / (100 + marginPct));
}

/** Fetch the singleton settings row, creating it on first access. */
export async function getSettings(): Promise<PricingSettings> {
  try {
    const s = await prisma.settings.upsert({
      where: { id: "global" },
      update: {},
      create: { id: "global" },
    });
    const legacyGameReferralPct = computeLegacyGameReferralRatePct(
      s.referralProfitSharePct,
      s.profitMarginGamesPct ?? s.profitMarginPct,
    );
    return {
      tryToAznRate: s.tryToAznRate,
      usdToAznRate: s.usdToAznRate ?? 1.7,
      epicPositionPct: s.epicPositionPct ?? 50,
      epicMinProfitPct: s.epicMinProfitPct ?? 10,
      profitMarginPct: s.profitMarginPct,
      profitMarginGamesPct: s.profitMarginGamesPct ?? s.profitMarginPct,
      profitMarginGiftCardsPct: s.profitMarginGiftCardsPct ?? s.profitMarginPct,
      profitMarginPsPlusPct: s.profitMarginPsPlusPct ?? s.profitMarginPct,
      affiliateRatePct: s.affiliateRatePct,
      referralProfitSharePct: s.referralProfitSharePct,
      referralGamesPct: s.referralGamesPct ?? legacyGameReferralPct,
      sponsoredReferralGamesPct: s.sponsoredReferralGamesPct ?? 8,
      referralPsPlusPct: s.referralPsPlusPct ?? 0,
      referralGiftCardsPct: s.referralGiftCardsPct ?? 0,
      referralAccountCreationPct: s.referralAccountCreationPct ?? 0,
      referralStreamingProfitSharePct: s.referralStreamingProfitSharePct ?? 10,
      reviewAffiliateRatePct: s.reviewAffiliateRatePct ?? 5,
    };
  } catch (err) {
    // Prod DB might not be migrated yet (missing new Settings columns).
    const msg = err instanceof Error ? err.message : String(err);
    const missingNewColumns =
      msg.includes("usdToAznRate") ||
      msg.includes("epicPositionPct") ||
      msg.includes("epicMinProfitPct") ||
      msg.includes("profitMarginGamesPct") ||
      msg.includes("profitMarginGiftCardsPct") ||
      msg.includes("profitMarginPsPlusPct") ||
      msg.includes("referralGamesPct") ||
      msg.includes("sponsoredReferralGamesPct") ||
      msg.includes("referralPsPlusPct") ||
      msg.includes("referralGiftCardsPct") ||
      msg.includes("referralAccountCreationPct") ||
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
      usdToAznRate: 1.7,
      epicPositionPct: 50,
      epicMinProfitPct: 10,
      profitMarginPct: s.profitMarginPct,
      profitMarginGamesPct: s.profitMarginPct,
      profitMarginGiftCardsPct: s.profitMarginPct,
      profitMarginPsPlusPct: s.profitMarginPct,
      affiliateRatePct: s.affiliateRatePct,
      referralProfitSharePct: s.referralProfitSharePct,
      referralGamesPct: computeLegacyGameReferralRatePct(
        s.referralProfitSharePct,
        s.profitMarginPct,
      ),
      sponsoredReferralGamesPct: 8,
      referralPsPlusPct: 0,
      referralGiftCardsPct: 0,
      referralAccountCreationPct: 0,
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
 * Reverse of `tryCentsToAznWithMargin`: given a target AZN price, return the
 * integer TRY-cents threshold that would map to it under the games margin.
 * Used by the catalog price-range filter to translate AZN UI bounds into
 * the integer column comparisons the DB can do efficiently.
 *
 * For `mode: "floor"` we round DOWN so a "max 50 AZN" filter doesn't exclude
 * rows that round to exactly 50.00 AZN at display time; for `mode: "ceil"`
 * we round UP for the same reason on the min side. The half-step margin is
 * negligible at TRY-cent precision but keeps the boundary inclusive.
 */
export function aznToTryCents(
  azn: number,
  settings: PricingSettings,
  mode: "floor" | "ceil" = "floor"
): number {
  if (!Number.isFinite(azn) || azn <= 0) return 0;
  const margin = settings.profitMarginGamesPct ?? settings.profitMarginPct;
  const rate = settings.tryToAznRate;
  if (rate <= 0) return 0;
  const tryAmount = azn / rate / (1 + margin / 100);
  const cents = tryAmount * 100;
  return mode === "floor" ? Math.floor(cents) : Math.ceil(cents);
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
    /** When "EPIC", pricing is delegated to the positional Epic model. */
    store?: string | null;
    priceUsdCents?: number | null;
    discountUsdCents?: number | null;
  },
  settings: PricingSettings
): DisplayPrice {
  // Epic rows use positional pricing (TR cost ↔ AZ reference), not the PS
  // margin model. Delegate so every caller — catalog, cart, checkout, purchase
  // — prices Epic games consistently and correctly.
  if (game.store === "EPIC") {
    const e = computeEpicDisplayPrice(game, settings);
    return {
      finalAzn: e.finalAzn,
      originalAzn: e.originalAzn,
      discountPct: e.discountPct,
    };
  }

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

export type EpicPriceBreakdown = DisplayPrice & {
  /** Our cost — effective TR (Türkiye) price converted to AZN. */
  costAzn: number;
  /** Epic Azərbaycan reference price in AZN (null when no USD price scraped). */
  referenceAzn: number | null;
  /** Gross profit at the final price (final − cost). */
  profitAzn: number;
  /** Net profit after the games referral commission is paid from the sale. */
  netProfitAzn: number;
  /** True when the referral-aware floor lifted the price above the positioned value. */
  floored: boolean;
};

/**
 * Epic pricing is positional, not margin-based: the sale price is placed
 * between our TR cost (`epicPositionPct = 0`) and the Azərbaycan USD reference
 * (`= 100`). A referral-aware floor guarantees the final price still covers
 * cost + the games referral payout + a minimum profit buffer, so referred
 * sales can't run at a loss. The AZ reference doubles as the struck-through
 * "original" so the customer sees their saving vs buying on Epic directly.
 */
export function computeEpicDisplayPrice(
  game: {
    priceTryCents: number;
    discountTryCents: number | null;
    priceUsdCents?: number | null;
    discountUsdCents?: number | null;
  },
  settings: PricingSettings
): EpicPriceBreakdown {
  // Effective source prices — use the discounted figure when one is active.
  const effTry = game.discountTryCents ?? game.priceTryCents;
  const costAzn = round2((effTry / 100) * settings.tryToAznRate);

  const effUsd =
    game.discountUsdCents != null
      ? game.discountUsdCents
      : game.priceUsdCents ?? null;
  const referenceAzn =
    effUsd != null && effUsd > 0
      ? round2((effUsd / 100) * settings.usdToAznRate)
      : null;

  const refPct = Math.max(0, settings.referralGamesPct ?? 0);
  const minProfit = Math.max(0, settings.epicMinProfitPct ?? 0);

  // Floor: gross up the cost so that, after paying `refPct` of the final price
  // as referral, what's left still covers cost plus the min profit buffer.
  const floor =
    refPct >= 100
      ? Number.POSITIVE_INFINITY
      : round2((costAzn * (1 + minProfit / 100)) / (1 - refPct / 100));

  // Position between cost and reference. With no usable AZ reference we can't
  // position, so fall back to the floor.
  let positioned: number;
  if (referenceAzn != null && referenceAzn > costAzn) {
    const pos = Math.min(100, Math.max(0, settings.epicPositionPct ?? 50));
    positioned = round2(costAzn + (pos / 100) * (referenceAzn - costAzn));
  } else {
    positioned = floor;
  }

  let finalAzn = Math.max(positioned, floor);
  // Don't price above Epic's own AZ price — unless the floor forces it (selling
  // below the floor would lose money once referral is paid; margin wins).
  if (referenceAzn != null && referenceAzn >= floor) {
    finalAzn = Math.min(finalAzn, referenceAzn);
  }
  finalAzn = round2(finalAzn);

  const showSaving = referenceAzn != null && finalAzn < referenceAzn;
  const originalAzn = showSaving ? referenceAzn : null;
  const discountPct = showSaving
    ? Math.round(((referenceAzn! - finalAzn) / referenceAzn!) * 100)
    : null;

  return {
    finalAzn,
    originalAzn,
    discountPct,
    costAzn,
    referenceAzn,
    profitAzn: round2(finalAzn - costAzn),
    netProfitAzn: round2(finalAzn * (1 - refPct / 100) - costAzn),
    floored: finalAzn > positioned + 0.001,
  };
}
