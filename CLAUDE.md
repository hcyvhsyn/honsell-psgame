# CLAUDE.md

Honsell PS Store — Next.js (App Router) + Prisma + Postgres (local Docker, pgvector).
Öz serverində `next start` ilə işləyir (Vercel deyil). Media Cloudflare R2 → `cdn.honsell.store`.

---

# Səhifə konteyneri (HƏR YENİ SƏHİFƏDƏ RİAYƏT ET)

Navbar qabığı, footer və səhifədəki bütün bloklar **eyni şaquli xəttdə** oturmalıdır.
Tək həqiqət mənbəyi [app/globals.css](app/globals.css) başındakı tokenlərdir:

```css
:root { --site-max-width: 80rem; --site-gutter: 1rem; }   /* sm: 1.5rem, lg: 2rem */
.site-container { width:100%; max-width:var(--site-max-width);
                  margin-inline:auto; padding-inline:var(--site-gutter); }
```

**Qayda:** hər üst səviyyə blok ya `site-container` sinfi ilə, ya da onunla bit-bərabər
olan `mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8` ilə sarınır. Yeni səhifə yazanda
**`site-container`** işlət — 90+ köhnə blok hələ Tailwind variantındadır, ikisi eyni
həndəsəni verir, ona görə qarışıq olması problem deyil.

- **Şaquli boşluq konteynerdən kənarda / üstündə** verilir (`py-*` eyni elementə əlavə
  oluna bilər), **üfüqi padding ƏLAVƏ ETMƏ** — `site-container px-4` yazsan blok
  navbar-dan içəri sürüşür.
- **Öz `max-w-[1360px]` / `max-w-[96rem]` kimi dəyər uydurma.** Belə "bir az daha geniş"
  bloklar məhz bu problemi yaradırdı (footer 1320px, navbar 1280px, bloklar 1280−32px —
  üç fərqli kənar xətti).
- **Fon tam-enli, məzmun konteynerdə.** Rəngli/gradient zolaq lazımdırsa xarici
  `<section>` tam en olsun, içəridəki `<div className="site-container">` məzmunu tutsun.
- **Dar oxunuş bloku istisnadır** — `max-w-3xl`/`max-w-5xl` mətn bölmələri qəsdən
  daralır; onlar konteynerin **içində** mərkəzləşir, konteyneri əvəz etmir.
- **CSS Module-dan** ([SiteFooter.module.css](components/SiteFooter.module.css) kimi)
  Tailwind sinfi işlətmək olmur → birbaşa `var(--site-max-width)` / `var(--site-gutter)`
  oxu, rəqəm yazma.
- Navbar ([SiteHeader.tsx](components/SiteHeader.tsx)) və footer artıq bu tokenlərə
  bağlıdır. Konteyner enini dəyişmək lazımdırsa **yalnız `:root` tokenini** dəyiş —
  navbar, footer və bütün səhifələr birlikdə sürüşür.

⚠️ Navbar-ın daxili padding-i (`px-4 md:px-5 xl:px-6`) qabığın **içindədir** — o, kartın
sərhədini yerindən tərpətmir. Hizalanma meyarı qabığın **kənarı**dır, loqonun yeri yox.

---

# Oyun paketləri (GameBundle — satılan səbətlər)

Bir neçə oyunu sərfəli qiymətə bir dəst kimi satır: "Assassin's Creed səbəti",
"10 AZN səbəti", "4-lü paket (RDR2 + GTA5 + FC26)". Müştəri paketi **tək toxunuşla**
səbətə atır, səbətdə **atomik tək sətir** görür.

`Collection`-dan fərqi: kolleksiya **redaksiya siyahısıdır, qiyməti yoxdur**.
`LootBox`-dan fərqi: paket **deterministikdir** və adi səbət/checkout yolundan keçir.

## Fayl xəritəsi

