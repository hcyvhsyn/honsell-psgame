-- Epic positional pricing knobs on the Settings singleton:
--   * usdToAznRate     — Azərbaycan (USD) Epic price → AZN multiplier.
--   * epicPositionPct  — where between TR cost (0%) and AZ reference (100%) the
--                        sale price lands.
--   * epicMinProfitPct — minimum profit buffer the referral-aware floor adds.
-- All additive with defaults so existing rows keep working.

ALTER TABLE "Settings"
  ADD COLUMN "usdToAznRate"     DOUBLE PRECISION NOT NULL DEFAULT 1.7,
  ADD COLUMN "epicPositionPct"  DOUBLE PRECISION NOT NULL DEFAULT 50,
  ADD COLUMN "epicMinProfitPct" DOUBLE PRECISION NOT NULL DEFAULT 10;
