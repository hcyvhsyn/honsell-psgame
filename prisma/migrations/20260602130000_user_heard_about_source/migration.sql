-- Qeydiyyatda "Bizi haradan eşitdiniz?" cavabı.
-- Dəyərlər: INSTAGRAM | TIKTOK | FRIEND | OTHER.
-- Köhnə hesablarda boş ola bildiyi üçün nullable. IF NOT EXISTS — idempotent.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "heardAboutSource" TEXT;
