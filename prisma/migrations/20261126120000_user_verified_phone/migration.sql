-- WhatsApp ilə sübut olunmuş nömrə — profildə CRM abunəlikləri bu nömrə ilə göstərilir.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verifiedPhone" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneVerifiedAt" TIMESTAMP(3);
