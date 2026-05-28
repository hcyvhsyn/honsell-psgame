-- Epic genre tags for the PC catalog category filter. Text array, defaults to
-- empty so existing rows (PS + already-scraped Epic) are unaffected until the
-- next scrape backfills genres.

ALTER TABLE "Game"
  ADD COLUMN "genres" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
