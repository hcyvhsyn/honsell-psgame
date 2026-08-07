-- Telegram ingest: oyun adı soruşan axım üçün söhbət vəziyyəti.
--
-- Düymə cavabları reelId-ni callback_data-da daşıyır, amma MƏTN cavabı (oyunun
-- adı) heç nə daşımır. Bot gələn mətni hansı qaralamaya aid edəcəyini bilməlidir,
-- ona görə gözləyən qaralama chat-a bağlanır.
--
-- Hər iki sütun nullable-dır: mövcud reels sətirlərinə heç bir təsir yoxdur.
ALTER TABLE "Reel"
  ADD COLUMN IF NOT EXISTS "tgChatId" TEXT,
  ADD COLUMN IF NOT EXISTS "tgStage"  TEXT;

-- Gələn mətn üçün "bu chat-da gözləyən qaralama" axtarışı hər mesajda işləyir.
CREATE INDEX IF NOT EXISTS "Reel_tgChatId_tgStage_idx" ON "Reel" ("tgChatId", "tgStage");
