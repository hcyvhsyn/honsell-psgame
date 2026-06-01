-- StreamingTitle: TMDB reytinq/populyarlıq metrikləri (scrape enrichment).
-- IF NOT EXISTS — runtime-da artıq tətbiq olunduğu üçün idempotent.
ALTER TABLE "StreamingTitle" ADD COLUMN IF NOT EXISTS "tmdbRating" DOUBLE PRECISION;
ALTER TABLE "StreamingTitle" ADD COLUMN IF NOT EXISTS "tmdbVoteCount" INTEGER;
ALTER TABLE "StreamingTitle" ADD COLUMN IF NOT EXISTS "tmdbPopularity" DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS "StreamingTitle_service_tmdbPopularity_idx" ON "StreamingTitle"("service", "tmdbPopularity");
CREATE INDEX IF NOT EXISTS "StreamingTitle_service_tmdbRating_idx" ON "StreamingTitle"("service", "tmdbRating");
