-- Streaming xidmət qrupları: hər xidmətə (HBO Max və s.) admin-dən "Şəxsi hesab" (PERSONAL)
-- və "Paylaşımlı hesab" (SHARED) planları qurulur (lib/streamingAccess.ts).
-- Hamısı nullable/defaultlu: deploy anında vitrin və satış əhatəsi dəyişmir.
ALTER TABLE "StreamingPlatform" ADD COLUMN IF NOT EXISTS "parentCode" TEXT;
ALTER TABLE "StreamingPlatform" ADD COLUMN IF NOT EXISTS "accessMode" TEXT;
ALTER TABLE "StreamingPlatform" ADD COLUMN IF NOT EXISTS "tierName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "StreamingPlatform" ADD COLUMN IF NOT EXISTS "features" JSONB;
ALTER TABLE "StreamingPlatform" ADD COLUMN IF NOT EXISTS "devices" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "StreamingPlatform" ADD COLUMN IF NOT EXISTS "vpnRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StreamingPlatform" ADD COLUMN IF NOT EXISTS "storeSellable" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "StreamingPlatform_parentCode_idx" ON "StreamingPlatform"("parentCode");

-- Netflix quruluşu kodda da var (lib/streamingGroups.ts, lib/crmNetflix.ts) — admin eyni
-- quruluşu görsün deyə DB-yə də yazılır. Netflix-in satış əhatəsi koda görədir, bayraq yalnız göstəricidir.
UPDATE "StreamingPlatform" SET "parentCode" = 'NETFLIX', "accessMode" = 'PERSONAL', "tierName" = 'Hesab'
  WHERE "code" = 'NETFLIX_VVIP' AND "parentCode" IS NULL;
UPDATE "StreamingPlatform" SET "parentCode" = 'NETFLIX', "accessMode" = 'SHARED', "tierName" = 'Yanımda'
  WHERE "code" = 'NETFLIX_YANIMDA' AND "parentCode" IS NULL;
UPDATE "StreamingPlatform" SET "parentCode" = 'NETFLIX', "accessMode" = 'SHARED', "tierName" = 'Evimdə'
  WHERE "code" = 'NETFLIX_EVIMD' AND "parentCode" IS NULL;
UPDATE "StreamingPlatform" SET "parentCode" = 'NETFLIX', "accessMode" = 'SHARED', "tierName" = 'Evimdə VIP'
  WHERE "code" = 'NETFLIX_EVIMD_VIP' AND "parentCode" IS NULL;
UPDATE "StreamingPlatform" SET "storeSellable" = true WHERE "code" = 'NETFLIX';
