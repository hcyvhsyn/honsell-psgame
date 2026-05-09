-- Banner.scope: per-page scoping (HOME default; PLAYSTATION, future scopes).
-- Existing rows backfill to "HOME" via the default value.
ALTER TABLE "Banner"
    ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'HOME';

CREATE INDEX "Banner_scope_isActive_sortOrder_idx"
    ON "Banner"("scope", "isActive", "sortOrder");
