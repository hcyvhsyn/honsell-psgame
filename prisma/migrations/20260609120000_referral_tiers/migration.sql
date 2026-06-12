-- Müştəri seqmentləri (CustomerTier) + referal faiz matrisi (ReferralRate).
--   * CustomerTier — admin tərəfindən idarə olunan müştəri seqmentləri ("Adi", "Sponsorlu", ...).
--   * ReferralRate — hər (seqment × hədəf) üçün komissiya faizi. Hədəf PS Store
--     kateqoriyası (PS_GAMES/PS_PLUS/GIFT_CARDS/ACCOUNT_CREATION) və ya konkret
--     ServiceProduct sətiridir (SERVICE_PRODUCT — hər abunəlik müddəti ayrıca).
--   * User.tierId — istifadəçinin aid olduğu seqment (NULL = default seqment).
--
-- Additive miqrasiya — heç bir mövcud sütun dəyişmir/silinmir. isSponsored saxlanılır.
-- Backfill və seqment seed-i ayrıca skript ilə edilir: scripts/seedReferralTiers.ts

-- CreateTable
CREATE TABLE "CustomerTier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralRate" (
    "id" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "serviceProductId" TEXT NOT NULL DEFAULT '',
    "ratePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralRate_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "User" ADD COLUMN "tierId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CustomerTier_slug_key" ON "CustomerTier"("slug");

-- CreateIndex
CREATE INDEX "CustomerTier_sortOrder_idx" ON "CustomerTier"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralRate_tierId_targetType_serviceProductId_key" ON "ReferralRate"("tierId", "targetType", "serviceProductId");

-- CreateIndex
CREATE INDEX "ReferralRate_tierId_targetType_idx" ON "ReferralRate"("tierId", "targetType");

-- CreateIndex
CREATE INDEX "ReferralRate_serviceProductId_idx" ON "ReferralRate"("serviceProductId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "CustomerTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralRate" ADD CONSTRAINT "ReferralRate_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "CustomerTier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
