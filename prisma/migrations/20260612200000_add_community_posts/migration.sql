-- Honsell İcması (community wall) tables.

CREATE TABLE IF NOT EXISTS "CommunityPost" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'GENERAL',
  "title" TEXT,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "moderatedAt" TIMESTAMP(3),
  "moderatedById" TEXT,
  "moderationNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CommunityPost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CommunityPost_status_createdAt_idx" ON "CommunityPost"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "CommunityPost_category_status_createdAt_idx" ON "CommunityPost"("category", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "CommunityPost_userId_idx" ON "CommunityPost"("userId");

CREATE TABLE IF NOT EXISTS "CommunityPostReaction" (
  "postId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "value" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CommunityPostReaction_pkey" PRIMARY KEY ("postId", "userId")
);

CREATE INDEX IF NOT EXISTS "CommunityPostReaction_postId_value_idx" ON "CommunityPostReaction"("postId", "value");

CREATE TABLE IF NOT EXISTS "CommunityPostComment" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "isHidden" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CommunityPostComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CommunityPostComment_postId_createdAt_idx" ON "CommunityPostComment"("postId", "createdAt");
CREATE INDEX IF NOT EXISTS "CommunityPostComment_userId_idx" ON "CommunityPostComment"("userId");

DO $$ BEGIN
  ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CommunityPostReaction" ADD CONSTRAINT "CommunityPostReaction_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CommunityPostReaction" ADD CONSTRAINT "CommunityPostReaction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CommunityPostComment" ADD CONSTRAINT "CommunityPostComment_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CommunityPostComment" ADD CONSTRAINT "CommunityPostComment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
