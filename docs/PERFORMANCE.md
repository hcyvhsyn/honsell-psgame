# Honsell Store — Performans & Arxitektura Arayışı

Saytın **açılış və scroll sürətini** hansı texnologiyalar, render strategiyası və
keşləmə qatları müəyyən edir — və **Cloudflare ilə Supabase tam olaraq nə üçün**
istifadə olunur.

> **Əsas nəticə (bu sessiya):** Ana səhifə `ƒ dinamik` → **`○ statik / edge-keşlənən`**,
> əlavə ~20 səhifə də statikə keçdi.

---

## 1. İstifadə olunan dillər

- **TypeScript 5** — bütün tətbiq kodu (server + client).
- **React / TSX** — UI komponentləri (server & client komponentlər).
- **SQL** — Prisma sorğuları + xam `pgvector` sorğuları (semantik axtarış).
- **CSS** — Tailwind CSS + `app/globals.css` (dark/light tema, animasiyalar).
- Saytın **interfeys dili: Azərbaycan dili**.

---

## 2. Texnologiya stack-i

| Qat | Texnologiya | Rol |
|---|---|---|
| Dil | `TypeScript 5` | Bütün kod, tip təhlükəsizliyi |
| Framework | `Next.js 14` (App Router) | SSR/ISR/statik render, routing, API, image opt |
| UI | `React 18` + TSX | Komponent ağacı, server & client komponentlər |
| Stil | `Tailwind CSS 3.4` + globals.css | Utility dizayn, tema, animasiyalar |
| ORM | `Prisma 7.8` (`adapter-pg`) | Tipli DB sorğuları, PostgreSQL qoşulması |
| Verilənlər bazası | PostgreSQL (Supabase) + `pgvector` | Bütün data; HNSW ANN semantik axtarış |
| Auth | Xüsusi cookie sessiya (+`next-auth` mövcud) | `getCurrentUser()` cookie → DB lookup |
| Storage | Supabase Storage / Cloudflare R2 (`@aws-sdk/s3`) | Şəkil/fayllar; `cdn.honsell.store` ilə verilir |
| İkonlar | `lucide-react` | Tree-shake olunan SVG ikonlar |
| AI | `openai` | Sayt köməkçisi + embeddings |
| Email | `resend` + `@react-email` | Sifariş, OTP, marketinq |
| Scraping | `cheerio` | PS Store / Epic / streaming kataloqu |
| Şəkil emalı | `sharp` | Self-host-da Next image opt üçün vacib |
| Telemetriya | `@vercel/analytics`, `speed-insights` | Ziyarət & Web Vitals |

---

## 3. Sürəti müəyyən edən 7 amil

1. **Render strategiyası (ən böyük təsir).** Səhifə statik (ISR) yoxsa hər istəkdə
   server-də render olunur? `cookies()` render yolunda olarsa səhifə dinamik
   (`no-store`) olur və keşlənə bilmir.
2. **Keşləmə qatları.** Browser → Cloudflare edge → Next ISR → `unstable_cache`
   (data) → Next image keşi. Hər qat origin-ə gedişi azaldır.
3. **Şəkil yükləmə.** Birbaşa CDN-dən paralelmi, yoxsa Node optimizer-indən
   tək-tək? Format (AVIF/WebP), ölçü, lazy/priority, placeholder.
4. **Server + DB məsafəsi.** Origin tək nöqtədir; hər dinamik istək uzaq Supabase
   (Mumbai) DB-yə gedir → TTFB artır.
5. **JS bundle & hydration.** Client komponent sayı, ilkin JS (~87 kB paylaşılan),
   barrel importların tree-shake-i.
6. **Şrift.** Lokal Geist `.woff`, `display:swap`, preload — FOIT yox.
7. **CSS paint xərci.** Böyük `blur`, `backdrop-blur`, sonsuz animasiyalar —
   scroll-da GPU/paint yükü.

---

## 4. Hosting və bir istəyin axını

Sayt **Vercel-də deyil** — öz serverinizdə `next start` ilə işləyir, qarşısında
**Caddy** reverse proxy var. Bir səhifə istəyi bu qatlardan keçir:

1. **Browser** — lokal keş + HTTP/2/3. Statik səhifədə təkrar açılış ani.
2. **Cloudflare edge** — DNS, TLS, proxy. Statik HTML və şəkillər ən yaxın edge-də
   keşlənir → origin-ə getmədən qaytarılır (epin.az-ın sürət sirri).
3. **Caddy (öz server)** — reverse proxy → `next start` Node prosesi.
4. **Next.js render** — statik (ISR) diskdən anında; dinamik isə hər istəkdə
   render + DB sorğusu.
5. **Supabase Postgres (Mumbai)** — yalnız lazım olanda; `unstable_cache` təkrar
   sorğuları kəsir.

---

## 5. Cloudflare nə üçün istifadə olunur

**Rol: CDN · Edge keş · DNS · TLS**

- **Şəkil CDN-i (`cdn.honsell.store`).** Supabase Storage origin-ini edge-də
  keşləyir. `cdnImageUrl()` Supabase URL-lərini bu hosta yönləndirir →
  **Supabase egress xərci yeyilmir** və şəkillər istifadəçiyə yaxın nöqtədən gəlir.
- **HTML edge keşi.** Statik səhifələri (indi ana səhifə daxil) edge-də saxlayıb
  origin-ə getmədən qaytarır → qlobal aşağı TTFB.
- **DNS + TLS + proxy.** HTTPS, HTTP/2 və HTTP/3, mənşə IP-nin gizlədilməsi.
- **Şəbəkə qoruması.** DDoS/bot filtri, sıxılma (gzip/brotli), edge sürətləndirmə.

