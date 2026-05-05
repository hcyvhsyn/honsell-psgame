-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");
CREATE INDEX "Collection_isActive_sortOrder_idx" ON "Collection"("isActive", "sortOrder");
CREATE INDEX "Collection_isFeatured_idx" ON "Collection"("isFeatured");

-- CreateTable
CREATE TABLE "CollectionGame" (
    "collectionId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionGame_pkey" PRIMARY KEY ("collectionId","gameId")
);

-- CreateIndex
CREATE INDEX "CollectionGame_collectionId_position_idx" ON "CollectionGame"("collectionId", "position");
CREATE INDEX "CollectionGame_gameId_idx" ON "CollectionGame"("gameId");

-- AddForeignKey
ALTER TABLE "CollectionGame" ADD CONSTRAINT "CollectionGame_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CollectionGame" ADD CONSTRAINT "CollectionGame_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed: 5 starter collections (admin populates games via UI)
INSERT INTO "Collection" ("id", "slug", "title", "description", "isFeatured", "sortOrder", "updatedAt") VALUES
  ('seed_col_rpg',     'en-yaxsi-rpg-oyunlari',     'Ən yaxşı RPG oyunları',         'PlayStation üçün seçilmiş ən yaxşı rol-yönümlü oyunlar.',                    true,  0, CURRENT_TIMESTAMP),
  ('seed_col_coop',    'coxoyunculu-oyunlar',       'Çoxoyunculu və kooperativ',     'Dostlarınla birgə oynamaq üçün ən yaxşı seçimlər.',                          true,  1, CURRENT_TIMESTAMP),
  ('seed_col_ps5',     'ps5-eksklusivler',          'PS5 eksklüziv oyunları',        'Yalnız PlayStation 5-də mövcud olan eksklüziv buraxılışlar.',                true,  2, CURRENT_TIMESTAMP),
  ('seed_col_indie',   'indi-oyunlar',              'İndi (müstəqil) oyunlar',       'Kiçik komandaların böyük ürəklə hazırladığı orijinal təcrübələr.',           false, 3, CURRENT_TIMESTAMP),
  ('seed_col_sport',   'idman-yaris-oyunlari',      'İdman və yarış oyunları',       'Futboldan F1-ə qədər ən populyar idman və yarış oyunları.',                  false, 4, CURRENT_TIMESTAMP);
