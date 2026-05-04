-- CreateTable
CREATE TABLE IF NOT EXISTS "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceProductId" TEXT NOT NULL,
    "psnAccountId" TEXT,
    "tier" TEXT NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "priceAznCents" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "remind3SentAt" TIMESTAMP(3),
    "remind1SentAt" TIMESTAMP(3),
    "lowBalanceSentAt" TIMESTAMP(3),
    "lastRenewedAt" TIMESTAMP(3),
    "lastRenewalTxId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Subscription_userId_idx" ON "Subscription"("userId");
CREATE INDEX IF NOT EXISTS "Subscription_status_expiresAt_idx" ON "Subscription"("status", "expiresAt");
CREATE INDEX IF NOT EXISTS "Subscription_autoRenew_expiresAt_idx" ON "Subscription"("autoRenew", "expiresAt");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_serviceProductId_fkey" FOREIGN KEY ("serviceProductId") REFERENCES "ServiceProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_psnAccountId_fkey" FOREIGN KEY ("psnAccountId") REFERENCES "PsnAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
