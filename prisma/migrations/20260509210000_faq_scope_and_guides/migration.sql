-- FaqItem.scope: per-page scoping. Existing rows backfill to "HOME".
ALTER TABLE "FaqItem"
    ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'HOME';

-- The old composite index becomes (scope, isActive, sortOrder); drop the legacy
-- one if present, then add the new one.
DROP INDEX IF EXISTS "FaqItem_isActive_sortOrder_idx";
CREATE INDEX "FaqItem_scope_isActive_sortOrder_idx"
    ON "FaqItem"("scope", "isActive", "sortOrder");

-- PlatformGuide: admin-curated short guides ("Faydalı başlıqlar"), per scope.
CREATE TABLE "PlatformGuide" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformGuide_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformGuide_slug_key" ON "PlatformGuide"("slug");
CREATE INDEX "PlatformGuide_scope_isActive_sortOrder_idx"
    ON "PlatformGuide"("scope", "isActive", "sortOrder");
