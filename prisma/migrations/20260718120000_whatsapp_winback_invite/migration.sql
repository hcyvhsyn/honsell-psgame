-- Admin tərəfindən yaradılan "niyə davam etmədin?" (win-back / churn) sorğusu.
-- Abunəliyi bitib davam etməyən müştərilər üçün. Link /niye/<token> səhifəsini
-- açır: hazır səbəb + sərbəst mətn toplanır. Yalnız rəy/geribildirim üçündür —
-- hesab, testimonial və ya satış yaratmır.

CREATE TABLE "WhatsappWinbackInvite" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "userId" TEXT,
    "serviceProductId" TEXT,
    "products" JSONB,
    "reason" TEXT,
    "reasonText" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "submittedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsappWinbackInvite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WhatsappWinbackInvite_token_key" ON "WhatsappWinbackInvite"("token");
CREATE INDEX "WhatsappWinbackInvite_phone_idx" ON "WhatsappWinbackInvite"("phone");
