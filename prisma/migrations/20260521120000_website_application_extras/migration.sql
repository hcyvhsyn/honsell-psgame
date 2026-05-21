-- Website müraciət formuna əlavə sahələr: əlaqə üsulu, dillər,
-- mövcud sayt, fayl linki, başlama tarixi.

ALTER TABLE "WebsiteServiceApplication"
  ADD COLUMN "email"              TEXT,
  ADD COLUMN "contactMethod"      TEXT,
  ADD COLUMN "existingWebsiteUrl" TEXT,
  ADD COLUMN "attachmentsUrl"     TEXT,
  ADD COLUMN "languages"          JSONB,
  ADD COLUMN "preferredStartDate" TIMESTAMP(3);
