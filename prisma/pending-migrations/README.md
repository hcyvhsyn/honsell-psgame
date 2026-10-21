# Gözləyən miqrasiyalar (deploy-a DÜŞMƏYƏNLƏR)

`.github/workflows/deploy.yml` hər `main` push-unda `prisma migrate deploy` işlədir və
`prisma/migrations/` qovluğundakı **hər yeni miqrasiyanı avtomatik prod-a tətbiq edir**.
Buradakı qovluqlar o yoldan kənardadır — təsdiqə qədər prod-a gedə bilməz.

## 20261021120000_hbomax_provider_catalog

HBO Max kollektoru (Phase 2): 7 yeni cədvəl, mövcud cədvəllərə toxunmur (yalnız
`ProviderTitle.streamingTitleId → StreamingTitle` nullable FK).

Hazırda yalnız lokal dev DB-də tətbiq olunub (`honsell_hbomax_dev`, docker
`honsell-hbomax-dev`, :55433).

Prod/staging-ə köçürmədən əvvəl (hamısı tamamlanmalıdır):
1. A–Z coverage spike nəticəsi qəbul edilib;
2. ayrıca HBO profili yoxlaması işləyir;
3. dry-run kəşf → məhdud real sync lokal DB-yə → title/season/episode/GLOBAL track/növbə
   əl ilə yoxlanıb;
4. bir neçə real AZ validasiyası + FULL/PARTIAL/NONE/UNVERIFIED aqreqasiyası yoxlanıb;
5. mümkünsə əvvəl ayrıca staging DB.

Köçürmə (açıq qərar, bir commit):
```
git mv prisma/pending-migrations/20261021120000_hbomax_provider_catalog prisma/migrations/
```
Sonrakı `main` deploy-u onu tətbiq edəcək. Əl ilə tətbiq etmək lazımdırsa: `npm run db:deploy`
— hədəf DB-ni (`DIRECT_URL`/`DATABASE_URL`) əvvəlcə yoxla.