| Qat | Fayl |
| --- | --- |
| Client-safe tip + riyaziyyat | [lib/gameBundleShared.ts](lib/gameBundleShared.ts) + [scripts/gameBundles.test.ts](scripts/gameBundles.test.ts) |
| Server (DB + qiymət) | [lib/gameBundles.ts](lib/gameBundles.ts) |
| Ana səhifə rail | [components/HomeBundles.tsx](components/HomeBundles.tsx) |
| Detal səhifə | [app/paket/[slug]/page.tsx](app/paket/[slug]/page.tsx) + `AddBundleToCartButton.tsx` |
| Admin UI | [app/admin/bundles/BundlesAdminClient.tsx](app/admin/bundles/BundlesAdminClient.tsx) |
| Admin API | [app/api/admin/bundles/route.ts](app/api/admin/bundles/route.ts) |

## Data modeli ([prisma/schema.prisma](prisma/schema.prisma) ~700)

- **`GameBundle`** — `slug`, `title/subtitle/description`, `imageUrl` (boşdursa vitrin
  oyun kaverlərindən kollaj qurur), `badgeText`, `pricingMode` (`PERCENT|CUSTOM`),
  `discountPct`, `isActive/isFeatured/sortOrder`, `startsAt/endsAt`.
- **`GameBundleItem`** — `@@id([bundleId, gameId])`, `position`, `priceAznCents Int?`
  (yalnız CUSTOM rejimində; `null` → oyunun adi vitrin qiyməti).
- **`Order`/`OrderItem` modeli YOXDUR** — alış N `Transaction` sətri yaradır, paket
  damğası `metadata.bundleId` + `metadata.bundleTitle`-dədir.

## Qiymət (TƏK mənbə: `computeBundlePricing`)

List qiymət checkout-dakı ifadənin **eynisi** ilə alınır —
`applyFlashDeal(computeDisplayPrice(game, settings), flashDeals.get(id))`. Flash deal və
bitmiş endirim məntiqi təkrarlanmır.

- **PERCENT** — hədəf cəm `allocateBundlePrices()` ilə oyunlara **largest-remainder**
  üsulu ilə bölünür. Sadə `round()` deyil, çünki hər oyun ayrıca `Transaction` sətridir
  və sətirlərin cəmi tutulan məbləğə **qəpiyinə qədər** bərabər olmalıdır.
- **CUSTOM** — hər sətrin `priceAznCents`-i, amma **list qiymətdən böyük ola bilməz**
  (`lib/flashDeals.ts` "override yalnız aşağı sala bilər" intizamı).

⚠️ Riyaziyyatı dəyişəndə **`npm run test:bundles`** işlət.

Qiymət **üç yerdə** lazımdır və üçü də eyni funksiyanı çağırır: vitrin (rail + detal),
`/api/cart/refresh`, `/api/cart/checkout`. Heç birində əl ilə təkrarlama.

## "Paket açılışı" (bundle expansion) — ƏN VACİB QAYDA

Checkout-da `kind: "BUNDLE"` adlı **fulfillment budağı YOXDUR**. Səbətdəki bir paket
sətri serverdə **N ədəd adi `kind: "GAME"` sətrinə açılır**, sadəcə `unitListCents` paket
qiyməti ilə əvəzlənir və sətirlərə `bundleId` damğası vurulur:

```
Səbətdə:   [BUNDLE bundle_abc — 45.00₼]        ← müştəri 1 sətir görür
Checkout:  [GAME rdr2 18₼ bundleId=abc] [GAME gta5 12₼ …] [GAME fc26 15₼ …]
```

Beləcə PSN/Epic hesab tələbi, `Transaction` yaradılması, referral komissiyası, rəy
affiliate damğası, sifariş məktubu və admin fulfillment axını **dəyişmir**.

⚠️ Paket yoxlaması `app/api/cart/checkout/route.ts` içindəki dövrdə `services.find(...)`
sətrindən **ƏVVƏL** olmalıdır — paket id-si nə `games`, nə `services` içindədir.

