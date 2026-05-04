-- AlterTable
ALTER TABLE "Banner" ADD COLUMN "actionType" TEXT NOT NULL DEFAULT 'LINK';
ALTER TABLE "Banner" ADD COLUMN "gameId" TEXT;

-- CreateIndex
CREATE INDEX "Banner_gameId_idx" ON "Banner"("gameId");

-- AddForeignKey
ALTER TABLE "Banner" ADD CONSTRAINT "Banner_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;
