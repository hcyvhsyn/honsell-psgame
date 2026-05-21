-- Website Services modulu: paket idarəetməsi və müştəri müraciətləri.

CREATE TABLE "WebsiteServicePackage" (
  "id"           TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "priceRange"   TEXT NOT NULL,
  "description"  TEXT NOT NULL,
  "features"     JSONB NOT NULL,
  "deliveryTime" TEXT,
  "isPopular"    BOOLEAN NOT NULL DEFAULT false,
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "sortOrder"    INTEGER NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WebsiteServicePackage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebsiteServicePackage_isActive_sortOrder_idx"
  ON "WebsiteServicePackage" ("isActive", "sortOrder");

CREATE TABLE "WebsiteServiceApplication" (
  "id"                    TEXT NOT NULL,
  "fullName"              TEXT NOT NULL,
  "phone"                 TEXT NOT NULL,
  "businessName"          TEXT,
  "websiteType"           TEXT NOT NULL,
  "packageId"             TEXT,
  "budgetRange"           TEXT,
  "hasLogo"               BOOLEAN,
  "hasDomain"             BOOLEAN,
  "hasHosting"            BOOLEAN,
  "projectBrief"          TEXT NOT NULL,
  "referenceWebsiteLinks" TEXT,
  "requestedSections"     JSONB,
  "urgency"               TEXT,
  "wantsCustomDesign"     BOOLEAN,
  "designStyle"           TEXT,
  "contentStatus"         TEXT,
  "status"                TEXT NOT NULL DEFAULT 'NEW',
  "adminNotes"            TEXT,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WebsiteServiceApplication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebsiteServiceApplication_status_createdAt_idx"
  ON "WebsiteServiceApplication" ("status", "createdAt");
CREATE INDEX "WebsiteServiceApplication_createdAt_idx"
  ON "WebsiteServiceApplication" ("createdAt");

ALTER TABLE "WebsiteServiceApplication"
  ADD CONSTRAINT "WebsiteServiceApplication_packageId_fkey"
    FOREIGN KEY ("packageId") REFERENCES "WebsiteServicePackage"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
