-- /abunelik: CRM müştərilərinin abunəliklərinə baxış və saytdan yeniləmə (lib/crmRenewals.ts).
-- Yalnız yeni cədvəllər — mövcud dataya toxunmur.
CREATE TABLE IF NOT EXISTS "PhoneOtp" (
    "id" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PhoneOtp_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PhoneOtp_phoneE164_purpose_createdAt_idx" ON "PhoneOtp"("phoneE164", "purpose", "createdAt");

CREATE TABLE IF NOT EXISTS "CrmRenewalOrder" (
    "id" TEXT NOT NULL,
    "paymentTransactionId" TEXT NOT NULL,
    "externalRef" TEXT NOT NULL,
    "orderCode" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "months" INTEGER NOT NULL,
    "amountAznCents" INTEGER NOT NULL,
    "chargedAznCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "crmStatus" TEXT,
    "crmOrderId" TEXT,
    "crmSyncedAt" TIMESTAMP(3),
    "crmSyncError" TEXT,
    "crmSyncAttemptAt" TIMESTAMP(3),
    "resultEndDate" TIMESTAMP(3),
    "failReason" TEXT,
    "refundStatus" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CrmRenewalOrder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmRenewalOrder_paymentTransactionId_key" ON "CrmRenewalOrder"("paymentTransactionId");
CREATE UNIQUE INDEX IF NOT EXISTS "CrmRenewalOrder_externalRef_key" ON "CrmRenewalOrder"("externalRef");
CREATE INDEX IF NOT EXISTS "CrmRenewalOrder_status_createdAt_idx" ON "CrmRenewalOrder"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "CrmRenewalOrder_userId_idx" ON "CrmRenewalOrder"("userId");
CREATE INDEX IF NOT EXISTS "CrmRenewalOrder_phone_ref_idx" ON "CrmRenewalOrder"("phone", "ref");

DO $$ BEGIN
  ALTER TABLE "CrmRenewalOrder" ADD CONSTRAINT "CrmRenewalOrder_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
