# Sxem dəyişikliyi olan deploy — runbook

> **Niyə bu sənəd var:** `deploy.sh` migrasiya işlətmir. Docker build isə build
> zamanı statik səhifələri generasiya edir və bu zaman **prod DB-yə sorğu atır**.
> Nəticə: yeni sütun tələb edən kod deploy olunanda build `ColumnNotFound` ilə
> sınır — kodda səhv olmasa belə.
>
> 2026-07-28-də Faza 1 (SEO slug + metadata) deploy-u məhz buna görə sındı.
> Eyni tələ əvvəl də baş verib.
>
> **2026-08-03 — üçüncü təkrar.** Beş migrasiya tətbiq edilməmişdi
> (`20260802120000_loot_box` … `20260803120000_reel_edition_game_ids`), build
> `The column Reel.editionGameIds does not exist` ilə sındı. Eyni build-də
> `The table public.LootBox does not exist` xətaları da vardı, LAKİN onlar
> deploy-u sındırmadı: `/qutular` sorğunu `.catch(() => [])` ilə tutur.
> Fərq yalnız o idi ki, `/reels` tutmurdu.
>
> İki nəticə çıxdı:
> 1. `app/reels/page.tsx` artıq eyni qaydaya əməl edir — bir səhifənin sorğusu
>    bütün saytın yayımını bloklaya bilməz. **Yeni prerender olunan səhifə
>    DB-yə sorğu atırsa, `.catch` MƏCBURİDİR.**
> 2. Bu qoruma migrasiya ehtiyacını ARADAN QALDIRMIR — sadəcə deploy-un
>    sınmasını dayandırır. Migrasiya tətbiq olunmasa, funksiya canlıda boş
>    işləyir (cədvəl/sütun yoxdur). Aşağıdakı addımlar hələ də lazımdır.
>
> **2026-08-08 — dördüncü təkrar, və proqnoz doğru çıxdı.**
> `20260807160000_reel_category` tətbiq olunmamışdı, build
> `The column Reel.category does not exist` ilə sındı.
>
> Üstəlik yuxarıdakı 1-ci nəticə **reqressiyaya uğramışdı**: `app/reels/page.tsx`
> içindəki `.catch` bir yerdə (`getStreamingPlatformsByCategory`) qalmışdı, amma
> feed sorğularından itmişdi — ona görə səhifə zərif deqradasiya etmək əvəzinə
> yenə bütün deploy-u bloklаdı. `.catch` geri qaytarıldı, səbəbi izah edən şərh
> ilə birlikdə (yenidən silinməsin deyə).
>
> Əsas həll — migrasiyanın pipeline-a əlavəsi — **artıq edilib**, aşağıdakı
> "pipeline-a əlavə" bölməsinə bax.

## Qızıl qayda

**Migrasiya Docker build-dən ƏVVƏL tətbiq olunmalıdır.**

Bu, əlavə (additive) migrasiyalarda təhlükəsizdir: bütün yeni sütunlar NULLable
olduğu üçün köhnə kod onlardan xəbərsiz işləməyə davam edir. Yəni migrasiyanı
köhnə versiya canlı ikən tətbiq etmək downtime yaratmır.

Sütun **silən** və ya **tipini dəyişən** migrasiyada bu qayda işləmir — orada
iki mərhələli deploy lazımdır (əvvəl kod, sonra sxem).

---

## Addım-addım

### 1. Repo-nu serverdə yenilə

```bash
cd /root/honsell-psgame
git fetch origin main && git reset --hard origin/main
```

`.env`, `Dockerfile`, `deploy.sh` untracked olduğu üçün toxunulmur.

### 2. Gözləyən migrasiyaları gör

```bash
docker compose config --services      # servis adını təsdiqlə
```

```bash
docker compose run --rm \
  -v /root/honsell-psgame/prisma:/app/prisma \
  --entrypoint sh <servis-adı> -c "npx prisma migrate status"
```

> `prisma/` qovluğu mount olunur, çünki mövcud image köhnədir və yeni migrasiya
> faylını daxil etmir.

### 3. Tətbiq et

```bash
docker compose run --rm \
  -v /root/honsell-psgame/prisma:/app/prisma \
  --entrypoint sh <servis-adı> -c "npx prisma migrate deploy"
```

Servis adını əl ilə yazmamaq üçün:

```bash
SERVICE=$(docker compose config --services | grep -v '^db$' | head -1)
```

**Alternativ (host-dan) — DİQQƏT, iki tələ var:**

1. `prisma.config.ts` datasource-u belə seçir:
   `process.env["DIRECT_URL"] || process.env["DATABASE_URL"]`.
   Yəni **`DATABASE_URL` ötürmək kifayət etmir** — `.env`-dəki `DIRECT_URL`
   (`db:5432`) prioritet alır və `P1001: Can't reach database server` verir.
   Host-dan işlədəndə mütləq `DIRECT_URL` ötürün.
2. `POSTGRES_PASSWORD` shell-də təyin olunmur (yalnız `.env`-dədir), ona görə
   onu ayrıca oxumaq lazımdır.

```bash
cd /root/honsell-psgame
POSTGRES_PASSWORD=$(grep -m1 '^POSTGRES_PASSWORD=' .env | cut -d= -f2-)
DIRECT_URL="postgresql://postgres:${POSTGRES_PASSWORD}@127.0.0.1:5433/postgres" \
  npx prisma migrate deploy
```