---

## 6. Supabase nə üçün istifadə olunur

**Rol: PostgreSQL · Storage · pgvector**

- **Əsas verilənlər bazası (PostgreSQL).** Bütün data — oyunlar, xidmətlər,
  sifarişlər, istifadəçilər, referal, rəylər. Prisma `adapter-pg` ilə. Region: Mumbai.
- **Fayl saxlama (Storage).** Məhsul/banner şəkilləri burada saxlanılır, Cloudflare
  CDN arxasından verilir.
- **Semantik axtarış (`pgvector`).** DB-tərəfli HNSW ANN; `embeddingVec` trigger ilə
  sinxron — böyük `Float[]` sütunları client-ə çəkilmir.

> **Performans qeydi:** Supabase Mumbai-dədir, server başqa yerdə ola bilər — ona
> görə hər **dinamik** istəkdə DB gediş-gəlişi TTFB-yə əlavə olunur. Statik render +
> `unstable_cache` bu gedişləri minimuma endirir.

---

## 7. Bu sessiyada sürət üçün nə dəyişdirildi

- ✅ **Ana səhifə statik/ISR edildi.** Root layout-dakı `FavoritesBootstrap`
  `getCurrentUser()` çağırırdı → BÜTÜN sayt dinamik idi. User-vəziyyəti client-ə
  (`/api/session` + `useSession`) köçürüldü. Nəticə: `/` = statik + ~20 səhifə.
- ✅ **Şəkillər Next optimizer-ini bypass edir.** Məhsul kartlarında `unoptimized` →
  brauzer birbaşa `cdn.honsell.store`-dan paralel çəkir. Self-host optimizer növbəsi
  (`pending` 5–7s) aradan qalxdı.
- ✅ **Şəkil skeleton + fade-in.** `ProductImage` yüklənənə qədər shimmer, sonra
  yumşaq fade; `onError` fallback ilə qırıq şəkil yoxdur.
- ✅ **Marquee → statik başlıq, spacing balansı.** Sürüşən təkrar mətn premium statik
  başlıqla əvəzləndi; bölmələrarası boş zolaqlar azaldıldı.
- ✅ **Ambient blur yüngülləşdirildi.** `blur-[100px]` → `blur-[40px]` (paint xərci
  azaldı, görünüş eyni).
- ✅ **Floating düymə yenidən yerləşdirildi.** Theme toggle küncə — scrollbar
  toqquşması və kontent sıxılması getdi.

---

## 8. Səhifə render statusu (build nəticəsi)

`○ static` = öncədən render, edge-keşlənən, ani. `ƒ dinamik` = hər istəkdə server
render (cookie/searchParams/auth lazımdır).

| Səhifə qrupu | Status | Səbəb |
|---|---|---|
| `/` ana səhifə | ○ static | İndi tam statik — əsas hədəf |
| Marketinq (`/faq /haqqimizda /playstation /ps-plus /streaming …`) | ○ static | Cookie yox → öncədən render |
| Blog/slug (`/streaming/[slug] /music/[slug] /bilmeli-…/[slug]`) | ● SSG | `generateStaticParams` ilə build-də render |
| Kataloq/filtr (`/oyunlar /endirimler /epic-games`) | ƒ dinamik | `searchParams` (axtarış/filtr) — təbii dinamik |
| Məhsul detalı (`/oyunlar/[productId]`) | ƒ dinamik | Yalnız `getCurrentUser()` səbəbli — client-ə köçürülə bilər |
| İstifadəçi (`/profile/* /cart /wallet`) | ƒ dinamik | Auth/cookie lazımdır — **doğru** |
| Admin + API (`/admin/* /api/*`) | ƒ dinamik | Canlı data/auth — **doğru** |

---

## 9. Deploy + Cloudflare HTML keşi

Statik build lazımdır, amma kifayət deyil — istifadəçi sürəti yalnız HTML edge-də
keşlənəndə görəcək.

```bash
# 1) Deploy + restart
npm run build      # / = ○ static olmalıdır
next start

# 2) Cloudflare → Caching → Cache Rules:
When  method == GET
      and not path startsWith "/api"
      and not path startsWith "/profile" / "/admin" / "/cart" / "/wallet"
Then  Cache eligibility = Eligible
      Edge TTL = Override origin → 60s
      Serve stale while revalidating = ON
```

**Yoxlama:** `curl -I https://honsell.store/` → `cache-control` artıq `private,
no-store` olmamalı; təkrar istəkdə `cf-cache-status: HIT`.
⚠️ `/api/*` (xüsusən `/api/session`) **heç vaxt keşlənməməlidir**.

---

## 10. Növbəti imkanlar

- **`/oyunlar/[productId]` (məhsul detalı)** — yalnız `getCurrentUser()` (review
  widget-ə `viewerUserId`) onu dinamik edir. Client-ə köçürsək, bütün məhsul
  səhifələri ISR-statik olar → böyük SEO/sürət qazancı.
- **`/music`** — səbəbsiz `export const dynamic = "force-dynamic"`; `revalidate`-ə
  dəyişmək onu statik edər.
- **Kataloq səhifələri** (`/oyunlar` və s.) — `searchParams` səbəbli dinamik; tam
  statik üçün filtri client-side-a keçirmək (daha böyük iş) və ya Cloudflare-də
  query-string-i cache key etmək olar.

---

_Honsell Store · self-hosted (Caddy + next start) · TypeScript / Next.js 14 /
Prisma / Supabase / Cloudflare_
