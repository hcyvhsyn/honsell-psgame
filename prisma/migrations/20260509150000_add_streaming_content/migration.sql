-- StreamingTitle: per-service films/series catalog with AZ availability flag.
CREATE TABLE "StreamingTitle" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'MOVIE',
    "service" TEXT NOT NULL,
    "posterUrl" TEXT,
    "backdropUrl" TEXT,
    "year" INTEGER,
    "genres" JSONB,
    "description" TEXT,
    "azAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreamingTitle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StreamingTitle_slug_key" ON "StreamingTitle"("slug");
CREATE INDEX "StreamingTitle_service_isActive_azAvailable_idx" ON "StreamingTitle"("service", "isActive", "azAvailable");
CREATE INDEX "StreamingTitle_service_sortOrder_idx" ON "StreamingTitle"("service", "sortOrder");

-- StreamingFeatured: admin-curated banner items, per scope (OVERVIEW or service code).
CREATE TABLE "StreamingFeatured" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreamingFeatured_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StreamingFeatured_scope_isActive_sortOrder_idx" ON "StreamingFeatured"("scope", "isActive", "sortOrder");
CREATE INDEX "StreamingFeatured_titleId_idx" ON "StreamingFeatured"("titleId");

ALTER TABLE "StreamingFeatured"
    ADD CONSTRAINT "StreamingFeatured_titleId_fkey"
    FOREIGN KEY ("titleId") REFERENCES "StreamingTitle"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
