-- Xidmət dəstləri (Netflix + HBO Max, Prime Video + Spotify, Disney+ + VPN …).
--
-- `GameBundle` yalnız `Game` sətirlərini bağlayır; xidmətlər ayrıca cədvəldədir
-- (`ServiceProduct`), ona görə dəst də ayrıca modeldir.
--
-- Qiymət rejimi YALNIZ CUSTOM-dur: admin hər üzvə dəst-daxili qiymət yazır,
-- ona görə `pricingMode`/`discountPct` sütunları yoxdur.
--
-- Tamamilə additivdir: mövcud cədvəllərə toxunmur.

CREATE TABLE IF NOT EXISTS "ServiceBundle" (
  "id"          TEXT NOT NULL,
  "slug"        TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "subtitle"    TEXT,
  "description" TEXT,
  "imageUrl"    TEXT,
  "badgeText"   TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "isFeatured"  BOOLEAN NOT NULL DEFAULT false,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "startsAt"    TIMESTAMP(3),
  "endsAt"      TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ServiceBundle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ServiceBundle_slug_key" ON "ServiceBundle" ("slug");
CREATE INDEX IF NOT EXISTS "ServiceBundle_isActive_sortOrder_idx" ON "ServiceBundle" ("isActive", "sortOrder");
CREATE INDEX IF NOT EXISTS "ServiceBundle_isFeatured_idx" ON "ServiceBundle" ("isFeatured");

CREATE TABLE IF NOT EXISTS "ServiceBundleItem" (
  "bundleId"         TEXT NOT NULL,
  "serviceProductId" TEXT NOT NULL,
  "position"         INTEGER NOT NULL DEFAULT 0,
  "priceAznCents"    INTEGER,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ServiceBundleItem_pkey" PRIMARY KEY ("bundleId", "serviceProductId")
);

CREATE INDEX IF NOT EXISTS "ServiceBundleItem_bundleId_position_idx" ON "ServiceBundleItem" ("bundleId", "position");
CREATE INDEX IF NOT EXISTS "ServiceBundleItem_serviceProductId_idx" ON "ServiceBundleItem" ("serviceProductId");

ALTER TABLE "ServiceBundleItem"
  ADD CONSTRAINT "ServiceBundleItem_bundleId_fkey"
  FOREIGN KEY ("bundleId") REFERENCES "ServiceBundle" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceBundleItem"
  ADD CONSTRAINT "ServiceBundleItem_serviceProductId_fkey"
  FOREIGN KEY ("serviceProductId") REFERENCES "ServiceProduct" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
