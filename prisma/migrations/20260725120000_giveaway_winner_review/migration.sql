-- Çəkiliş qalib rəyləri (sosial sübut): admin hədiyyəni çatdırdıqdan sonra qalibə
-- /cekilis-rey/<token> linki göndərir; qalib rəy + opsional foto yazır və çəkiliş
-- səhifəsində ictimai göstərilir. Bütün sahələr GiveawayEntry üzərində saxlanılır
-- (bir qalib = bir entry = bir rəy).
ALTER TABLE "GiveawayEntry" ADD COLUMN IF NOT EXISTS "reviewToken" TEXT;
ALTER TABLE "GiveawayEntry" ADD COLUMN IF NOT EXISTS "reviewText" TEXT;
ALTER TABLE "GiveawayEntry" ADD COLUMN IF NOT EXISTS "reviewRating" INTEGER;
ALTER TABLE "GiveawayEntry" ADD COLUMN IF NOT EXISTS "reviewImageUrl" TEXT;
ALTER TABLE "GiveawayEntry" ADD COLUMN IF NOT EXISTS "reviewStatus" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "GiveawayEntry" ADD COLUMN IF NOT EXISTS "reviewSentAt" TIMESTAMP(3);
ALTER TABLE "GiveawayEntry" ADD COLUMN IF NOT EXISTS "reviewSubmittedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "GiveawayEntry_reviewToken_key" ON "GiveawayEntry"("reviewToken");
