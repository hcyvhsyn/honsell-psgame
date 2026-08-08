-- "Saxla" düyməsi — film/serial reels-ləri üçün izləmə siyahısı.
--
-- Oyun reels-ində "Saxla" mövcud "Favorite" cədvəlinə yazır (orada endirim
-- bildirişləri də var). Film/serial isə heç bir məhsula bağlı deyil — yalnız
-- videonun özü var, ona görə burada REEL saxlanılır.
CREATE TABLE IF NOT EXISTS "ReelBookmark" (
  "reelId"    TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReelBookmark_pkey" PRIMARY KEY ("reelId", "userId")
);

-- "Saxladıqlarım" feed-i istifadəçi üzrə, ən son saxlanılandan sıralayır.
CREATE INDEX IF NOT EXISTS "ReelBookmark_userId_createdAt_idx"
  ON "ReelBookmark" ("userId", "createdAt");

-- Reel və ya istifadəçi silinəndə sətir də getsin.
DO $$
BEGIN
  ALTER TABLE "ReelBookmark"
    ADD CONSTRAINT "ReelBookmark_reelId_fkey"
    FOREIGN KEY ("reelId") REFERENCES "Reel" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ReelBookmark"
    ADD CONSTRAINT "ReelBookmark_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
