-- WhatsApp rəy dəvətini real satışa bağlayan sütunlar: mövcud müştəri (userId),
-- seçilmiş abunəlik SKU-su (serviceProductId), satış snapshot-u (priceAznCents),
-- yaradılmış SERVICE_PURCHASE (transactionId — ikiqat sayı önləyir).

ALTER TABLE "WhatsappReviewInvite" ADD COLUMN "userId" TEXT;
ALTER TABLE "WhatsappReviewInvite" ADD COLUMN "serviceProductId" TEXT;
ALTER TABLE "WhatsappReviewInvite" ADD COLUMN "priceAznCents" INTEGER;
ALTER TABLE "WhatsappReviewInvite" ADD COLUMN "transactionId" TEXT;
