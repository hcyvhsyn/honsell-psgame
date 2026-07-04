-- Reels: şaquli video feed (TikTok/Instagram tərzi).
--   Reel          — video + poster + platforma nişanı + çevik CTA + izlənmə sayı
--   ReelReaction  — like/dislike (ReviewReaction eyni şablon, toggle +1/-1)
--   ReelComment   — şərhlər (dərhal görünür, admin isHidden ilə gizlədir)

CREATE TABLE "Reel" (
  "id"              TEXT NOT NULL,
  "title"           TEXT NOT NULL,
  "caption"         TEXT,
  "videoUrl"        TEXT NOT NULL,
  "posterUrl"       TEXT NOT NULL,
  "width"           INTEGER NOT NULL DEFAULT 720,
  "height"          INTEGER NOT NULL DEFAULT 1280,
  "durationMs"      INTEGER NOT NULL DEFAULT 0,
  "platformCode"    TEXT,
  "platformLabel"   TEXT,
  "platformLogoUrl" TEXT,
  "ctaType"         TEXT NOT NULL DEFAULT 'URL',
  "ctaTargetId"     TEXT,
  "ctaHref"         TEXT,
  "ctaLabel"        TEXT DEFAULT 'Hesab al',
  "viewCount"       INTEGER NOT NULL DEFAULT 0,
  "isPublished"     BOOLEAN NOT NULL DEFAULT true,
  "sortOrder"       INTEGER NOT NULL DEFAULT 0,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Reel_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Reel_isPublished_sortOrder_createdAt_idx"
  ON "Reel" ("isPublished", "sortOrder", "createdAt");

CREATE TABLE "ReelReaction" (
  "reelId"    TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "value"     INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReelReaction_pkey" PRIMARY KEY ("reelId", "userId")
);

CREATE INDEX "ReelReaction_reelId_value_idx" ON "ReelReaction" ("reelId", "value");

CREATE TABLE "ReelComment" (
  "id"        TEXT NOT NULL,
  "reelId"    TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "body"      TEXT NOT NULL,
  "isHidden"  BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReelComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReelComment_reelId_isHidden_createdAt_idx"
  ON "ReelComment" ("reelId", "isHidden", "createdAt");
CREATE INDEX "ReelComment_userId_idx" ON "ReelComment" ("userId");

ALTER TABLE "ReelReaction"
  ADD CONSTRAINT "ReelReaction_reelId_fkey" FOREIGN KEY ("reelId")
  REFERENCES "Reel" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReelReaction"
  ADD CONSTRAINT "ReelReaction_userId_fkey" FOREIGN KEY ("userId")
  REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReelComment"
  ADD CONSTRAINT "ReelComment_reelId_fkey" FOREIGN KEY ("reelId")
  REFERENCES "Reel" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReelComment"
  ADD CONSTRAINT "ReelComment_userId_fkey" FOREIGN KEY ("userId")
  REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
