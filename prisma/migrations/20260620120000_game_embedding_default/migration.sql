-- AlterColumn: `embedding` NOT NULL idi, amma DB-default yox idi. Scraper
-- (PS + Epic) `create`-də embedding ötürmür, ona görə hər `INSERT ... ON
-- CONFLICT` not-null pozuntusu ilə uğursuz olurdu və heç bir oyun yaddaşa
-- yazılmırdı. `genres` ilə eyni boş-massiv default-u veririk.
ALTER TABLE "Game" ALTER COLUMN "embedding" SET DEFAULT ARRAY[]::double precision[];
