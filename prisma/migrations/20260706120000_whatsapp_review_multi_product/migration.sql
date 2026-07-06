-- Müştəri eyni anda birdən çox xidmət ala bilər: seçilmiş bütün məhsulları
-- `products` JSON-da saxla; hər biri ayrı SERVICE_PURCHASE yaradır.
-- `salesRecorded` ikiqat sayı önləyir (çoxlu məhsul üçün transactionId kifayət etmir).

ALTER TABLE "WhatsappReviewInvite" ADD COLUMN "products" JSONB;
ALTER TABLE "WhatsappReviewInvite" ADD COLUMN "salesRecorded" BOOLEAN NOT NULL DEFAULT false;

-- Mövcud (tək məhsullu) dəvətlər üçün: artıq transactionId dolu olanları qeyd olunmuş say.
UPDATE "WhatsappReviewInvite" SET "salesRecorded" = true WHERE "transactionId" IS NOT NULL;
