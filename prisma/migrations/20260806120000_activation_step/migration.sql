-- Aktivləşdirmə addımları (public «necə aktivləşdirilir?» timeline-ı).
--
-- PlatformGuide artıq var, amma o TƏK mətn blokudur: sıra nömrəsi yoxdur və
-- şəkil sütunu yoxdur. Hədiyyə kartı səhifəsində lazım olan şey ardıcıl
-- addımlar + hər addımın ekran görüntüsüdür, ona görə ayrı cədvəl.
--
-- `imageUrl` nullable: admin əvvəlcə mətni yazıb sonra şəkli yükləyə bilər,
-- şəkilsiz addım da tam keçərlidir (məs. «İşlem tamamlandı»).

-- CreateTable
CREATE TABLE IF NOT EXISTS "ActivationStep" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivationStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActivationStep_scope_isActive_sortOrder_idx"
  ON "ActivationStep"("scope", "isActive", "sortOrder");
