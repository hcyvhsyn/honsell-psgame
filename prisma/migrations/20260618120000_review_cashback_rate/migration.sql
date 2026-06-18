-- AlterTable: aldığı məhsula rəy yazan müştəriyə verilən cashback faizi (default 1%).
ALTER TABLE "Settings" ADD COLUMN "reviewCashbackRatePct" DOUBLE PRECISION NOT NULL DEFAULT 1;
