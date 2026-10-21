-- HBO Max AZ proyeksiyası: ContentLanguage-ə əlavə (nullable) sütunlar + ProviderTitle.linkKind.
-- Mövcud sətirlərə toxunmur.
-- AlterTable
ALTER TABLE "ContentLanguage" ADD COLUMN     "coverage" TEXT,
ADD COLUMN     "episodesAvailable" INTEGER,
ADD COLUMN     "episodesTotal" INTEGER,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ProviderTitle" ADD COLUMN     "linkKind" TEXT;

