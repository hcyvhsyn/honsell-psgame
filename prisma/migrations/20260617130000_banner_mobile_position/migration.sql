-- AlterTable: banner mətn blokunun mobil mövqeyi (desktop-dan ayrı).
ALTER TABLE "Banner" ADD COLUMN "contentPositionMobile" TEXT NOT NULL DEFAULT 'BOTTOM_LEFT';
