-- Reklam / Kampaniya: admin əl ilə göndərdiyi toplu endirim mesajları (WhatsApp + Email).

CREATE TABLE IF NOT EXISTS "Campaign" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "messageText" TEXT NOT NULL,
  "sendEmail" BOOLEAN NOT NULL DEFAULT false,
  "sendWhatsapp" BOOLEAN NOT NULL DEFAULT false,
  "gamesSnapshot" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "recipientCount" INTEGER NOT NULL DEFAULT 0,
  "emailSent" INTEGER NOT NULL DEFAULT 0,
  "emailFailed" INTEGER NOT NULL DEFAULT 0,
  "waSent" INTEGER NOT NULL DEFAULT 0,
  "waFailed" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),

  CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Campaign_status_createdAt_idx" ON "Campaign"("status", "createdAt");

CREATE TABLE IF NOT EXISTS "CampaignRecipient" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "emailStatus" TEXT NOT NULL DEFAULT 'N_A',
  "waStatus" TEXT NOT NULL DEFAULT 'N_A',
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CampaignRecipient_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CampaignRecipient_campaignId_idx" ON "CampaignRecipient"("campaignId");
CREATE INDEX IF NOT EXISTS "CampaignRecipient_userId_idx" ON "CampaignRecipient"("userId");

DO $$ BEGIN
  ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "CampaignRecipient" ADD CONSTRAINT "CampaignRecipient_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "CampaignRecipient" ADD CONSTRAINT "CampaignRecipient_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
