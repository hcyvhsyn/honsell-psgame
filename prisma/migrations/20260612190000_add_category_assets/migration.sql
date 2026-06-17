CREATE TABLE IF NOT EXISTS "CategoryAsset" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "href" TEXT NOT NULL,
  "imageUrl" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CategoryAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CategoryAsset_key_key" ON "CategoryAsset"("key");
CREATE INDEX IF NOT EXISTS "CategoryAsset_isActive_sortOrder_idx" ON "CategoryAsset"("isActive", "sortOrder");
