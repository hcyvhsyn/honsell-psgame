-- CustomerTier.inviteBonusCents — hər müştəri seqmenti üçün sabit dəvət bonusu (qəpik).
-- Köhnə Settings.referralInviteBonusCents / sponsoredReferralInviteBonusCents dəyərləri
-- müvafiq seqmentlərə köçürülür. Additive miqrasiya.

ALTER TABLE "CustomerTier" ADD COLUMN "inviteBonusCents" INTEGER NOT NULL DEFAULT 30;

-- Backfill: default ("adi") seqment ← referralInviteBonusCents, "sponsorlu" ← sponsored*.
UPDATE "CustomerTier" t
SET "inviteBonusCents" = s."referralInviteBonusCents"
FROM "Settings" s
WHERE s."id" = 'global' AND t."isDefault" = true;

UPDATE "CustomerTier" t
SET "inviteBonusCents" = s."sponsoredReferralInviteBonusCents"
FROM "Settings" s
WHERE s."id" = 'global' AND t."slug" = 'sponsorlu';
