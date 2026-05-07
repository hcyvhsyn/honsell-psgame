-- CreateTable: ReferralCycle
CREATE TABLE "ReferralCycle" (
    "id" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralCycle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralCycle_startsAt_key" ON "ReferralCycle"("startsAt");
CREATE INDEX "ReferralCycle_endsAt_idx" ON "ReferralCycle"("endsAt");

-- CreateTable: ReferralCycleResult
CREATE TABLE "ReferralCycleResult" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invites" INTEGER NOT NULL DEFAULT 0,
    "spendCents" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralCycleResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralCycleResult_cycleId_userId_key" ON "ReferralCycleResult"("cycleId", "userId");
CREATE INDEX "ReferralCycleResult_cycleId_points_idx" ON "ReferralCycleResult"("cycleId", "points");
CREATE INDEX "ReferralCycleResult_userId_idx" ON "ReferralCycleResult"("userId");

ALTER TABLE "ReferralCycleResult" ADD CONSTRAINT "ReferralCycleResult_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ReferralCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralCycleResult" ADD CONSTRAINT "ReferralCycleResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: ReferralTier (admin-managed)
CREATE TABLE "ReferralTier" (
    "id" TEXT NOT NULL,
    "thresholdPoints" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "bonusAznCents" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralTier_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralTier_thresholdPoints_key" ON "ReferralTier"("thresholdPoints");
CREATE INDEX "ReferralTier_isActive_position_idx" ON "ReferralTier"("isActive", "position");

-- CreateTable: ReferralCycleReward
CREATE TABLE "ReferralCycleReward" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "bonusAznCents" INTEGER NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralCycleReward_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralCycleReward_cycleId_userId_tierId_key" ON "ReferralCycleReward"("cycleId", "userId", "tierId");
CREATE INDEX "ReferralCycleReward_userId_idx" ON "ReferralCycleReward"("userId");

ALTER TABLE "ReferralCycleReward" ADD CONSTRAINT "ReferralCycleReward_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ReferralCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralCycleReward" ADD CONSTRAINT "ReferralCycleReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralCycleReward" ADD CONSTRAINT "ReferralCycleReward_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "ReferralTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed defaults: keep the historic 5/10/25-invite milestones, translated to
-- points (1 invite = 10 pts). Admin can edit/extend these from the panel.
INSERT INTO "ReferralTier" ("id", "thresholdPoints", "label", "emoji", "bonusAznCents", "position", "isActive", "updatedAt")
VALUES
  ('rt_bronze_seed', 50,  'Bronze', '🥉', 500,  1, true, CURRENT_TIMESTAMP),
  ('rt_silver_seed', 100, 'Silver', '🥈', 1500, 2, true, CURRENT_TIMESTAMP),
  ('rt_gold_seed',   250, 'Gold',   '🥇', 5000, 3, true, CURRENT_TIMESTAMP)
ON CONFLICT ("thresholdPoints") DO NOTHING;
