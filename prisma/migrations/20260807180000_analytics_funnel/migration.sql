-- Satış hunisi + kanal atributsiyası (FAZA 1).
--
-- Problem: admin paneldə gəlir/mənfəət hesabatı var, amma "hansı kanal real pul
-- gətirir" sualına cavab yoxdur. Trafik darboğazdırsa, bu sual investisiyanı
-- hara yönəltməyi müəyyən edir.
--
-- Bu miqrasiya YALNIZ əlavə edir: yeni cədvəllər + Transaction-da nullable sütun.
-- Mövcud sətirlərə toxunmur, cədvəli bloklamır.

-- ─── Transaction → sifariş kodu ─────────────────────────────────────────────
-- Bir checkout N Transaction sətri yaradır; hamısı eyni orderCode-u daşıyır.
-- Kod artıq `metadata` JSON-unun içindədir, amma oradan oxumaq hesabatı LIKE
-- skanına çevirərdi. Bu sütun checkout-dan sonra tək `updateMany` ilə dolur.
ALTER TABLE "Transaction"
  ADD COLUMN IF NOT EXISTS "orderCode" TEXT;

CREATE INDEX IF NOT EXISTS "Transaction_orderCode_idx"
  ON "Transaction" ("orderCode");

-- ─── Xam event axını ────────────────────────────────────────────────────────
-- id client tərəfdə yaradılan UUID-dir (DEFAULT yoxdur): sendBeacon dublikat
-- göndərə bildiyi üçün ON CONFLICT DO NOTHING ilə idempotentlik verir.
CREATE TABLE IF NOT EXISTS "AnalyticsEvent" (
  "id"            TEXT NOT NULL,
  "visitorId"     TEXT NOT NULL,
  "sessionId"     TEXT NOT NULL,
  "userId"        TEXT,
  "name"          TEXT NOT NULL,
  "path"          TEXT NOT NULL,
  "productId"     TEXT,
  "productType"   TEXT,
  "valueAznCents" INTEGER,
  "query"         TEXT,
  "channel"       TEXT NOT NULL,
  "isBot"         BOOLEAN NOT NULL DEFAULT false,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AnalyticsEvent_name_createdAt_idx"
  ON "AnalyticsEvent" ("name", "createdAt");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_visitorId_createdAt_idx"
  ON "AnalyticsEvent" ("visitorId", "createdAt");
-- Saxlama müddəti cron-u (180 gün) bu indekslə işləyir.
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_createdAt_idx"
  ON "AnalyticsEvent" ("createdAt");

-- ─── Seans (hesabatın əsl oxuduğu cədvəl) ───────────────────────────────────
-- Funnel bayraqları INTEGER-dir, BOOLEAN deyil — Prisma groupBy Int-i _sum edə
-- bilir, Boolean-ı yox. Beləcə bütün kanal hunisi tək sorğudur.
CREATE TABLE IF NOT EXISTS "AnalyticsSession" (
  "id"                TEXT NOT NULL,
  "visitorId"         TEXT NOT NULL,
  "sessionId"         TEXT NOT NULL,
  "userId"            TEXT,

  "firstChannel"      TEXT NOT NULL,
  "firstSource"       TEXT,
  "firstMedium"       TEXT,
  "firstCampaign"     TEXT,
  "firstReferrerHost" TEXT,
  "firstLandingPath"  TEXT,

  "lastChannel"       TEXT NOT NULL,
  "lastSource"        TEXT,
  "lastMedium"        TEXT,
  "lastCampaign"      TEXT,
  "lastReferrerHost"  TEXT,

  "landingPath"       TEXT NOT NULL,
  "pageViews"         INTEGER NOT NULL DEFAULT 0,

  "sawProduct"        INTEGER NOT NULL DEFAULT 0,
  "addedToCart"       INTEGER NOT NULL DEFAULT 0,
  "beganCheckout"     INTEGER NOT NULL DEFAULT 0,
  "purchased"         INTEGER NOT NULL DEFAULT 0,

  "isBot"             BOOLEAN NOT NULL DEFAULT false,

  "startedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt"        TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AnalyticsSession_pkey" PRIMARY KEY ("id")
);

-- Beacon upsert-in açarı. İki beacon eyni anda gəlsə P2002 verir; endpoint
-- onu tutub bir dəfə təkrar edir.
CREATE UNIQUE INDEX IF NOT EXISTS "AnalyticsSession_visitorId_sessionId_key"
  ON "AnalyticsSession" ("visitorId", "sessionId");
CREATE INDEX IF NOT EXISTS "AnalyticsSession_startedAt_idx"
  ON "AnalyticsSession" ("startedAt");
CREATE INDEX IF NOT EXISTS "AnalyticsSession_firstChannel_startedAt_idx"
  ON "AnalyticsSession" ("firstChannel", "startedAt");
CREATE INDEX IF NOT EXISTS "AnalyticsSession_lastChannel_startedAt_idx"
  ON "AnalyticsSession" ("lastChannel", "startedAt");

-- ─── Sifariş → kanal damğası ────────────────────────────────────────────────
-- Checkout anında bir dəfə yazılır. Ödənilməyən kart sifarişi burada sətir
-- qoyur, amma SUCCESS Transaction qoymur → "ödənişə keçdi, ödəmədi" pulsuz gəlir.
CREATE TABLE IF NOT EXISTS "OrderAttribution" (
  "id"                 TEXT NOT NULL,
  "orderCode"          TEXT NOT NULL,
  "userId"             TEXT NOT NULL,
  "visitorId"          TEXT,
  "sessionId"          TEXT,

  "firstChannel"       TEXT NOT NULL,
  "firstSource"        TEXT,
  "firstMedium"        TEXT,
  "firstCampaign"      TEXT,
  "firstReferrerHost"  TEXT,
  "firstLandingPath"   TEXT,

  "lastChannel"        TEXT NOT NULL,
  "lastSource"         TEXT,
  "lastMedium"         TEXT,
  "lastCampaign"       TEXT,
  "lastReferrerHost"   TEXT,

  "paymentMethod"      TEXT NOT NULL,
  "orderTotalAznCents" INTEGER NOT NULL DEFAULT 0,

  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrderAttribution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrderAttribution_orderCode_key"
  ON "OrderAttribution" ("orderCode");
CREATE INDEX IF NOT EXISTS "OrderAttribution_createdAt_idx"
  ON "OrderAttribution" ("createdAt");
CREATE INDEX IF NOT EXISTS "OrderAttribution_firstChannel_createdAt_idx"
  ON "OrderAttribution" ("firstChannel", "createdAt");
CREATE INDEX IF NOT EXISTS "OrderAttribution_lastChannel_createdAt_idx"
  ON "OrderAttribution" ("lastChannel", "createdAt");
