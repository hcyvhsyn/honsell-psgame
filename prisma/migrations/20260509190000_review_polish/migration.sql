-- User: avatar URL for review cards & profile.
ALTER TABLE "User"
    ADD COLUMN "avatarUrl" TEXT;

-- StreamingReview: watch language (tr/ru/en/original) + spoiler flag.
ALTER TABLE "StreamingReview"
    ADD COLUMN "watchLanguage" TEXT,
    ADD COLUMN "spoiler" BOOLEAN NOT NULL DEFAULT false;
