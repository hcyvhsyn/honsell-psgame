-- Game reviews + sosial qarşılıqlı təsir + affiliate komissiya faizi.

-- Settings: rəy affiliate komissiya faizi (default 5%).
ALTER TABLE "Settings" ADD COLUMN "reviewAffiliateRatePct" DOUBLE PRECISION NOT NULL DEFAULT 5;

-- GameReview: bir istifadəçi bir oyun üçün bir rəy.
CREATE TABLE "GameReview" (
  "id"             TEXT NOT NULL,
  "gameId"         TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "rating"         INTEGER NOT NULL,
  "body"           TEXT NOT NULL,
  "status"         TEXT NOT NULL DEFAULT 'PENDING',
  "moderatedAt"    TIMESTAMP(3),
  "moderatedById"  TEXT,
  "moderationNote" TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GameReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GameReview_userId_gameId_key" ON "GameReview"("userId", "gameId");
CREATE INDEX "GameReview_gameId_status_createdAt_idx" ON "GameReview"("gameId", "status", "createdAt");
CREATE INDEX "GameReview_userId_idx" ON "GameReview"("userId");
CREATE INDEX "GameReview_status_idx" ON "GameReview"("status");

ALTER TABLE "GameReview"
  ADD CONSTRAINT "GameReview_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameReview"
  ADD CONSTRAINT "GameReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ReviewReaction: like / dislike toggle.
CREATE TABLE "ReviewReaction" (
  "reviewId"  TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "value"     INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReviewReaction_pkey" PRIMARY KEY ("reviewId", "userId")
);

CREATE INDEX "ReviewReaction_reviewId_value_idx" ON "ReviewReaction"("reviewId", "value");

ALTER TABLE "ReviewReaction"
  ADD CONSTRAINT "ReviewReaction_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "GameReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewReaction"
  ADD CONSTRAINT "ReviewReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ReviewComment: rəyə yazılan yorumlar (flat).
CREATE TABLE "ReviewComment" (
  "id"        TEXT NOT NULL,
  "reviewId"  TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "body"      TEXT NOT NULL,
  "isHidden"  BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReviewComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReviewComment_reviewId_createdAt_idx" ON "ReviewComment"("reviewId", "createdAt");
CREATE INDEX "ReviewComment_userId_idx" ON "ReviewComment"("userId");

ALTER TABLE "ReviewComment"
  ADD CONSTRAINT "ReviewComment_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "GameReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewComment"
  ADD CONSTRAINT "ReviewComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