Parolda `@`, `/`, `:` kimi simvol varsa bu yol URL-kodlaşdırma tələb edir —
belə halda compose variantına qayıdın.

> **Diqqət:** `docker compose exec <servis-adı> npx prisma migrate deploy`
> (mount olmadan) yalnız uğurlu build-dən SONRA işləyir — çünki işləyən
> konteynerdəki `prisma/` qovluğu köhnə image-dəndir və yeni migrasiya faylını
> daxil etmir. Build sınıbsa, yuxarıdakı iki üsuldan birini işlədin.

### 4. Sütunların həqiqətən yarandığını yoxla

Prisma "applied" desə də, birbaşa DB-dən təsdiqləmək 30 saniyə çəkir və
sınmış deploy-dan ucuzdur:

```bash
docker exec -it honsell-store-db psql -U postgres -c "
  SELECT column_name FROM information_schema.columns
  WHERE table_name='Game'
    AND column_name IN ('slug','descriptionAz','psRatingAvg','genres');"
```

### 5. Deploy-u işə sal

GitHub Actions → Deploy Honsell Store → **Re-run jobs**.

---

## Faza 1-dən sonra: data skriptləri

Migrasiya yalnız sütunları yaradır — onları doldurmaq ayrı addımdır.
**Ardıcıllıq vacibdir:** `enrich` mənbə mətni gətirir, `descriptions` onu
işlədir. Tərsinə işlətsəniz, generasiya ediləcək heç nə olmaz.

Skriptlər host-da deyil, konteynerdə işləməlidir (DATABASE_URL `db:5432`-ni
yalnız compose şəbəkəsindən görür):

```bash
cd /root/honsell-psgame

# 1) Slug-lar — əvvəlcə quru işləmə ilə nəticəyə bax
docker compose exec <servis-adı> npx tsx scripts/backfillGameSlugs.ts --dry-run
docker compose exec <servis-adı> npx tsx scripts/backfillGameSlugs.ts

# 2) PS Store metadata — hissə-hissə, dayandırıla bilər
docker compose exec <servis-adı> npx tsx scripts/enrichGameMetadata.ts --limit 200

# 3) Azərbaycanca təsvirlər — əvvəlcə 5 ədədlə keyfiyyətə bax
docker compose exec <servis-adı> npx tsx scripts/generateGameDescriptions.ts --limit 5 --dry-run
docker compose exec <servis-adı> npx tsx scripts/generateGameDescriptions.ts --limit 100
```

`enrichGameMetadata.ts` dayandırıla/davam etdirilə biləndir — `--limit` ilə
istənilən qədər hissəyə bölmək olar, hər işləmə qaldığı yerdən davam edir.

### Slug-lar yazıldıqdan sonra keşi təzələ

Facet və kataloq səhifələri `unstable_cache` işlədir. Skriptlər DB-yə yazır,
amma keşi bilmir:

```bash
docker compose restart <servis-adı>
```

---

## Yoxlama siyahısı (deploy-dan sonra)

```bash
# Köhnə productId URL-i slug-a 308 verirmi?
curl -sI https://honsell.store/oyunlar/<productId> | head -3

# Sitemap indeksi və shard-lar açılırmı?
curl -s https://honsell.store/sitemap.xml | head -20
curl -s https://honsell.store/sitemap-games/0.xml | head -10

# Facet səhifələri məhsul göstərirmi?
curl -s https://honsell.store/ps5-oyunlari | grep -c "oyunlar/"
```

Janr səhifələri (`/janr/*`) `enrichGameMetadata.ts` işləyənə qədər boş olacaq və
avtomatik `noindex` alacaq — bu gözləniləndir, erkən deploy zərər vermir.

---

## Təkrarlanmasın deyə: pipeline-a əlavə (EDİLİB — 2026-08-08)

Yuxarıdakı 3-cü addım artıq **avtomatikdir**. `deploy.sh` serverdə yaşadığı üçün
blok ora yox, versiyalanan [.github/workflows/deploy.yml](../.github/workflows/deploy.yml)
faylına, `./deploy.sh` çağırışından **əvvəl** qoyulub:

```bash
docker compose run --rm --no-deps -T \
  -v /root/honsell-psgame/prisma:/app/prisma \
  --entrypoint npx "$APP_SVC" prisma migrate deploy
```

Üç detal vacibdir:

- **`-v .../prisma:/app/prisma`** — image-dəki `prisma/` build vaxtı `COPY`
  olunub, yəni indicə `git reset --hard` ilə çəkilmiş YENİ migrasiyalar orada
  yoxdur. Mount olmasa addım "uğurlu" görünüb heç nə tətbiq etmir. Build sınandan
  sonra yeni image ümumiyyətlə olmur, ona görə `docker compose exec` də yaramır.
- **`script_stop: true`** (action səviyyəsində) — migrasiya sınıbsa 9 dəqiqəlik
  build-ə keçməyin mənası yoxdur; əks halda səbəbi gizlədən ikinci xəta alırsan.
- **`-T`** — SSH sessiyasında TTY yoxdur.

Servis adı `honsell-store-app`-dır; workflow onu tapmasa db/redis olmayan ilk
servisə keçir, heç nə tapmasa deploy-u dayandırır.

> `deploy.sh` və `Dockerfile` hələ də repo-da deyil, yalnız serverdə yaşayır.
> Onları repo-ya köçürmək qalan addımları da versiyalanan edərdi.
