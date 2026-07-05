-- Kupon (PromoCode) + redemption + bonus qrant markeri + community giriş sütunu.

ALTER TABLE "User" ADD COLUMN "communityCampaignAccess" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "maxDiscountCents" INTEGER,
    "minOrderCents" INTEGER NOT NULL DEFAULT 0,
    "productTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "perUserLimit" INTEGER NOT NULL DEFAULT 1,
    "userId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'ADMIN',
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");
CREATE INDEX "PromoCode_userId_idx" ON "PromoCode"("userId");
CREATE INDEX "PromoCode_isActive_idx" ON "PromoCode"("isActive");
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PromoRedemption" (
    "id" TEXT NOT NULL,
    "promoCodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "discountCents" INTEGER NOT NULL,
    "orderCode" TEXT NOT NULL,
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromoRedemption_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PromoRedemption_orderCode_key" ON "PromoRedemption"("orderCode");
CREATE UNIQUE INDEX "PromoRedemption_promoCodeId_userId_orderCode_key"
  ON "PromoRedemption"("promoCodeId", "userId", "orderCode");
CREATE INDEX "PromoRedemption_promoCodeId_idx" ON "PromoRedemption"("promoCodeId");
CREATE INDEX "PromoRedemption_userId_idx" ON "PromoRedemption"("userId");
ALTER TABLE "PromoRedemption" ADD CONSTRAINT "PromoRedemption_promoCodeId_fkey"
  FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromoRedemption" ADD CONSTRAINT "PromoRedemption_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "BonusGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderCode" TEXT NOT NULL,
    "walletCreditCents" INTEGER NOT NULL DEFAULT 0,
    "bonusPromoCodeId" TEXT,
    "communityAccess" BOOLEAN NOT NULL DEFAULT false,
    "orderTotalCents" INTEGER NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BonusGrant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BonusGrant_orderCode_key" ON "BonusGrant"("orderCode");
CREATE INDEX "BonusGrant_userId_idx" ON "BonusGrant"("userId");
ALTER TABLE "BonusGrant" ADD CONSTRAINT "BonusGrant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
