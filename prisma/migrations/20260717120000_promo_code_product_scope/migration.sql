-- Kupon scope-unu məhsul səviyyəsinə endirir: konkret oyun (Game.id) və ya
-- konkret servis/platforma məhsulu (ServiceProduct.id) üzrə hədəfləmə.
-- Mövcud kuponlar üçün hər iki sahə boş qalır → davranış dəyişmir.
ALTER TABLE "PromoCode"
  ADD COLUMN "gameIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "serviceProductIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
