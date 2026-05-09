-- Language metadata for StreamingTitle: original language (auto from OMDb)
-- and admin-curated dubbed/subtitle language arrays.
ALTER TABLE "StreamingTitle"
    ADD COLUMN "originalLanguage" TEXT,
    ADD COLUMN "dubbedLanguages" JSONB,
    ADD COLUMN "subtitleLanguages" JSONB;
