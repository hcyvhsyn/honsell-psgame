-- Kampaniya klik izləmə: hər klik bir sətir + alıcı səviyyəsində aqreqat sayğaclar.

ALTER TABLE "CampaignRecipient" ADD COLUMN IF NOT EXISTS "clickCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CampaignRecipient" ADD COLUMN IF NOT EXISTS "firstClickAt" TIMESTAMP(3);
ALTER TABLE "CampaignRecipient" ADD COLUMN IF NOT EXISTS "lastClickAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "CampaignClick" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "recipientId" TEXT,
  "userId" TEXT,
  "productId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CampaignClick_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CampaignClick_campaignId_idx" ON "CampaignClick"("campaignId");
CREATE INDEX IF NOT EXISTS "CampaignClick_recipientId_idx" ON "CampaignClick"("recipientId");
CREATE INDEX IF NOT EXISTS "CampaignClick_campaignId_productId_idx" ON "CampaignClick"("campaignId", "productId");

DO $$ BEGIN
  ALTER TABLE "CampaignClick" ADD CONSTRAINT "CampaignClick_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "CampaignClick" ADD CONSTRAINT "CampaignClick_recipientId_fkey"
    FOREIGN KEY ("recipientId") REFERENCES "CampaignRecipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