⚠️ **İkiqat fulfillment yolu** — cüzdan ([checkout/route.ts](app/api/cart/checkout/route.ts))
və kart ([lib/epointCartCheckout.ts](lib/epointCartCheckout.ts)) ayrı-ayrıdır. Epoint
snapshot-u artıq açılmış GAME sətirlərindən qurulur, ona görə orada yalnız `bundleId`
metadata-ya ötürülür.

## Tələlər / bilinməli məqamlar

- **Deaktiv oyun → paket tamamilə gizlənir.** "4-lü paket" 3 oyunla satıla bilməz
  (`isBundleSellable`). Admin panelində səbəb xəbərdarlıq kimi görünür; səbətdəki paket
  `/api/cart/refresh`-in `missing` cavabı ilə silinir.
- **Kupon paketə düşmür.** Paket onsuz da endirimlidir. İstisna **İKİ yerdə** eynidir:
  `checkout/route.ts`-dəki `scopeItems` (`bundleId` olan sətirlər atılır) və
  `/api/cart/coupon` preview-i (`productType === "BUNDLE"`). Biri unudulsa müştəri
  preview-də bir rəqəm görür, kassada `COUPON_INVALID` alır.
- **Client → prisma import tələsi** — `"use client"` komponent
  [lib/gameBundles.ts](lib/gameBundles.ts)-i import etsə `next build` sınır (tsc keçsə də).
  Client tərəf **yalnız** [lib/gameBundleShared.ts](lib/gameBundleShared.ts)-dən oxuyur.
- **Paket hədiyyə olunmur** — hər oyun ayrıca kod tələb edərdi; checkout `isGift` gələn
  paket sətrini buraxır, detal səhifəsində hədiyyə düyməsi yoxdur.
- `revalidateGames()` **`"bundles"` tag-ını da sıfırlayır** — PERCENT paketin qiyməti
  oyun qiymətindən asılıdır, yoxsa scrape sonrası vitrin köhnə qalır.
- Ana səhifə keşi `tags: ["home", "bundles"]` ilə bağlıdır; detal səhifəsi isə
  `["bundles", "games"]`.

---

# Reels (şaquli video feed)

TikTok/YouTube Shorts tərzi feed: `/reels`. İstifadəçi izləyir, like/dislike edir,
şərh yazır və **tək toxunuşla** CTA hədəfini (oyun / hesab xidməti / xarici link)
səbətə atır. Admin panelindən VƏ Telegram botundan video əlavə olunur.

## Fayl xəritəsi

| Qat | Fayl |
| --- | --- |
| Data (TƏK mənbə) | [lib/reels.ts](lib/reels.ts) |
| Sürüm qruplaşdırma (saf) | [lib/gameEditions.ts](lib/gameEditions.ts) + [scripts/gameEditions.test.ts](scripts/gameEditions.test.ts) |
| Alış paneli (çip + qiymət) | [components/reels/ReelBuyPanel.tsx](components/reels/ReelBuyPanel.tsx) |
| Public səhifə (RSC) | [app/reels/page.tsx](app/reels/page.tsx) |
| Feed client | [components/reels/ReelsFeedClient.tsx](components/reels/ReelsFeedClient.tsx) |
| Bir slot (video+poster) | [components/reels/ReelSlot.tsx](components/reels/ReelSlot.tsx) |
| Mobil overlay rail | [components/reels/ReelActionRail.tsx](components/reels/ReelActionRail.tsx) |
| Desktop yan panel | [components/reels/ReelSideRail.tsx](components/reels/ReelSideRail.tsx) |
| Şərh panosu | [components/reels/ReelCommentsSheet.tsx](components/reels/ReelCommentsSheet.tsx) |
| Per-user state context | [components/reels/ReelStateProvider.tsx](components/reels/ReelStateProvider.tsx) |
| Like/səbət ortaq hook | [components/reels/useReelInteractions.ts](components/reels/useReelInteractions.ts) |
| Client-safe tiplər | [components/reels/types.ts](components/reels/types.ts) |
| Desktop launcher (sağ kənar) | [components/reels/ReelsLauncher.tsx](components/reels/ReelsLauncher.tsx) |
| Admin UI | [app/admin/reels/ReelsAdminClient.tsx](app/admin/reels/ReelsAdminClient.tsx) |
| Public API | [app/api/reels/](app/api/reels/) — `route.ts`, `state/`, `[id]/{view,react,comments}` |
| Admin API | [app/api/admin/reels/](app/api/admin/reels/) — `route.ts`, `video-upload`, `video-import`, `image-upload`, `products`, `comments` |
| Telegram ingest | [app/api/telegram/webhook/route.ts](app/api/telegram/webhook/route.ts) |
| ffmpeg/yt-dlp ingest | [lib/videoIngest.ts](lib/videoIngest.ts) |
| Brauzerdə poster çıxarma | [lib/videoPoster.ts](lib/videoPoster.ts) |
| HEVC aşkarlaması | [lib/videoCodec.ts](lib/videoCodec.ts) (client) + [lib/videoFourcc.ts](lib/videoFourcc.ts) (ortaq saf funksiya) |

