-- Xərc əsaslı loyallıq tier-ləri (Bronze..Diamond) + manual xüsusi statuslar.
--   kind          AUTO (xərcə görə) | MANUAL (admin təyin edir, avtomatikı əvəz edir)
--   minSpendCents AUTO tier üçün minimal ömürlük xərc həddi (qəpik)
--   displayName   tam görünən ad ("Honsell Bronze")
--   icon          public/-dakı SVG açarı
-- Mövcud "adi" → Bronze (default AUTO), "sponsorlu" → MANUAL. Additive.

ALTER TABLE "CustomerTier" ADD COLUMN "displayName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CustomerTier" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "CustomerTier" ADD COLUMN "minSpendCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CustomerTier" ADD COLUMN "icon" TEXT;
ALTER TABLE "CustomerTier" ADD COLUMN "cashbackPct" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- "adi" (default) → Bronze (AUTO, 0 xərc). Slug stabil qalır (kod ona create-fallback
-- kimi baxır; lookup isDefault ilədir).
UPDATE "CustomerTier"
SET "name" = 'Bronze', "displayName" = 'Honsell Bronze', "kind" = 'AUTO',
    "minSpendCents" = 0, "icon" = 'bronze', "sortOrder" = 0, "isDefault" = true,
    "cashbackPct" = 1
WHERE "slug" = 'adi';

-- "sponsorlu" → MANUAL xüsusi status (cashback neytral 1% — admin dəyişə bilər).
UPDATE "CustomerTier"
SET "kind" = 'MANUAL', "displayName" = COALESCE(NULLIF("displayName", ''), 'Honsell Sponsorlu'),
    "icon" = COALESCE("icon", 'sponsorlu'), "cashbackPct" = 1
WHERE "slug" = 'sponsorlu';

-- Yeni AUTO tier-ləri (Silver, Gold, Platinum, Diamond). inviteBonusCents Bronze ilə eyni.
INSERT INTO "CustomerTier"
  ("id", "name", "displayName", "slug", "kind", "minSpendCents", "icon", "isDefault", "sortOrder", "inviteBonusCents", "cashbackPct", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, t.name, t.display, t.slug, 'AUTO', t.minc, t.icon, false, t.sort,
       COALESCE((SELECT "inviteBonusCents" FROM "CustomerTier" WHERE "slug" = 'adi'), 30),
       t.cashback, NOW(), NOW()
FROM (VALUES
  ('Silver',   'Honsell Silver',   'silver',   10100, 'silver',   1, 2.0),
  ('Gold',     'Honsell Gold',     'gold',     20100, 'gold',     2, 3.0),
  ('Platinum', 'Honsell Platinum', 'platinum', 30100, 'platinum', 3, 4.0),
  ('Diamond',  'Honsell Diamond',  'diamond',  50100, 'diamond',  4, 5.0)
) AS t(name, display, slug, minc, icon, sort, cashback)
WHERE NOT EXISTS (SELECT 1 FROM "CustomerTier" c WHERE c."slug" = t.slug);

-- AUTO tier-ə bağlı istifadəçilərin tierId-i NULL olur (onlar artıq xərcə görə
-- hesablanır). MANUAL (sponsorlu) istifadəçilər toxunulmur.
UPDATE "User"
SET "tierId" = NULL
WHERE "tierId" IN (SELECT id FROM "CustomerTier" WHERE "kind" = 'AUTO');
