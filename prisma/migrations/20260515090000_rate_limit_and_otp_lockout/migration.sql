-- AlterTable: OTP brute-force lockout fields on User
ALTER TABLE "User" ADD COLUMN "otpAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "otpLockedUntil" TIMESTAMP(3);

-- CreateTable: RateLimitEvent (sliding-window auth abuse defence)
CREATE TABLE "RateLimitEvent" (
    "id"         TEXT NOT NULL,
    "key"        TEXT NOT NULL,
    "scope"      TEXT NOT NULL,
    "identifier" TEXT,
    "success"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RateLimitEvent_key_createdAt_idx"   ON "RateLimitEvent"("key", "createdAt");
CREATE INDEX "RateLimitEvent_scope_createdAt_idx" ON "RateLimitEvent"("scope", "createdAt");
