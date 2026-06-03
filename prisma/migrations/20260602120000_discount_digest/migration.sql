-- Endirim bülleteni (weekly discount digest) marketinq sistemi.
-- IF NOT EXISTS / idempotent — təhlükəsiz təkrar tətbiq üçün.

-- User: marketinq opt-out + son göndəriş izləməsi.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "marketingUnsubscribedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastDigestSentAt" TIMESTAMP(3);

-- Game: endirimin ilk aşkarlanma anı ("yeni endirimlər" filtri üçün).
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "discountStartedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Game_discountStartedAt_idx" ON "Game"("discountStartedAt");

-- Həftəlik bülleten göndəriş qeydi (dedup: userId + weekStart).
CREATE TABLE IF NOT EXISTS "DiscountDigestNotification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "weekStart" TIMESTAMP(3) NOT NULL,
  "gameCount" INTEGER NOT NULL DEFAULT 0,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DiscountDigestNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DiscountDigestNotification_userId_weekStart_key"
  ON "DiscountDigestNotification"("userId", "weekStart");
CREATE INDEX IF NOT EXISTS "DiscountDigestNotification_weekStart_idx"
  ON "DiscountDigestNotification"("weekStart");

-- FK — User silindikdə qeydlər də silinsin.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DiscountDigestNotification_userId_fkey'
  ) THEN
    ALTER TABLE "DiscountDigestNotification"
      ADD CONSTRAINT "DiscountDigestNotification_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
