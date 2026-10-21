-- HBO Max provayder kataloqu (Phase 2): yalnız YENİ cədvəllər, mövcud cədvəllərə toxunmur.
-- GLOBAL (CMS) və REGION (AZ player) treklər EpisodeTrack.scope ilə ayrılır.
-- CreateTable
CREATE TABLE "ProviderTitle" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "originalTitle" TEXT,
    "description" TEXT,
    "year" INTEGER,
    "genres" JSONB,
    "posterUrl" TEXT,
    "backdropUrl" TEXT,
    "providerUrl" TEXT NOT NULL,
    "streamingTitleId" TEXT,
    "lastMetadataSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderTitle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderTitleRegion" (
    "id" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isCurrentlyAvailable" BOOLEAN NOT NULL DEFAULT true,
    "consecutiveMissingSyncs" INTEGER NOT NULL DEFAULT 0,
    "missingSince" TIMESTAMP(3),

    CONSTRAINT "ProviderTitleRegion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderSeason" (
    "id" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "expectedEpisodes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderSeason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderEpisode" (
    "id" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "name" TEXT,
    "providerUrl" TEXT NOT NULL,
    "metadataEditId" TEXT,
    "globalTracksHash" TEXT,
    "lastMetadataSyncAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isCurrentlyListed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderEpisode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EpisodeRegionState" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 4,
    "validatedEditId" TEXT,
    "validatedGlobalHash" TEXT,
    "lastRegionValidationAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "validationError" TEXT,
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EpisodeRegionState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EpisodeTrack" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "region" TEXT,
    "regionStateId" TEXT,
    "kind" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "code" TEXT,
    "locale" TEXT,
    "name" TEXT NOT NULL,
    "rawLabel" TEXT NOT NULL,
    "forced" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EpisodeTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderTitleLanguage" (
    "id" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "trackGroup" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT '',
    "displayName" TEXT NOT NULL,
    "episodesAvailable" INTEGER NOT NULL,
    "episodesVerified" INTEGER NOT NULL,
    "episodesTotal" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderTitleLanguage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProviderTitle_streamingTitleId_idx" ON "ProviderTitle"("streamingTitleId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderTitle_platform_providerId_key" ON "ProviderTitle"("platform", "providerId");

-- CreateIndex
CREATE INDEX "ProviderTitleRegion_region_isCurrentlyAvailable_idx" ON "ProviderTitleRegion"("region", "isCurrentlyAvailable");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderTitleRegion_titleId_region_key" ON "ProviderTitleRegion"("titleId", "region");

-- CreateIndex
CREATE INDEX "ProviderSeason_titleId_seasonNumber_idx" ON "ProviderSeason"("titleId", "seasonNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderSeason_titleId_providerId_key" ON "ProviderSeason"("titleId", "providerId");

-- CreateIndex
CREATE INDEX "ProviderEpisode_seasonId_episodeNumber_idx" ON "ProviderEpisode"("seasonId", "episodeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderEpisode_titleId_providerId_key" ON "ProviderEpisode"("titleId", "providerId");

-- CreateIndex
CREATE INDEX "EpisodeRegionState_region_status_priority_nextAttemptAt_idx" ON "EpisodeRegionState"("region", "status", "priority", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "EpisodeRegionState_episodeId_region_key" ON "EpisodeRegionState"("episodeId", "region");

-- CreateIndex
CREATE INDEX "EpisodeTrack_episodeId_scope_region_idx" ON "EpisodeTrack"("episodeId", "scope", "region");

-- CreateIndex
CREATE INDEX "EpisodeTrack_regionStateId_idx" ON "EpisodeTrack"("regionStateId");

-- CreateIndex
CREATE INDEX "EpisodeTrack_region_kind_code_idx" ON "EpisodeTrack"("region", "kind", "code");

-- CreateIndex
CREATE INDEX "ProviderTitleLanguage_region_kind_code_status_idx" ON "ProviderTitleLanguage"("region", "kind", "code", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderTitleLanguage_titleId_region_kind_trackGroup_code_l_key" ON "ProviderTitleLanguage"("titleId", "region", "kind", "trackGroup", "code", "locale");

-- AddForeignKey
ALTER TABLE "ProviderTitle" ADD CONSTRAINT "ProviderTitle_streamingTitleId_fkey" FOREIGN KEY ("streamingTitleId") REFERENCES "StreamingTitle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderTitleRegion" ADD CONSTRAINT "ProviderTitleRegion_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "ProviderTitle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSeason" ADD CONSTRAINT "ProviderSeason_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "ProviderTitle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderEpisode" ADD CONSTRAINT "ProviderEpisode_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "ProviderTitle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderEpisode" ADD CONSTRAINT "ProviderEpisode_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "ProviderSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodeRegionState" ADD CONSTRAINT "EpisodeRegionState_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "ProviderEpisode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodeTrack" ADD CONSTRAINT "EpisodeTrack_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "ProviderEpisode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodeTrack" ADD CONSTRAINT "EpisodeTrack_regionStateId_fkey" FOREIGN KEY ("regionStateId") REFERENCES "EpisodeRegionState"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderTitleLanguage" ADD CONSTRAINT "ProviderTitleLanguage_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "ProviderTitle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

