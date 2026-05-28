-- Epic Games Store catalog support on the shared Game table:
--   * `store`     — discriminates PS Store ("PS") vs Epic ("EPIC") rows.
--   * `namespace` — Epic catalog namespace (used to build product links).
--   * USD price columns — Azərbaycan (country=AZ) prices for Epic rows; TRY
--     stays in priceTryCents/discountTryCents (country=TR). All additive and
--     nullable/defaulted so existing PS rows are untouched.

ALTER TABLE "Game"
  ADD COLUMN "store"            TEXT NOT NULL DEFAULT 'PS',
  ADD COLUMN "namespace"        TEXT,
  ADD COLUMN "priceUsdCents"    INTEGER,
  ADD COLUMN "discountUsdCents" INTEGER;

CREATE INDEX "Game_store_idx" ON "Game" ("store");
