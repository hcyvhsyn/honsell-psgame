-- CreateTable
CREATE TABLE "CartSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "totalAznCents" INTEGER NOT NULL DEFAULT 0,
    "signature" TEXT NOT NULL,
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CartSnapshot_userId_key" ON "CartSnapshot"("userId");

-- CreateIndex
CREATE INDEX "CartSnapshot_updatedAt_idx" ON "CartSnapshot"("updatedAt");

-- CreateIndex
CREATE INDEX "CartSnapshot_reminderSentAt_idx" ON "CartSnapshot"("reminderSentAt");

-- AddForeignKey
ALTER TABLE "CartSnapshot" ADD CONSTRAINT "CartSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
