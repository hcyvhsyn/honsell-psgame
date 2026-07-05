-- Admin tərəfindən yaradılan WhatsApp rəy dəvəti (abunəliyini WhatsApp-dan alan
-- müştərilər üçün). Link wizard-i açır: ad/email/rəy toplanır, WhatsApp OTP ilə
-- təsdiqlənir, ardınca testimonial dərc olunur və şifrəsiz hesab yaradılır.

CREATE TABLE "WhatsappReviewInvite" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "platformCode" TEXT,
    "productTitle" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'STREAMING',
    "months" INTEGER,
    "name" TEXT,
    "email" TEXT,
    "reviewText" TEXT,
    "rating" INTEGER,
    "otpCode" TEXT,
    "otpExpiresAt" TIMESTAMP(3),
    "otpAttempts" INTEGER NOT NULL DEFAULT 0,
    "otpLockedUntil" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "usedAt" TIMESTAMP(3),
    "createdUserId" TEXT,
    "testimonialId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsappReviewInvite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WhatsappReviewInvite_token_key" ON "WhatsappReviewInvite"("token");
CREATE INDEX "WhatsappReviewInvite_phone_idx" ON "WhatsappReviewInvite"("phone");
