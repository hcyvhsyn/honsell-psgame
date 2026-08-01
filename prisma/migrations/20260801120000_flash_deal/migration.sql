-- CreateTable
CREATE TABLE "FlashDeal" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "priceAznCents" INTEGER,
    "originalAznCents" INTEGER,
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlashDeal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FlashDeal_gameId_key" ON "FlashDeal"("gameId");

-- CreateIndex
CREATE INDEX "FlashDeal_isActive_sortOrder_idx" ON "FlashDeal"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "FlashDeal_endsAt_idx" ON "FlashDeal"("endsAt");

-- AddForeignKey
ALTER TABLE "FlashDeal" ADD CONSTRAINT "FlashDeal_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
