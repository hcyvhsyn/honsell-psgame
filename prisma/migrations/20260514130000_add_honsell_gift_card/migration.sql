-- Honsell-in öz markamızın hədiyyə kartları üçün ayrıca cədvəl.
-- Mövcud `ServiceCode` model TRY top-up kodları üçün istifadə olunur (admin paste-edir),
-- buradakı kodlar isə hər alışda avtomatik generasiya olunur və başqa müştəri tərəfindən
-- aktivləşdirilərək wallet balansına çevrilir.

CREATE TABLE "HonsellGiftCard" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "amountAznCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "purchasedById" TEXT,
    "purchaseTransactionId" TEXT,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redeemedById" TEXT,
    "redeemTransactionId" TEXT,
    "redeemedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HonsellGiftCard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HonsellGiftCard_code_key" ON "HonsellGiftCard"("code");
CREATE INDEX "HonsellGiftCard_status_expiresAt_idx" ON "HonsellGiftCard"("status", "expiresAt");
CREATE INDEX "HonsellGiftCard_purchasedById_idx" ON "HonsellGiftCard"("purchasedById");
CREATE INDEX "HonsellGiftCard_redeemedById_idx" ON "HonsellGiftCard"("redeemedById");

ALTER TABLE "HonsellGiftCard"
  ADD CONSTRAINT "HonsellGiftCard_purchasedById_fkey"
  FOREIGN KEY ("purchasedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HonsellGiftCard"
  ADD CONSTRAINT "HonsellGiftCard_redeemedById_fkey"
  FOREIGN KEY ("redeemedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 8 nominal Honsell hədiyyə kartı (5, 10, 20, 50, 100, 200, 500, 1000 AZN)
-- ServiceProduct cədvəlində type='HONSELL_GIFT_CARD' ilə yaradılır ki, mövcud
-- səbət/checkout infrastrukturu istifadə edə bilsin. ID-lər stabil saxlanır.
INSERT INTO "ServiceProduct" ("id", "type", "title", "description", "imageUrl", "priceAznCents", "metadata", "isActive", "sortOrder", "createdAt", "updatedAt") VALUES
  ('hsl-giftcard-5',    'HONSELL_GIFT_CARD', 'Honsell Hədiyyə Kartı — 5 AZN',    'Honsell Store-da istifadə üçün 5 AZN nominalında hədiyyə kartı. Müştəri 11 simvollu unikal kod alır.',    NULL, 500,    '{"denominationAzn":5}'::jsonb,    true, 1, NOW(), NOW()),
  ('hsl-giftcard-10',   'HONSELL_GIFT_CARD', 'Honsell Hədiyyə Kartı — 10 AZN',   'Honsell Store-da istifadə üçün 10 AZN nominalında hədiyyə kartı. Müştəri 11 simvollu unikal kod alır.',   NULL, 1000,   '{"denominationAzn":10}'::jsonb,   true, 2, NOW(), NOW()),
  ('hsl-giftcard-20',   'HONSELL_GIFT_CARD', 'Honsell Hədiyyə Kartı — 20 AZN',   'Honsell Store-da istifadə üçün 20 AZN nominalında hədiyyə kartı. Müştəri 11 simvollu unikal kod alır.',   NULL, 2000,   '{"denominationAzn":20}'::jsonb,   true, 3, NOW(), NOW()),
  ('hsl-giftcard-50',   'HONSELL_GIFT_CARD', 'Honsell Hədiyyə Kartı — 50 AZN',   'Honsell Store-da istifadə üçün 50 AZN nominalında hədiyyə kartı. Müştəri 11 simvollu unikal kod alır.',   NULL, 5000,   '{"denominationAzn":50}'::jsonb,   true, 4, NOW(), NOW()),
  ('hsl-giftcard-100',  'HONSELL_GIFT_CARD', 'Honsell Hədiyyə Kartı — 100 AZN',  'Honsell Store-da istifadə üçün 100 AZN nominalında hədiyyə kartı. Müştəri 11 simvollu unikal kod alır.',  NULL, 10000,  '{"denominationAzn":100}'::jsonb,  true, 5, NOW(), NOW()),
  ('hsl-giftcard-200',  'HONSELL_GIFT_CARD', 'Honsell Hədiyyə Kartı — 200 AZN',  'Honsell Store-da istifadə üçün 200 AZN nominalında hədiyyə kartı. Müştəri 11 simvollu unikal kod alır.',  NULL, 20000,  '{"denominationAzn":200}'::jsonb,  true, 6, NOW(), NOW()),
  ('hsl-giftcard-500',  'HONSELL_GIFT_CARD', 'Honsell Hədiyyə Kartı — 500 AZN',  'Honsell Store-da istifadə üçün 500 AZN nominalında hədiyyə kartı. Müştəri 11 simvollu unikal kod alır.',  NULL, 50000,  '{"denominationAzn":500}'::jsonb,  true, 7, NOW(), NOW()),
  ('hsl-giftcard-1000', 'HONSELL_GIFT_CARD', 'Honsell Hədiyyə Kartı — 1000 AZN', 'Honsell Store-da istifadə üçün 1000 AZN nominalında hədiyyə kartı. Müştəri 11 simvollu unikal kod alır.', NULL, 100000, '{"denominationAzn":1000}'::jsonb, true, 8, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;
