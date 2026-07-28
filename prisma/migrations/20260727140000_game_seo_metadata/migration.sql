-- SEO bünövrəsi: oyun səhifələri üçün slug URL-lər + PS Store detal
-- səhifəsindən çəkilən metadata + AI ilə generasiya olunan azərbaycanca təsvir.
--
-- Hamısı NULLable əlavə olunur ki, mövcud sətirlərə toxunmadan tətbiq olunsun;
-- slug backfill-i ayrıca skriptlə (scripts/backfillGameSlugs.ts) gedir.
-- Unikal indeks Postgres-də NULL-ları toqquşdurmur, ona görə backfill
-- tamamlanana qədər çoxlu NULL slug problem yaratmır.

ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "slug"              TEXT;
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "descriptionShort"  TEXT;
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "descriptionLong"   TEXT;
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "publisherName"     TEXT;
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "releaseDate"       TIMESTAMP(3);
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "contentRating"     TEXT;
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "psRatingAvg"       DOUBLE PRECISION;
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "psRatingCount"     INTEGER;
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "descriptionAz"     TEXT;
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "descriptionAzHash" TEXT;
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "metadataFetchedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Game_slug_key" ON "Game"("slug");
CREATE INDEX IF NOT EXISTS "Game_metadataFetchedAt_idx" ON "Game"("metadataFetchedAt");
