-- Vahid qalib sistemi: sayt iştirakçıları + admin tərəfindən xaricdən əlavə
-- olunan qaliblər (Instagram/WhatsApp/offline) + mənbə-şəffaf qalib rəyləri +
-- audit izi. Enum əvəzinə String sütunlar (kodbaza konvensiyası; app-səviyyə
-- validasiya) — CHECK yox, mövcud üslubla eyni.

-- ─── GiveawayWinner ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "GiveawayWinner" (
  "id"                TEXT NOT NULL,
  "giveawayId"        TEXT NOT NULL,
  "entryId"           TEXT,
  "name"              TEXT NOT NULL,
  "phone"             TEXT,
  "email"             TEXT,
  "instagramUsername" TEXT,
  "avatarUrl"         TEXT,
  "prizeTitle"        TEXT,
  "source"            TEXT NOT NULL,
  "selectionMethod"   TEXT NOT NULL,
  "selectedAt"        TIMESTAMP(3) NOT NULL,
  "selectedById"      TEXT,
  "proofUrl"          TEXT,
  "proofIsPublic"     BOOLEAN NOT NULL DEFAULT false,
  "internalNote"      TEXT,
  "isPublic"          BOOLEAN NOT NULL DEFAULT true,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GiveawayWinner_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GiveawayWinner_giveawayId_idx" ON "GiveawayWinner"("giveawayId");
CREATE INDEX IF NOT EXISTS "GiveawayWinner_entryId_idx" ON "GiveawayWinner"("entryId");

ALTER TABLE "GiveawayWinner"
  ADD CONSTRAINT "GiveawayWinner_giveawayId_fkey"
  FOREIGN KEY ("giveawayId") REFERENCES "Giveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GiveawayWinner"
  ADD CONSTRAINT "GiveawayWinner_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "GiveawayEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── GiveawayWinnerReview ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "GiveawayWinnerReview" (
  "id"                   TEXT NOT NULL,
  "winnerId"             TEXT NOT NULL,
  "text"                 TEXT NOT NULL,
  "rating"               INTEGER,
  "imageUrl"             TEXT,
  "videoUrl"             TEXT,
  "source"               TEXT NOT NULL,
  "entryMethod"          TEXT NOT NULL,
  "originalSubmittedAt"  TIMESTAMP(3),
  "enteredByAdminId"     TEXT,
  "hasPublishingConsent" BOOLEAN NOT NULL DEFAULT false,
  "status"               TEXT NOT NULL DEFAULT 'PENDING',
  "isPublic"             BOOLEAN NOT NULL DEFAULT false,
  "internalNote"         TEXT,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GiveawayWinnerReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GiveawayWinnerReview_winnerId_idx" ON "GiveawayWinnerReview"("winnerId");
CREATE INDEX IF NOT EXISTS "GiveawayWinnerReview_status_isPublic_idx" ON "GiveawayWinnerReview"("status", "isPublic");

ALTER TABLE "GiveawayWinnerReview"
  ADD CONSTRAINT "GiveawayWinnerReview_winnerId_fkey"
  FOREIGN KEY ("winnerId") REFERENCES "GiveawayWinner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── GiveawayAuditLog ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "GiveawayAuditLog" (
  "id"         TEXT NOT NULL,
  "giveawayId" TEXT,
  "actorId"    TEXT,
  "entityType" TEXT NOT NULL,
  "entityId"   TEXT NOT NULL,
  "action"     TEXT NOT NULL,
  "prevData"   TEXT,
  "newData"    TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GiveawayAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GiveawayAuditLog_giveawayId_createdAt_idx" ON "GiveawayAuditLog"("giveawayId", "createdAt");
CREATE INDEX IF NOT EXISTS "GiveawayAuditLog_entityType_entityId_idx" ON "GiveawayAuditLog"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "GiveawayAuditLog_actorId_createdAt_idx" ON "GiveawayAuditLog"("actorId", "createdAt");
