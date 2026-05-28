-- "Sponsorlu" müştəri funksiyası.
--   * User.isSponsored / sponsoredAt — admin tərəfindən təyin olunan sponsor statusu.
--   * Settings.sponsoredReferralGamesPct — sponsorlu müştərilərin dəvət etdiyi
--     istifadəçilərin oyun alışlarına tətbiq olunan artırılmış referal faizi (default 8%).

ALTER TABLE "User"
  ADD COLUMN "isSponsored" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sponsoredAt" TIMESTAMP(3);

ALTER TABLE "Settings"
  ADD COLUMN "sponsoredReferralGamesPct" DOUBLE PRECISION NOT NULL DEFAULT 8;
