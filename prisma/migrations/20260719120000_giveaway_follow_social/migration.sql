-- Çəkiliş: "Bizi izlə" (FOLLOW_SOCIAL) qoşulma şərti üçün sosial səhifə linki.
-- entryCondition = FOLLOW_SOCIAL olduqda conditionType platforma kodunu
-- ("INSTAGRAM" | "FACEBOOK" | ...), conditionUrl isə izlənəcək linki saxlayır.
ALTER TABLE "Giveaway" ADD COLUMN IF NOT EXISTS "conditionUrl" TEXT;
