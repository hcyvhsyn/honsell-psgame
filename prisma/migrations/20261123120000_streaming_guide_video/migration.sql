-- Planlar arasındakı fərqi izah edən YouTube videosu (ana səhifə vitrini modalı).
ALTER TABLE "StreamingPlatform" ADD COLUMN IF NOT EXISTS "guideVideoUrl" TEXT;
