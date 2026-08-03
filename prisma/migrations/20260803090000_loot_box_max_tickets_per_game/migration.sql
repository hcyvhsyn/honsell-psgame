-- Qutu hovuzunda ÇEŞİD idarəsi.
--
-- `maxSharePct` faizlə işləyir və böyük hovuzlarda kobuddur: 300 biletin 1%-i
-- hələ də 3 biletdir, yəni "hər hədiyyə fərqli oyun olsun" demək mümkün deyil.
-- Bu sütun mütləq həddi verir; 0 = köhnə davranış (yalnız faiz limiti).
--
-- Əlavə etmə additivdir və defaultu var — mövcud qutuların davranışı dəyişmir.
ALTER TABLE "LootBox"
  ADD COLUMN IF NOT EXISTS "maxTicketsPerGame" INTEGER NOT NULL DEFAULT 0;
