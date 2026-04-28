-- AlterTable
ALTER TABLE "Transaction"
  ADD COLUMN IF NOT EXISTS "receiptUrl" TEXT;

ALTER TABLE "Settings"
  ADD COLUMN IF NOT EXISTS "depositCardNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "depositCardHolder" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Transaction_status_type_idx" ON "Transaction" (status, type);
