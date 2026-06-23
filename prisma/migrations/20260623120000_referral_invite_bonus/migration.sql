-- Settings: sabit dəvət bonusu (qəpik) — adi və sponsorlu müştəri üçün ayrı.
ALTER TABLE "Settings" ADD COLUMN "referralInviteBonusCents" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "Settings" ADD COLUMN "sponsoredReferralInviteBonusCents" INTEGER NOT NULL DEFAULT 30;

-- Dəvət bonusu qeydləri + anti-spam review növbəsi.
CREATE TABLE "ReferralInviteBonus" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "refereeId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PAID',
    "suspicious" BOOLEAN NOT NULL DEFAULT false,
    "flagReasons" TEXT,
    "transactionId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReferralInviteBonus_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralInviteBonus_refereeId_key" ON "ReferralInviteBonus"("refereeId");
CREATE INDEX "ReferralInviteBonus_status_idx" ON "ReferralInviteBonus"("status");
CREATE INDEX "ReferralInviteBonus_referrerId_idx" ON "ReferralInviteBonus"("referrerId");

ALTER TABLE "ReferralInviteBonus" ADD CONSTRAINT "ReferralInviteBonus_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferralInviteBonus" ADD CONSTRAINT "ReferralInviteBonus_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
