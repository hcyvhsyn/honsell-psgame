-- Admin tərəfindən bloklanan hesablar üçün sütunlar.
ALTER TABLE "User"
  ADD COLUMN "disabled" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "disabledAt" TIMESTAMP(3),
  ADD COLUMN "disabledReason" TEXT;
