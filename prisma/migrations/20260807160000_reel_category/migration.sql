-- Reels: oyun və film/serial məzmununun ayrılması.
--
-- Qarışıq feed hər iki auditoriyanı itirirdi: oyun alan müştəriyə serial trailer-i,
-- serial izləyicisinə oyun qiyməti maraqlı deyil. İstifadəçi ilk girişdə birini
-- seçir, seçim cihazda (localStorage) saxlanılır.

ALTER TABLE "Reel"
  ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'STREAMING';

-- BACKFILL MƏCBURİDİR. Bu olmasa bütün mövcud OYUN reels-ləri film feed-ində
-- qalar və oyun feed-i boş görünər.
--
-- Meyar: köhnə Telegram axını yalnız film/serial üçün idi (platforma düymələri
-- göndərirdi), oyun reels-ləri isə yalnız GAME CTA-sı ilə yaradılırdı.
UPDATE "Reel" SET "category" = 'GAME' WHERE "ctaType" = 'GAME';

-- Feed sorğusu artıq category-yə görə süzülür; mövcud
-- (isPublished, sortOrder, createdAt) indeksi ona xidmət etmir.
CREATE INDEX IF NOT EXISTS "Reel_isPublished_category_sortOrder_createdAt_idx"
  ON "Reel" ("isPublished", "category", "sortOrder", "createdAt");
