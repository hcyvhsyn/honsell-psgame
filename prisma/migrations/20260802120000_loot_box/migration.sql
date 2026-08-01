-- Qutu açılışı (loot box) sistemi.
--
-- Marja zəmanəti: hovuz yaradılanda `budgetCostCents` dondurulur və
-- `plannedCostCents` onu heç vaxt aşa bilmir (yoxlama app qatındadır —
-- lib/lootBoxShared.ts → computePoolEconomics). Biletlər geri qoyulmadan
-- çəkildiyi üçün hovuz bitəndə faktiki maya planla bərabər olur.
--
-- LootBoxTicket.gameId və LootBoxOpening.gameId QƏSDƏN foreign key deyil:
-- bunlar snapshot sətirləridir (ProductGift ilə eyni yanaşma) və oyun
-- kataloqdan silinsə də maliyyə qeydi sağ qalmalıdır.

-- CreateTable
CREATE TABLE IF NOT EXISTS "LootBox" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "priceAznCents" INTEGER NOT NULL,
    "targetMarginPct" DOUBLE PRECISION NOT NULL DEFAULT 23,
    "minPrizePct" INTEGER NOT NULL DEFAULT 60,
    "maxPrizePct" INTEGER NOT NULL DEFAULT 200,
    "poolSize" INTEGER NOT NULL DEFAULT 100,
    "sellBackPct" INTEGER NOT NULL DEFAULT 70,
    "refillAtRemaining" INTEGER NOT NULL DEFAULT 20,
    "dailyLimitPerUser" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LootBox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LootBoxTemplate" (
    "id" TEXT NOT NULL,
    "lootBoxId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "ticketCount" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LootBoxTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LootBoxPool" (
    "id" TEXT NOT NULL,
    "lootBoxId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "totalTickets" INTEGER NOT NULL,
    "plannedCostCents" INTEGER NOT NULL,
    "plannedValueCents" INTEGER NOT NULL,
    "budgetCostCents" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LootBoxPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LootBoxTicket" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "gameId" TEXT NOT NULL,
    "titleSnap" TEXT NOT NULL,
    "imageSnap" TEXT,
    "store" TEXT,
    "valueAznCents" INTEGER NOT NULL,
    "costAznCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LootBoxTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LootBoxOpening" (
    "id" TEXT NOT NULL,
    "lootBoxId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "orderCode" TEXT NOT NULL,
    "pricePaidCents" INTEGER NOT NULL,
    "gameId" TEXT NOT NULL,
    "titleSnap" TEXT NOT NULL,
    "imageSnap" TEXT,
    "store" TEXT,
    "valueAznCents" INTEGER NOT NULL,
    "costAznCents" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'PENDING_CHOICE',
    "chosenAt" TIMESTAMP(3),
    "sellBackCents" INTEGER,
    "paymentTransactionId" TEXT,
    "fulfillmentTransactionId" TEXT,
    "sellBackTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LootBoxOpening_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LootBox_slug_key" ON "LootBox"("slug");
CREATE INDEX IF NOT EXISTS "LootBox_isActive_sortOrder_idx" ON "LootBox"("isActive", "sortOrder");

CREATE UNIQUE INDEX IF NOT EXISTS "LootBoxTemplate_lootBoxId_gameId_key" ON "LootBoxTemplate"("lootBoxId", "gameId");
CREATE INDEX IF NOT EXISTS "LootBoxTemplate_lootBoxId_isActive_idx" ON "LootBoxTemplate"("lootBoxId", "isActive");

CREATE UNIQUE INDEX IF NOT EXISTS "LootBoxPool_lootBoxId_seq_key" ON "LootBoxPool"("lootBoxId", "seq");
CREATE INDEX IF NOT EXISTS "LootBoxPool_lootBoxId_status_idx" ON "LootBoxPool"("lootBoxId", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "LootBoxTicket_poolId_slot_key" ON "LootBoxTicket"("poolId", "slot");
-- Çəkiliş sorğusunun əsas indeksi: OPEN hovuzlarda AVAILABLE biletlər.
CREATE INDEX IF NOT EXISTS "LootBoxTicket_poolId_status_idx" ON "LootBoxTicket"("poolId", "status");

-- Bir biletin iki açılış yaratmasını mümkünsüz edir (idempotentlik açarı).
CREATE UNIQUE INDEX IF NOT EXISTS "LootBoxOpening_ticketId_key" ON "LootBoxOpening"("ticketId");
CREATE UNIQUE INDEX IF NOT EXISTS "LootBoxOpening_orderCode_key" ON "LootBoxOpening"("orderCode");
CREATE INDEX IF NOT EXISTS "LootBoxOpening_userId_createdAt_idx" ON "LootBoxOpening"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "LootBoxOpening_lootBoxId_createdAt_idx" ON "LootBoxOpening"("lootBoxId", "createdAt");
CREATE INDEX IF NOT EXISTS "LootBoxOpening_outcome_idx" ON "LootBoxOpening"("outcome");
CREATE INDEX IF NOT EXISTS "LootBoxOpening_poolId_idx" ON "LootBoxOpening"("poolId");

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "LootBoxTemplate" ADD CONSTRAINT "LootBoxTemplate_lootBoxId_fkey"
    FOREIGN KEY ("lootBoxId") REFERENCES "LootBox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "LootBoxTemplate" ADD CONSTRAINT "LootBoxTemplate_gameId_fkey"
    FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "LootBoxPool" ADD CONSTRAINT "LootBoxPool_lootBoxId_fkey"
    FOREIGN KEY ("lootBoxId") REFERENCES "LootBox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "LootBoxTicket" ADD CONSTRAINT "LootBoxTicket_poolId_fkey"
    FOREIGN KEY ("poolId") REFERENCES "LootBoxPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Açılış maliyyə qeydidir: qutu silinsə silinməməlidir (RESTRICT).
DO $$
BEGIN
  ALTER TABLE "LootBoxOpening" ADD CONSTRAINT "LootBoxOpening_lootBoxId_fkey"
    FOREIGN KEY ("lootBoxId") REFERENCES "LootBox"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "LootBoxOpening" ADD CONSTRAINT "LootBoxOpening_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
