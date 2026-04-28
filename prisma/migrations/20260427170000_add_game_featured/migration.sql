-- AlterTable
ALTER TABLE "Game"
  ADD COLUMN IF NOT EXISTS "isFeatured" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Game_isFeatured_idx" ON "Game" ("isFeatured");
