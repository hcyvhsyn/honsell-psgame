-- CRM (crm.honsell.store) bank ödənişindən göndərilən rəy dəvətləri üçün
-- idempotentlik açarı. Nullable + unique: köhnə sətirlər toxunulmur, yeni
-- xarici dəvətlər isə "crm:cardTransaction:<id>" ilə təkrarlanmır.
ALTER TABLE "WhatsappReviewInvite" ADD COLUMN "externalRef" TEXT;

CREATE UNIQUE INDEX "WhatsappReviewInvite_externalRef_key"
  ON "WhatsappReviewInvite"("externalRef");
