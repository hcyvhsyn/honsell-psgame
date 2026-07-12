-- Student Partner referal seqmenti — tələbələr üçün ayrıca MANUAL CustomerTier.
-- Tələbə statusu (StudentProfile) təsdiqlənmiş istifadəçi admin tərəfindən bu
-- tier-ə keçirilə bilər; faizləri mövcud /admin/referrals editorundan təyin olunur.
-- Rates yoxdursa resolver default seqmentin faizlərinə düşür (zərərsiz).
-- Additive + idempotent.

INSERT INTO "CustomerTier"
  ("id", "name", "displayName", "slug", "kind", "minSpendCents", "icon",
   "isDefault", "sortOrder", "inviteBonusCents", "cashbackPct", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  'Student',
  'Honsell Student Partner',
  'student',
  'MANUAL',
  0,
  NULL,
  false,
  COALESCE((SELECT MAX("sortOrder") FROM "CustomerTier"), 0) + 1,
  COALESCE((SELECT "inviteBonusCents" FROM "CustomerTier" WHERE "slug" = 'adi'), 30),
  COALESCE((SELECT "cashbackPct" FROM "CustomerTier" WHERE "slug" = 'adi'), 1),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM "CustomerTier" WHERE "slug" = 'student');
