# Analitika və axtarış sistemi təsdiqi — quraşdırma

> **Niyə bu sənəd var:** 2026-07-28-ə qədər saytda `@vercel/analytics` və
> `@vercel/speed-insights` quraşdırılmışdı, amma layihə **öz serverində**
> `next start` ilə işləyir, Vercel-də deyil. Bu paketlər `/_vercel/insights/*`
> ünvanına beacon göndərir və həmin endpoint-i yalnız Vercel-in edge
> infrastrukturu cavablandırır — yəni **heç bir ziyarət qeyd olunmurdu**,
> üstəlik hər istifadəçiyə lazımsız JS yüklənirdi. Paketlər silindi, yerinə
> provayderdən asılı olmayan [`components/SiteAnalytics.tsx`](../components/SiteAnalytics.tsx)
> gəldi.

---

## 1. Umami quraşdırılması (tövsiyə olunur)

Umami self-host, cookie-siz və GDPR-uyğundur; ən əsası **mövcud Postgres
konteynerinizi** işlədə bilir, ayrıca verilənlər bazası tələb etmir.

### 1.1 Bazanı yaradın

Serverdə, mövcud `db` konteynerində:

```bash
docker exec -it honsell-store-db psql -U postgres -c "CREATE DATABASE umami;"
```

### 1.2 `docker-compose.yml`-ə servis əlavə edin

```yaml
  umami:
    image: ghcr.io/umami-software/umami:postgresql-latest
    container_name: honsell-umami
    restart: unless-stopped
    ports:
      # Yalnız localhost — Cloudflare/nginx reverse proxy ilə açılır,
      # birbaşa internetə çıxarılmır (db servisi ilə eyni prinsip).
      - "127.0.0.1:3002:3000"
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@db:5432/umami
      # openssl rand -base64 32
      APP_SECRET: ${UMAMI_APP_SECRET}
    depends_on:
      db:
        condition: service_healthy
```

`.env`-ə `UMAMI_APP_SECRET=...` əlavə edin, sonra:

```bash
docker compose up -d umami
```

### 1.3 Reverse proxy

`analytics.honsell.store` üçün DNS + proxy qurun (nginx/Caddy → `127.0.0.1:3002`).

> **Vacib:** analitika domenini **əsas domenin subdomeni** kimi saxlayın.
> Ayrıca domen istifadə etsəniz, reklam bloklayıcıları skripti daha çox
> bloklayır və ölçmə real trafikin altında qalır.

### 1.4 Sayt əlavə edin və env qurun

Umami panelinə girin (ilk giriş: `admin` / `umami` — **dərhal dəyişin**),
Settings → Websites → Add website → `honsell.store`. Verilən `website id`-ni
götürün və app `.env`-inə yazın:

```bash
NEXT_PUBLIC_ANALYTICS_PROVIDER=umami
NEXT_PUBLIC_ANALYTICS_SRC=https://analytics.honsell.store/script.js
NEXT_PUBLIC_ANALYTICS_SITE_ID=<website id>
```

`NEXT_PUBLIC_*` dəyişənləri **build zamanı** kodun içinə yazılır — dəyişdikdən
sonra tətbiqi yenidən build edib deploy etmək lazımdır, sadəcə restart kifayət
etmir.

---

## 2. Google Search Console

SEO işinin nəticəsini görməyin yeganə yolu budur. Analitika "neçə nəfər gəldi"
deyir, Search Console "hansı sorğuda neçənci sıradasan və neçə səhifən
indekslənib" deyir.

1. [search.google.com/search-console](https://search.google.com/search-console) →
   URL prefix → `https://honsell.store`
2. HTML tag üsulunu seçin, verilən `content="..."` dəyərini (yalnız tokeni,
   bütöv meta teqi yox) `.env`-ə yazın:

```bash
GOOGLE_SITE_VERIFICATION=<token>
```

3. Build + deploy → Search Console-da "Verify".
4. Sitemaps bölməsinə `https://honsell.store/sitemap.xml` əlavə edin
   (bu, indeks faylıdır; shard-ları Google özü tapır).

> DNS TXT üsulu ilə təsdiqləmisinizsə env-i boş buraxın — meta teq render
> olunmayacaq və heç nə pozulmayacaq.

---

## 3. Faza 1-dən sonra nəyə baxmaq lazımdır

Slug miqrasiyasından sonra ilk 2-4 həftə keçid dövrüdür — Google köhnə URL-ləri
tədricən yeniləri ilə əvəz edir. İzləyin:

| Harada | Nəyə baxırsınız | Gözlənilən |
|---|---|---|
| GSC → Pages | İndekslənmiş səhifə sayı | Əvvəlcə dalğalanır, sonra **artmalıdır** |
| GSC → Pages | "Page with redirect" sayı | Köhnə productId URL-ləri — artması NORMALDIR |
| GSC → Sitemaps | Hər shard üzrə "Discovered / Indexed" | Discovered ≈ göndərilən sayı |
| GSC → Performance | Impressions | 4-6 həftədən sonra artmalıdır |
| Umami | `/oyunlar/*` səhifələrinə giriş | Artmalıdır |

**Təhlükə siqnalı:** əgər 4 həftə sonra "Page with redirect" azalmırsa və
indekslənmiş səhifə sayı artmırsa, 308-lər düzgün işləmir — dərhal yoxlayın:

```bash
curl -sI https://honsell.store/oyunlar/<köhnə-productId> | head -3
# HTTP/2 308 + location: /oyunlar/<slug> gözlənilir
```

---

## 4. Nəyi ölçmək lazım deyil

Faydasız metrikaya vaxt sərf etməyin: bounce rate (tək səhifəlik ziyarətdə
mənasızdır), səhifədə keçirilən vaxt (dəqiq ölçülmür), ümumi ziyarət sayı
(botlar şişirdir). **Şimal ulduzu** [HOMEPAGE_CONVERSION_ROADMAP.md](./HOMEPAGE_CONVERSION_ROADMAP.md)-dəki
kimi qalır: konversiya nisbəti, AOV, təkrar alış.
