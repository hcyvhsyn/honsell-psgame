-- Trigram search infrastructure for the /api/search/ai keyword track.
--
-- Without pg_trgm installed, the route's `similarity(title, q)` query throws on
-- every request and silently falls back to an unindexed `ILIKE '%x%'`
-- sequential scan over the whole Game table — slow on every keystroke. This
-- migration installs the extension and a GIN trigram index so both the `%`
-- similarity operator and `ILIKE '%x%'` become index-accelerated.
--
-- Idempotent (IF NOT EXISTS) so it is safe to re-run / apply out of band.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Game_title_trgm_idx"
  ON "Game" USING gin (title gin_trgm_ops);
