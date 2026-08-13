-- Qiymət güdmə — admin "bu müştəri bu oyunu istəyir, amma baha görür" qeydi
-- saxlayır, oyun endirimə düşən kimi WhatsApp mesajı gedir.
--
-- Mövcud "Favorite" cədvəli bunu ÖRTMÜR: o, qeydiyyatlı istifadəçi (userId +
-- e-poçt) tələb edir. Güdülən müştərilərin əksəriyyəti WhatsApp/Instagram-dan
-- yazır və heç bir hesabı yoxdur, ona görə burada identifikator TELEFON-dur.
CREATE TABLE IF NOT EXISTS "GamePriceWatch" (
  "id"                TEXT NOT NULL,
  "phone"             TEXT NOT NULL,
  "name"              TEXT,
  "gameId"            TEXT NOT NULL,
  "note"              TEXT,
  "basePriceAznCents" INTEGER,
  "isActive"          BOOLEAN NOT NULL DEFAULT true,
  "lastNotifiedAt"    TIMESTAMP(3),
  "notifyCount"       INTEGER NOT NULL DEFAULT 0,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GamePriceWatch_pkey" PRIMARY KEY ("id")
);

-- Eyni nömrəyə eyni oyun iki dəfə qeyd olunmasın (admin təkrar əlavə edəndə
-- API upsert kimi davranır).
CREATE UNIQUE INDEX IF NOT EXISTS "GamePriceWatch_phone_gameId_key"
  ON "GamePriceWatch" ("phone", "gameId");

-- Scrape axını: "bu oyunu güdən varmı?" sorğusu gameId üzrədir.
CREATE INDEX IF NOT EXISTS "GamePriceWatch_gameId_idx"
  ON "GamePriceWatch" ("gameId");

-- Admin siyahısı: aktiv qeydlər, ən yenidən.
CREATE INDEX IF NOT EXISTS "GamePriceWatch_isActive_createdAt_idx"
  ON "GamePriceWatch" ("isActive", "createdAt");

-- Dedup: bir güdmə sətri × bir endirim dalğası = bir mesaj.
-- discountStartedAt = həmin endirim pəncərəsinin möhürü (discountEndAt, yoxdursa
-- scrape vaxtı). Oyun tam qiymətə qayıdıb yenidən endirimə düşsə açar dəyişir
-- və müştəri yeni mesaj alır; eyni dalğada təkrar scrape unique-ə düşür.
CREATE TABLE IF NOT EXISTS "GamePriceWatchNotification" (
  "id"                TEXT NOT NULL,
  "watchId"           TEXT NOT NULL,
  "discountStartedAt" TIMESTAMP(3) NOT NULL,
  "priceAznCents"     INTEGER,
  "sentAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GamePriceWatchNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GamePriceWatchNotification_watchId_discountStartedAt_key"
  ON "GamePriceWatchNotification" ("watchId", "discountStartedAt");

CREATE INDEX IF NOT EXISTS "GamePriceWatchNotification_watchId_sentAt_idx"
  ON "GamePriceWatchNotification" ("watchId", "sentAt");

-- Oyun kataloqdan silinsə güdmə qeydi də getsin (qeyd oyunsuz mənasızdır).
DO $$
BEGIN
  ALTER TABLE "GamePriceWatch"
    ADD CONSTRAINT "GamePriceWatch_gameId_fkey"
    FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "GamePriceWatchNotification"
    ADD CONSTRAINT "GamePriceWatchNotification_watchId_fkey"
    FOREIGN KEY ("watchId") REFERENCES "GamePriceWatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
