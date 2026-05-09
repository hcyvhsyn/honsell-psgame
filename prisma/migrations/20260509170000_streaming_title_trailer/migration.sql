-- StreamingTitle.trailerUrl: YouTube trailer URL, autofetched from TMDB.
ALTER TABLE "StreamingTitle"
    ADD COLUMN "trailerUrl" TEXT;
