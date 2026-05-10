-- AlterTable
ALTER TABLE "NewsArticle" ADD COLUMN "showOnHome" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "NewsArticle_showOnHome_isPublished_publishedAt_idx" ON "NewsArticle"("showOnHome", "isPublished", "publishedAt");
