-- Çəkiliş təkmilləşdirmələri:
--  • minSpendAznCents   — PURCHASE_MIN_AMOUNT şərti (≥X AZN xərcləyən qoşula bilər)
--  • ticketUnitAznCents — bilet sistemi (hər X AZN = 1 əlavə şans, weighted draw)
--  • deliveredAt        — "✅ Hədiyyə çatdırıldı" badge-i üçün
ALTER TABLE "Giveaway" ADD COLUMN IF NOT EXISTS "minSpendAznCents" INTEGER;
ALTER TABLE "Giveaway" ADD COLUMN IF NOT EXISTS "ticketUnitAznCents" INTEGER;
ALTER TABLE "GiveawayWinner" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);
