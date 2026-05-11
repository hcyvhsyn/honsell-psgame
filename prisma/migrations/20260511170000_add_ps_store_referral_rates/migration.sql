ALTER TABLE "Settings" ADD COLUMN "referralGamesPct" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Settings" ADD COLUMN "referralPsPlusPct" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Settings" ADD COLUMN "referralGiftCardsPct" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Settings" ADD COLUMN "referralAccountCreationPct" DOUBLE PRECISION NOT NULL DEFAULT 0;

UPDATE "Settings"
SET "referralGamesPct" =
  CASE
    WHEN "referralProfitSharePct" > 0 AND "profitMarginGamesPct" > 0
      THEN ROUND((("referralProfitSharePct" * "profitMarginGamesPct") / (100 + "profitMarginGamesPct"))::numeric, 1)::double precision
    ELSE 0
  END;
