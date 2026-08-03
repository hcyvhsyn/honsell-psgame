-- Reels: bir oyunun BÜTÜN sürümlərini feed-də göstərmək.
--
-- Sürümlər ayrı-ayrı "Game" sətirləridir və DB-də onları bir-birinə bağlayan
-- əlaqə yoxdur (detal səhifəsi yalnız kobud "franchise seed" evristikasından
-- istifadə edir — o, "God of" kimi bütün seriyanı tutur, konkret oyunun
-- sürümlərini yox). Ona görə yekun siyahı admin tərəfindən təsdiqlənib burada
-- saxlanılır: avto təklif lib/gameEditions.ts-dədir, səhv qruplaşma müştəriyə
-- çatmır.
--
-- Skalyar siyahı sütunu DEFAULT olmadan NOT NULL olur və mövcud sətirlərin
-- upsert-ləri səssizcə sınır — ona görə boş massiv defaultu məcburidir.
-- Əlavə etmə additivdir: mövcud reels-lərin davranışı dəyişmir.
ALTER TABLE "Reel"
  ADD COLUMN IF NOT EXISTS "editionGameIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
