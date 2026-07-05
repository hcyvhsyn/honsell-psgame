-- Testimonial-a admin cavabı: mətn + istəyə bağlı şəkil + tarix.
-- Anasayfa rəy kartında xüsusi dizaynla göstərilir.

ALTER TABLE "Testimonial" ADD COLUMN "adminReply" TEXT;
ALTER TABLE "Testimonial" ADD COLUMN "adminReplyImageUrl" TEXT;
ALTER TABLE "Testimonial" ADD COLUMN "adminReplyAt" TIMESTAMP(3);
