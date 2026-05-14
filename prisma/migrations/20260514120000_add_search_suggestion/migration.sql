-- CreateTable
CREATE TABLE "SearchSuggestion" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "iconKey" TEXT NOT NULL DEFAULT 'SEARCH',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SearchSuggestion_isActive_sortOrder_idx" ON "SearchSuggestion"("isActive", "sortOrder");
