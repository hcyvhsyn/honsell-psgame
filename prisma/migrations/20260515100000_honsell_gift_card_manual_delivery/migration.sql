-- Honsell hədiyyə kartları artıq avtomatik kod yaratmır.
-- Alışdan sonra status PENDING olur; admin admin panelindən kodu manual daxil edir,
-- ardınca status ACTIVE olur və müştəriyə email göndərilir.

-- 1) code sütununu nullable etmək (PENDING kartlarda kod hələ yoxdur).
ALTER TABLE "HonsellGiftCard" ALTER COLUMN "code" DROP NOT NULL;

-- 2) Default statusu PENDING-ə dəyişmək (mövcud sətirlər toxunulmur).
ALTER TABLE "HonsellGiftCard" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- 3) Admin tərəfindən təslim edildiyi tarix.
ALTER TABLE "HonsellGiftCard" ADD COLUMN "deliveredAt" TIMESTAMP(3);
