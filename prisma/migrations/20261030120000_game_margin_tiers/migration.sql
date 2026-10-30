-- Oyunlar üçün pilləli mənfəət + oyuna xüsusi qiymət (lib/gameMargin.ts).
-- Hamısı nullable: gameMarginTiers NULL → köhnə tək faiz, deploy anında qiymətlər dəyişmir.
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "gameMarginTiers" JSONB;
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "customMarginPct" DOUBLE PRECISION;
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "customPriceAznCents" INTEGER;
