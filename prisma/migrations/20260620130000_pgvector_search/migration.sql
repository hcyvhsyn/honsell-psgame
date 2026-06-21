-- Semantik axtarışı pgvector ANN-a keçirir. Əvvəl `embedding Float[]` bütün
-- kataloq (7637+ sətir) tətbiqə yüklənib JS-də cosine hesablanırdı — soyuq
-- yükləmə ~114s çəkir və hər 5 dəq cache bitəndə müştəri axtarışı donurdu.
-- İndi axtarış DB-də HNSW indeksi ilə top-K qaytarır (~ms).

-- 1. pgvector.
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Mirror sütun. `embedding Float[]` mənbə-həqiqət olaraq qalır (scraper +
--    admin backfill onu yazır); `embeddingVec` trigger ilə avtomatik sinxronlanır.
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "embeddingVec" vector(512);

-- 3. Sinxron trigger: `embedding` 512-ölçülü olduqda vektoru hesablayır, əks
--    halda NULL (boş-massiv default-lu yeni sətirlər embed olunana qədər).
CREATE OR REPLACE FUNCTION game_sync_embedding_vec() RETURNS trigger AS $$
BEGIN
  IF array_length(NEW.embedding, 1) = 512 THEN
    NEW."embeddingVec" := NEW.embedding::vector(512);
  ELSE
    NEW."embeddingVec" := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS game_embedding_vec_sync ON "Game";
CREATE TRIGGER game_embedding_vec_sync
  BEFORE INSERT OR UPDATE OF embedding ON "Game"
  FOR EACH ROW EXECUTE FUNCTION game_sync_embedding_vec();

-- 4. Mövcud embedding-ləri backfill et (DB-daxili cast — yenidən embed yoxdur).
UPDATE "Game" SET "embeddingVec" = embedding::vector(512)
 WHERE array_length(embedding, 1) = 512 AND "embeddingVec" IS NULL;

-- 5. Cosine üçün HNSW ANN indeksi.
CREATE INDEX IF NOT EXISTS "Game_embeddingVec_hnsw_idx"
  ON "Game" USING hnsw ("embeddingVec" vector_cosine_ops);

-- 6. Keyword yolu üçün trgm GIN indeksi — köhnə migration extension yaratmışdı,
--    amma indeks prod-da yox idi, ona görə hər keyword axtarış seq-scan idi.
CREATE INDEX IF NOT EXISTS "Game_title_trgm_idx"
  ON "Game" USING gin (title gin_trgm_ops);