Naviqasiya girişləri: mobil bottom bar ([components/SiteHeader.tsx](components/SiteHeader.tsx)),
desktop sticky launcher ([app/layout.tsx](app/layout.tsx)), admin sidebar
([app/admin/layout.tsx](app/admin/layout.tsx)). `AskAiFloat` `/reels`-də gizlənir.

## Data modeli ([prisma/schema.prisma](prisma/schema.prisma) ~2196)

- **`Reel`** — `videoUrl`/`posterUrl` (R2), `width/height/durationMs`,
  `platformCode|Label|LogoUrl` (sərbəst string, enum DEYİL — `Game.store` kimi),
  CTA (`ctaType` = `GAME|SERVICE|URL`, `ctaTargetId`, `ctaHref`, `ctaLabel`),
  `viewCount`, `isPublished`, `sortOrder`.
- **`ReelReaction`** — `@@id([reelId, userId])`, `value` = `+1` | `-1`.
- **`ReelComment`** — `isHidden` (admin sonradan gizlədir; **moderasiya öncədən deyil**).

`ctaTargetId` semantikası: `GAME` → `Game.id` (`productId` yox! — cart birbaşa DB id ilə
işləyir), `SERVICE` → `ServiceProduct.id`.

`Reel.editionGameIds String[]` — `ctaType=GAME` olduqda feed-də göstərilən **sürümlər**
(aşağıdakı "Sürümlər və qiymət" bölməsinə bax). CTA tipi GAME deyilsə admin API-si onu
məcburi boşaldır.

## Sürümlər və qiymət (alış paneli)

Feed-də video altında sürüm çipləri + canlı qiymət + səbət düyməsi göstərilir
([ReelBuyPanel.tsx](components/reels/ReelBuyPanel.tsx)).

