-- Website xidməti üçün AI-əsaslı qiymət hesablama:
--   * Add-on cədvəli (admin idarə edir)
--   * Qiymət konfiqurasiyası (singleton)
--   * Müraciətdə AI snapshot sahələri

CREATE TABLE "WebsiteServiceAddOn" (
  "id"          TEXT NOT NULL,
  "slug"        TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "category"    TEXT,
  "pricingType" TEXT NOT NULL,
  "flatPrice"   DECIMAL(10, 2),
  "freeUnits"   INTEGER,
  "unitPrice"   DECIMAL(10, 2),
  "unitLabel"   TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WebsiteServiceAddOn_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebsiteServiceAddOn_slug_key"
  ON "WebsiteServiceAddOn" ("slug");
CREATE INDEX "WebsiteServiceAddOn_isActive_sortOrder_idx"
  ON "WebsiteServiceAddOn" ("isActive", "sortOrder");

CREATE TABLE "WebsitePricingConfig" (
  "id"             TEXT NOT NULL DEFAULT 'default',
  "baseRanges"     JSONB NOT NULL,
  "aiInstructions" TEXT,
  "aiModel"        TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  "updatedAt"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WebsitePricingConfig_pkey" PRIMARY KEY ("id")
);

-- Müraciətdə AI snapshot-u
ALTER TABLE "WebsiteServiceApplication"
  ADD COLUMN "estimatedPriceMin" DECIMAL(12, 2),
  ADD COLUMN "estimatedPriceMax" DECIMAL(12, 2),
  ADD COLUMN "selectedAddOns"    JSONB,
  ADD COLUMN "estimateBreakdown" JSONB;

-- Standart baza qiymət konfiqurasiyası (admin sonradan redaktə edər).
INSERT INTO "WebsitePricingConfig" ("id", "baseRanges", "aiInstructions", "updatedAt")
VALUES (
  'default',
  '{
    "LANDING":    { "minBase": 150, "maxBase": 300 },
    "PORTFOLIO":  { "minBase": 200, "maxBase": 400 },
    "BUSINESS":   { "minBase": 300, "maxBase": 700 },
    "RESTAURANT": { "minBase": 300, "maxBase": 700 },
    "ECOMMERCE":  { "minBase": 600, "maxBase": 1500 },
    "OTHER":      { "minBase": 250, "maxBase": 600 }
  }'::jsonb,
  'Müştərinin briefi mürəkkəbdirsə (məhsul sayı çoxdursa, fərdi inteqrasiya tələb olunursa) əmsalı artır. Sadə layihələrdə əmsalı 1.0-da saxla.',
  CURRENT_TIMESTAMP
);
