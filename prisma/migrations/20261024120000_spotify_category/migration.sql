-- Spotify Premium kateqoriyası (lib/categoryAssets.ts → SPOTIFY). Admin /admin/categories-ə
-- girməsə də header-də görünsün deyə sətir burada yaradılır. Mövcuddursa toxunulmur.
INSERT INTO "CategoryAsset" ("id", "key", "label", "description", "href", "isActive", "sortOrder", "createdAt", "updatedAt")
VALUES (
  'cat_spotify_premium',
  'SPOTIFY',
  'Spotify Premium',
  'Şəxsi hesabınıza Premium — reklamsız musiqi',
  '/music/spotify-premium',
  true,
  18,
  NOW(),
  NOW()
)
ON CONFLICT ("key") DO NOTHING;
