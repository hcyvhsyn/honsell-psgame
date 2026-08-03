-- Eyni müştəri eyni oyunu yalnız bir dəfə qazana bilsin.
--
-- Çəkiliş vaxtı müştərinin əvvəl qazandığı oyunların biletləri süzülür
-- (lib/lootBoxes.ts → drawTicket). Marja zəmanətinə təsiri yoxdur: biletlər
-- yenə də hamısı çəkilir, sadəcə hansı müştəriyə düşdüyü dəyişir.
--
-- Söndürülə bilən olması vacibdir: kataloq kiçik olanda müştəri bütün uyğun
-- oyunları qazanıb qutudan istifadə edə bilməz vəziyyətinə düşür.

ALTER TABLE "LootBox" ADD COLUMN IF NOT EXISTS "uniquePrizePerUser" BOOLEAN NOT NULL DEFAULT true;
