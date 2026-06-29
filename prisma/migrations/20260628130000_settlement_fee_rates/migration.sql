-- Hər satışdan tutulan ödəniş/vergi kəsintiləri (%) — Settings.
-- Yalnız admin qazanc proqnozu üçün; komissiya ödənişinə təsir etmir.
--   epointFeePct  → qiymətin %-i (ödəniş sistemi)
--   taxPct        → (qiymət − epoint) üzərindən vergi %
--   cashoutFeePct → (qiymət − epoint) üzərindən nağdlaşdırma %
-- Additive miqrasiya — mövcud sütunlar dəyişmir.

ALTER TABLE "Settings" ADD COLUMN "epointFeePct" DOUBLE PRECISION NOT NULL DEFAULT 3;
ALTER TABLE "Settings" ADD COLUMN "taxPct" DOUBLE PRECISION NOT NULL DEFAULT 2;
ALTER TABLE "Settings" ADD COLUMN "cashoutFeePct" DOUBLE PRECISION NOT NULL DEFAULT 1.5;
