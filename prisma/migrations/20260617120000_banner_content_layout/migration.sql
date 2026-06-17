-- AlterTable: banner mətn blokunun yeri (9-nöqtəli ızgara) və mətn teması.
ALTER TABLE "Banner" ADD COLUMN "contentPosition" TEXT NOT NULL DEFAULT 'BOTTOM_LEFT';
ALTER TABLE "Banner" ADD COLUMN "contentTheme" TEXT NOT NULL DEFAULT 'LIGHT';
