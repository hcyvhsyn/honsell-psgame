-- AI-powered semantic search infrastructure:
--   * Per-game embedding vector (OpenAI text-embedding-3-small, 512-dim)
--   * Fingerprint of the embedded text so the scraper can skip unchanged rows
--   * Cache for LLM "Bunu nəzərdə tutdunuz?" corrections

ALTER TABLE "Game"
  ADD COLUMN "embedding"     DOUBLE PRECISION[] NOT NULL DEFAULT ARRAY[]::DOUBLE PRECISION[],
  ADD COLUMN "embeddingHash" TEXT;

CREATE TABLE "SearchTypoSuggestion" (
  "id"         TEXT         NOT NULL,
  "queryNorm"  TEXT         NOT NULL,
  "suggestion" TEXT         NOT NULL,
  "hits"       INTEGER      NOT NULL DEFAULT 1,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SearchTypoSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SearchTypoSuggestion_queryNorm_key"
  ON "SearchTypoSuggestion" ("queryNorm");
CREATE INDEX "SearchTypoSuggestion_queryNorm_idx"
  ON "SearchTypoSuggestion" ("queryNorm");
