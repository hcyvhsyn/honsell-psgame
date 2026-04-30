-- CreateTable
CREATE TABLE IF NOT EXISTS "ServiceProduct" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "priceAznCents" INTEGER NOT NULL,
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceProduct_pkey" PRIMARY KEY ("id")
);

-- Idempotent for tables that already existed before this migration
ALTER TABLE "ServiceProduct" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ServiceProduct_type_idx" ON "ServiceProduct"("type");

-- CreateTable
CREATE TABLE IF NOT EXISTS "ServiceCode" (
    "id" TEXT NOT NULL,
    "serviceProductId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ServiceCode_serviceProductId_isUsed_idx" ON "ServiceCode"("serviceProductId", "isUsed");

-- AddForeignKey
ALTER TABLE "ServiceCode"
  ADD CONSTRAINT "ServiceCode_serviceProductId_fkey"
  FOREIGN KEY ("serviceProductId") REFERENCES "ServiceProduct"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: add Transaction service refs
ALTER TABLE "Transaction"
  ADD COLUMN IF NOT EXISTS "serviceProductId" TEXT,
  ADD COLUMN IF NOT EXISTS "serviceCodeId" TEXT;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Transaction_serviceProductId_fkey'
  ) THEN
    ALTER TABLE "Transaction"
      ADD CONSTRAINT "Transaction_serviceProductId_fkey"
      FOREIGN KEY ("serviceProductId") REFERENCES "ServiceProduct"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Transaction_serviceCodeId_fkey'
  ) THEN
    ALTER TABLE "Transaction"
      ADD CONSTRAINT "Transaction_serviceCodeId_fkey"
      FOREIGN KEY ("serviceCodeId") REFERENCES "ServiceCode"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;
