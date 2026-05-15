-- Hər PURCHASE tranzaksiyasında mağazanın maya dəyəri snapshot-u saxlanılır.
-- Gələcəkdə tryToAznRate dəyişəndə dashboard-da köhnə sifarişlərin mənfəəti
-- yanlış hesablanmayacaq. 0 = naməlum (köhnə sətirlər və ya scrape-də qiymət
-- olmayan oyunlar).

ALTER TABLE "Transaction" ADD COLUMN "costAznCents" INTEGER NOT NULL DEFAULT 0;
