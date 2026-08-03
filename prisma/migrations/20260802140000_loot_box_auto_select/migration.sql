-- Qutu açılışı: əl ilə resept → avtomatik oyun seçimi.
--
-- Artıq admin oyunları və bilet saylarını əl ilə yazmır. Hovuz yaradılanda
-- sistem kataloqdan qiymət aralığına uyğun oyunları özü tapır və paylanmanı
-- büdcəyə uyğunlaşdırır (lib/lootBoxShared.ts → allocateTickets).
-- `LootBoxTemplate` indi yalnız adminin ULDUZ seçimini saxlayır.
--
-- Tam additiv: mövcud sətirlərə toxunmur, köhnə `ticketCount` sütunu qalır
-- (istifadə olunmur) ki, artıq tətbiq edilmiş bazalarda sınmasın.

ALTER TABLE "LootBoxTemplate" ADD COLUMN IF NOT EXISTS "stars" INTEGER NOT NULL DEFAULT 3;

-- Köhnə sxemdə məcburi idi; avtomatik seçimə keçdikdən sonra yazılmır.
ALTER TABLE "LootBoxTemplate" ALTER COLUMN "ticketCount" SET DEFAULT 0;

ALTER TABLE "LootBox" ADD COLUMN IF NOT EXISTS "maxSharePct" INTEGER NOT NULL DEFAULT 40;
ALTER TABLE "LootBox" ADD COLUMN IF NOT EXISTS "discountGuardDays" INTEGER NOT NULL DEFAULT 7;
ALTER TABLE "LootBox" ADD COLUMN IF NOT EXISTS "candidateStore" TEXT;

-- Avtomatik hovuz doldurma uğursuz olarsa səbəb saxlanılsın: əvvəllər yalnız
-- konsola yazılırdı və qutu səssizcə boşalırdı.
ALTER TABLE "LootBox" ADD COLUMN IF NOT EXISTS "lastRefillError" TEXT;
ALTER TABLE "LootBox" ADD COLUMN IF NOT EXISTS "lastRefillErrorAt" TIMESTAMP(3);
