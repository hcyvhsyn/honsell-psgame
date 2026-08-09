-- IMDb rəsmi datasetlərindən gələn iki əlavə:
--   1. title.ratings.tsv.gz  → StreamingTitle.imdbRating / imdbVotes
--   2. title.akas.tsv.gz     → StreamingTitleName (tr/ru/en + orijinal ad)
--
-- Mövcud tmdbRating sütunları TOXUNULMUR — onlar fallback olaraq qalır.

ALTER TABLE "StreamingTitle"
    ADD COLUMN "imdbRating" DOUBLE PRECISION,
    ADD COLUMN "imdbVotes" INTEGER;

CREATE INDEX "StreamingTitle_service_imdbRating_idx" ON "StreamingTitle"("service", "imdbRating");

CREATE TABLE "StreamingTitleName" (
    "titleId" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isOriginal" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'IMDB_AKAS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StreamingTitleName_pkey" PRIMARY KEY ("titleId", "lang", "name")
);

CREATE INDEX "StreamingTitleName_titleId_idx" ON "StreamingTitleName"("titleId");
CREATE INDEX "StreamingTitleName_lang_name_idx" ON "StreamingTitleName"("lang", "name");

ALTER TABLE "StreamingTitleName"
    ADD CONSTRAINT "StreamingTitleName_titleId_fkey"
    FOREIGN KEY ("titleId") REFERENCES "StreamingTitle"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
