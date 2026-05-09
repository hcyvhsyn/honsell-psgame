-- User: trusted streaming reviewer flag (admin-controlled).
ALTER TABLE "User"
    ADD COLUMN "streamingReviewTrusted" BOOLEAN NOT NULL DEFAULT false;

-- StreamingReview: customer-written reviews referencing TMDB by id+kind.
CREATE TABLE "StreamingReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectedReason" TEXT,
    "titleSnap" TEXT NOT NULL,
    "posterUrlSnap" TEXT,
    "backdropUrlSnap" TEXT,
    "yearSnap" INTEGER,
    "genresSnap" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreamingReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StreamingReview_userId_tmdbId_kind_key" ON "StreamingReview"("userId", "tmdbId", "kind");
CREATE INDEX "StreamingReview_status_createdAt_idx" ON "StreamingReview"("status", "createdAt");
CREATE INDEX "StreamingReview_tmdbId_kind_status_idx" ON "StreamingReview"("tmdbId", "kind", "status");
CREATE INDEX "StreamingReview_service_status_idx" ON "StreamingReview"("service", "status");

ALTER TABLE "StreamingReview"
    ADD CONSTRAINT "StreamingReview_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- StreamingReviewReaction: like/dislike per review per user.
CREATE TABLE "StreamingReviewReaction" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StreamingReviewReaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StreamingReviewReaction_reviewId_userId_key" ON "StreamingReviewReaction"("reviewId", "userId");
CREATE INDEX "StreamingReviewReaction_reviewId_idx" ON "StreamingReviewReaction"("reviewId");

ALTER TABLE "StreamingReviewReaction"
    ADD CONSTRAINT "StreamingReviewReaction_reviewId_fkey"
    FOREIGN KEY ("reviewId") REFERENCES "StreamingReview"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StreamingReviewReaction"
    ADD CONSTRAINT "StreamingReviewReaction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- StreamingTitleFavorite: TMDB-based favorites for streaming titles.
CREATE TABLE "StreamingTitleFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "titleSnap" TEXT NOT NULL,
    "posterUrlSnap" TEXT,
    "yearSnap" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StreamingTitleFavorite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StreamingTitleFavorite_userId_tmdbId_kind_key" ON "StreamingTitleFavorite"("userId", "tmdbId", "kind");
CREATE INDEX "StreamingTitleFavorite_userId_idx" ON "StreamingTitleFavorite"("userId");

ALTER TABLE "StreamingTitleFavorite"
    ADD CONSTRAINT "StreamingTitleFavorite_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
