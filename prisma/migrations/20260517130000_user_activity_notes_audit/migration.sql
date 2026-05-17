-- Login activity izləmə sütunları
ALTER TABLE "User"
  ADD COLUMN "lastLoginAt"   TIMESTAMP(3),
  ADD COLUMN "lastLoginIp"   TEXT,
  ADD COLUMN "lastUserAgent" TEXT,
  ADD COLUMN "loginCount"    INTEGER NOT NULL DEFAULT 0;

-- Admin daxili qeydləri (müştəri özü görmür).
CREATE TABLE "AdminNote" (
  "id"           TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "authorId"     TEXT,
  "body"         TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AdminNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminNote_targetUserId_createdAt_idx"
  ON "AdminNote" ("targetUserId", "createdAt");

ALTER TABLE "AdminNote"
  ADD CONSTRAINT "AdminNote_targetUserId_fkey"
    FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AdminNote_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- İstifadəçi üzərində aparılan admin əməliyyatlarının audit jurnalı.
CREATE TABLE "AdminAuditLog" (
  "id"           TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "actorId"      TEXT,
  "action"       TEXT NOT NULL,
  "details"      TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminAuditLog_targetUserId_createdAt_idx"
  ON "AdminAuditLog" ("targetUserId", "createdAt");
CREATE INDEX "AdminAuditLog_actorId_createdAt_idx"
  ON "AdminAuditLog" ("actorId", "createdAt");
CREATE INDEX "AdminAuditLog_action_createdAt_idx"
  ON "AdminAuditLog" ("action", "createdAt");

ALTER TABLE "AdminAuditLog"
  ADD CONSTRAINT "AdminAuditLog_targetUserId_fkey"
    FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AdminAuditLog_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
