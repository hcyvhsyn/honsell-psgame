-- AlterTable: kampaniya növü (PROMO endirim reklamı | REVIEW_INVITE rəy dəvəti).
ALTER TABLE "Campaign" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'PROMO';
