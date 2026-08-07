-- Oyun paketləri (satıla bilən səbətlər).
--
-- `Collection` redaksiya siyahısıdır (qiyməti yoxdur), `LootBox` isə səbətdən yan
-- keçir və məzmunu təsadüfidir. Deterministik, səbətdən satılan oyun dəsti üçün
-- ayrıca model lazımdır.
--
-- Qiymət rejimi:
--   PERCENT → oyunların cari vitrin qiymətlərinin cəmindən discountPct% aşağı
--   CUSTOM  → hər GameBundleItem.priceAznCents ayrıca yazılır
--
-- Tamamilə additivdir: mövcud cədvəllərə toxunmur.

CREATE TABLE IF NOT EXISTS "GameBundle" (
  "id"          TEXT NOT NULL,
  "slug"        TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "subtitle"    TEXT,
  "description" TEXT,
  "imageUrl"    TEXT,
  "badgeText"   TEXT,
  "pricingMode" TEXT NOT NULL DEFAULT 'PERCENT',
  "discountPct" INTEGER NOT NULL DEFAULT 0,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "isFeatured"  BOOLEAN NOT NULL DEFAULT false,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "startsAt"    TIMESTAMP(3),
  "endsAt"      TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GameBundle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GameBundle_slug_key" ON "GameBundle" ("slug");
CREATE INDEX IF NOT EXISTS "GameBundle_isActive_sortOrder_idx" ON "GameBundle" ("isActive", "sortOrder");
CREATE INDEX IF NOT EXISTS "GameBundle_isFeatured_idx" ON "GameBundle" ("isFeatured");

CREATE TABLE IF NOT EXISTS "GameBundleItem" (
  "bundleId"      TEXT NOT NULL,
  "gameId"        TEXT NOT NULL,
  "position"      INTEGER NOT NULL DEFAULT 0,
  "priceAznCents" INTEGER,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GameBundleItem_pkey" PRIMARY KEY ("bundleId", "gameId")
);

CREATE INDEX IF NOT EXISTS "GameBundleItem_bundleId_position_idx" ON "GameBundleItem" ("bundleId", "position");
CREATE INDEX IF NOT EXISTS "GameBundleItem_gameId_idx" ON "GameBundleItem" ("gameId");

ALTER TABLE "GameBundleItem"
  ADD CONSTRAINT "GameBundleItem_bundleId_fkey"
  FOREIGN KEY ("bundleId") REFERENCES "GameBundle" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GameBundleItem"
  ADD CONSTRAINT "GameBundleItem_gameId_fkey"
  FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
