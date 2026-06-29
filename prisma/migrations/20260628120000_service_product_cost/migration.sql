-- ServiceProduct.costAznCents — məhsulun maya dəyəri (AZN qəpiklə).
-- Yalnız admin panelində referal qazanc proqnozu üçün istifadə olunur.
-- Komissiya ödənişinə təsir etmir (komissiya qiymət × faiz olaraq qalır).
-- Additive miqrasiya — mövcud sütunlar dəyişmir.

ALTER TABLE "ServiceProduct" ADD COLUMN "costAznCents" INTEGER NOT NULL DEFAULT 0;