**Qiymət/endirim:** `computeDisplayPrice(game, settings)` → `{ finalAzn, originalAzn,
discountPct }`. **Bitmiş endirimləri özü ləğv edir** (`discountEndAt` keçibsə tam qiymət
qaytarır, [lib/pricing.ts:288](lib/pricing.ts#L288)) — client-də ayrıca "endirim bitib"
məntiqi YAZMA, tək həqiqət mənbəyi serverdir. `originalAzn`/`discountPct` yalnız aktiv
endirimdə dolu olur, əks halda `null`.

**Sürüm qruplaşdırması** — DB-də sürümləri bağlayan sütun YOXDUR, hər sürüm ayrıca `Game`
sətridir. Detal səhifəsindəki `buildFranchiseSeed` (ilk 1–2 söz) bura YARAMIR: "God of"
bütün seriyanı tutur. Əvəzinə iki mərhələ:

1. **Avto təklif** — [lib/gameEditions.ts](lib/gameEditions.ts) `baseGameTitle()` başlıqdan
   sürüm sonəkini kəsir. Kəsmə **açgöz deyil**: yalnız tanınan keyfiyyətləndiricilər
   (`EDITION_QUALIFIERS`) geriyə atılır, ilk tanınmayan sözdə dayanılır. Açgöz variant
   "God of War Dijital Deluxe Sürüm"-ü "God of"-a çevirərdi.
2. **Admin təsdiqi** — `/api/admin/reels/editions?gameId=` namizədləri qaytarır
   (SQL `startsWith` → *recall*, `isSameGameFamily` → *precision*), admin işarələyir,
   yekun `Reel.editionGameIds`-ə yazılır. Səhv qruplaşma müştəriyə çatmır.

Sürümlər feed-ə **ucuzdan bahaya** sıralı gəlir və panel `[0]`-ı default seçir — sıralama
məhsul qərarıdır, kosmetika deyil (müştəri ən ucuzu axtarmadan görməlidir).

⚠️ Qruplaşdırma məntiqini dəyişəndə **`npm run test:editions`** işlət — real PS Store
başlıqları ilə kilidlənib (səhv qruplaşma = müştəriyə yanlış qiymət).

⚠️ Panel görünəndə hər iki rail-dəki köhnə səbət düyməsi gizlədilir (`hasBuyPanel()` ortaq
şərtdir) — yoxsa ekranda iki fərqli qiymət mənbəyi olur.

## Keşləmə arxitekturası (ƏN VACİB QAYDA)

Feed səhifəsi **statik/edge-keşlənən** qalmalıdır → `app/reels/page.tsx` içində
`cookies()` / `getCurrentUser()` **HEÇ VAXT** çağırma (homepage ilə eyni prinsip).

- İlk səhifə: `getFirstReelsPageCached()` → `unstable_cache`, tag **`"reels"`**, `revalidate: 300`.
- Sonrakı səhifələr: `GET /api/reels?cursor=N` (offset kursoru, `REELS_PAGE_SIZE = 8`,
  `take: limit+1` ilə `hasMore` təyini).
- Per-user vəziyyət (bəyəndim/dislike) feed cavabında **yoxdur** — `POST /api/reels/state`
  (`force-dynamic`) batch endpoint-indən client-də paint-dən sonra gəlir.
- Admin hər CRUD-dan sonra `revalidateReels()` ([lib/revalidate.ts](lib/revalidate.ts)) —
  `revalidateTag("reels")` + `revalidatePath("/reels")`. Telegram callback da çağırır.

## Client oynatma mexanikası

- CSS `snap-y snap-mandatory` + `scrollSnapStop: always`; slot hündürlüyü
  `h-[100dvh] sm:h-[92dvh]`.
- **Tək** `IntersectionObserver` (root = scroller, threshold `0.6`) → `activeIndex`.
- Role state machine: `active` (oynayır) / `preload` (±1, `<video>` mount olunur, pauzada) /
  `dormant` (yalnız poster `<img>`, video DOM-da yoxdur).
- Poster `<img>` anında paint olunur, `onPlaying`-də `opacity-0` ilə itir.
- Autoplay blokda (`NotAllowedError`) → `needsTap`, mərkəz Play ikonu.
- Səs qlobaldır (`globalMuted`), `M` klavişi toggle; `↑/↓` naviqasiya.
- Sonsuz scroll: `activeIndex >= items.length - 3` olanda `loadMore()`.
- `viewedThisSession` Set — izlənmə ≥2s (və ya `durationMs*0.5`) sonra **bir dəfə**
  `POST /api/reels/[id]/view` (`keepalive`). Server tərəfdə dedup **yoxdur**, sadə increment.

## Layout: mobil vs desktop

Action düymələri İKİ yerdə render olunur, hər ikisi eyni `useReelInteractions` hook-unu
işlədir:
- **Mobil** (`xl:hidden`): `ReelActionRail` — video ÜZƏRİNDƏ overlay, `ReelSlot` içində.
- **Desktop** (`hidden xl:flex`): `ReelSideRail` — videonun KƏNARINDA, `ReelsFeedClient`-də,
  yalnız aktiv reel üçün.

⚠️ `ReelSideRail` mütləq `key={activeItem.id}` ilə render olunmalıdır — `useReelInteractions`
like sayının baseline-ını per-instance `useRef`-də saxlayır; remount olmasa köhnə baseline
qalır və saylar sürüşür.

## Media boru xətti

Videolar R2-də (`reels/…mp4`, poster `reels/posters/…jpg`), Next image optimizer-dən
keçmir — birbaşa `<img src>` / `<video src>`.

Üç ingest yolu:
1. **Admin fayl yükləmə** — `uploadAdminVideo` → presigned R2 PUT (progress XHR ilə).
   Poster brauzerdə `<video>+<canvas>` ilə çıxarılır (`captureVideoPoster`), ölçü+müddət
   də oradan gəlir. HEVC faylı yükləmədən əvvəl bloklanır.
2. **URL idxalı** — `POST /api/admin/reels/video-import` serverdə fetch edib R2-yə yazır
   (maks 200MB). Poster `captureVideoPosterFromUrl` ilə; CORS taint olarsa `null` qaytarır.
3. **Telegram botu** — aşağıdakı ayrıca bölməyə bax.

## Telegram ingest axını

Video faylı və ya TikTok/Instagram/YouTube linki göndərilir; `yt-dlp` endirir, `ffmpeg`
H.264 + `+faststart`-a çevirir + poster çıxarır, reel **qaralama** (`isPublished:false`)
yaradılır. Sonra:

```
video → "Bu nədir?"  ┌─ 🎬 Film/Serial → platforma düymələri → yayım
                     └─ 🎮 Oyun → "Oyunun adını yaz" → mətn → oyun düymələri
                                → sürümlər AVTO doldurulur → yayım
```

Callback formatları (limit **64 bayt**, cuid = 25 simvol):

| Prefiks | Format | Uzunluq |
| --- | --- | --- |
| `rk` | `rk\|<reelId>\|G⎮S` — növ seçimi | 30 |
| `rp` | `rp\|<reelId>\|<platformCode>` — platforma | ~35 |
| `rg` | `rg\|<reelId>\|<gameId>` — oyun seçimi | 54 |

**Söhbət state-i:** düymə cavabları `reelId`-ni callback_data-da daşıyır, amma **mətn**
cavabı (oyun adı) heç nə daşımır — ona görə `Reel.tgChatId` + `Reel.tgStage`
(`GAME_NAME`) sütunları var. Yeni video gələndə həmin chat-ın köhnə gözləyən qaralaması
sərbəst buraxılır (`clearPendingStage`), yoxsa növbəti mətnin hansı reel-ə aid olduğu
qeyri-müəyyən olur. Yayımdan sonra `tgStage = null`.

**Mesaj emalı sırası vacibdir:** video/link həmişə YENİ qaralama başladır, sadə mətn isə
yalnız gözləyən qaralama varsa oyun axtarışı kimi oxunur.

⚠️ Telegram-da checkbox yoxdur, ona görə oyun seçiləndə **sürümlər admin təsdiqi olmadan**
`findEditionCandidates()`-dən doldurulur. Təsdiq mesajı neçə sürüm əlavə olunduğunu və ən
ucuz qiyməti yazır ki, admin paneldən yoxlaya bilsin.

### `allowed_updates` tələsi (bu problem İKİ DƏFƏ təkrarlanıb)

Webhook `["message","channel_post"]` ilə qeyd olunubsa Telegram **inline düymə basmalarını
ümumiyyətlə göndərmir** — server tamamilə səssiz qalır, düymə sonsuz "saat" ikonunda
ilişir, log-da heç bir xəta görünmür. Bu, kod xətası kimi görünür, amma deyil.

Yoxlama: `curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"` → `allowed_updates`
içində `callback_query` olmalıdır.

İndi `ensureCallbacksAllowed()` ([lib/telegram.ts](lib/telegram.ts)) bunu **özü bərpa edir**:
proses ömründə bir dəfə `getWebhookInfo` çağırır və `callback_query` yoxdursa `setWebhook`-u
təkrarlayır. Serverdə işlədiyi üçün **serverin öz secret-ini** işlədir.

⚠️ **Lokal `.env`-dən `setWebhook` ÇAĞIRMA.** Oradakı `TELEGRAM_ALLOWED_IDS` plasseholderdir
(`123456789,987654321`) — yəni fayl prod Telegram konfiqurasiyası deyil (yalnız token
realdır). Səhv `secret_token` webhook-u tamamilə sındırar.

**Toplu yükləmə** (admin "Toplu yüklə"): hər fayl → avto poster + fayl adından başlıq →
`isPublished:false` qaralama. Admin sonra CTA/platforma verib yayımlayır.

## Tələlər / bilinməli məqamlar

- **HEVC/H.265 bloklanır** — Chrome/Firefox oynatmır. `detectFourccFromBytes` mp4
  baytlarında `stsd` fourcc axtarır (`avc1` OK, `hvc1/hev1/dvh1/dvhe` rədd). Client
  yükləmədən əvvəl, Telegram isə ffmpeg yoxdursa yoxlayır.
- **Server binary-ləri** — `ffmpeg`, `ffprobe`, `yt-dlp` Docker image-də olmalıdır
  (`FFMPEG_PATH` / `FFPROBE_PATH` / `YTDLP_PATH` ilə override). Yoxdursa link ingest
  işləmir; `checkIngestBinaries()` graceful fallback verir.
- **Instagram cookie-ləri** — yt-dlp login-siz Instagram/Facebook media qaytarmır;
  `YTDLP_COOKIES_FILE` (Netscape cookies.txt) və ya `YTDLP_COOKIES_FROM_BROWSER` lazımdır.
  Cookie yalnız `AUTH_HOSTS`-a (instagram/facebook/fb.watch) tətbiq olunur.
- **Telegram env-ləri** — `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`,
  `TELEGRAM_ALLOWED_IDS` (vergüllə). Allowlist boşdursa **heç kim** reel əlavə edə bilmir.
  Telegram `getFile` limiti ~20MB.
- **Tip dublikatı qəsdəndir** — `ReelFeedItem` həm [lib/reels.ts](lib/reels.ts) (server),
  həm [components/reels/types.ts](components/reels/types.ts) (client) içindədir. Client
  komponent `lib/reels.ts`-i import etsə `lib/prisma` bundle-a düşür və `next build`
  sınır (tsc keçsə də). **İkisini birlikdə yenilə.**
- `posterUrl` sxemdə `String` (nullable deyil) — poster yoxdursa boş sətir `""` yazılır,
  feed video first-frame-ə düşür.
- Like sayları `Math.max(0, …)` ilə qorunur, çünki feed keşi 5 dəqiqəyə qədər köhnə ola bilər.
- **Reels qiymətləri 5 dəqiqəyə qədər köhnə ola bilər** — skreyp/məzənnə dəyişikliyi
  `"reels"` tag-ını sıfırlamır, yalnız `revalidate: 300` işləyir. Səbətə/checkout-a düşən
  qiymət onsuz da yenidən hesablanır, ona görə bu göstərim gecikməsidir, qiymət səhvi yox.
- Şərh sayı client-də `commentDeltas` ilə düzəldilir (keşlənmiş sayın üstünə delta).
</content>
</invoke>
