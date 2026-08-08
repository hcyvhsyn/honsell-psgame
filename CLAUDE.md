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

`Reel.category` — **`GAME` | `STREAMING`**. Feed ayrımının yeganə mənbəyi (aşağıdakı
"Kateqoriya ayrımı" bölməsinə bax). `ctaType`-dan ÇIXARILMIR: toplu qaralamalar
`ctaType="URL"` ilə yaradılır, amma oyun videosu ola bilər.

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

## Kateqoriya ayrımı (oyun ↔ film/serial)

Oyun alan auditoriya ilə film/serial izləyən auditoriya bir-birini **itələyir** —
qarışıq feed hər ikisini itirirdi. Ona görə istifadəçi `/reels`-ə **ilk girişdə**
seçim edir: 🎮 Oyun / 🎬 Film & Serial / Hamısı.

- Seçim **yalnız cihazda** saxlanılır — `localStorage["honsell:reels-feed"]`
  ([components/reels/reelCategory.ts](components/reels/reelCategory.ts)). Hesaba
  yazılmır, çünki səhifə statik qalmalıdır.
- `ALL` **saxlanılan dəyər DEYİL** — yalnız süzgəcsiz baxışdır. Admin API-si onu
  qəbul etmir, yoxsa reel heç bir feed-ə düşməzdi.
- Yazma yolları: Telegram `rk|<reelId>|G⎮S` düyməsi (elə ayrımın özüdür) və admin
  formundakı select. Yeni reel üçün admin default-u `GAME`, toplu qaralamalar
  `STREAMING` (yayımlanmır, admin onsuz da düzəldir).

**Server seçimi bilmir** (statik səhifə), ona görə [app/reels/page.tsx](app/reels/page.tsx)
**hər iki** kateqoriyanın ilk səhifəsini ötürür — seçim nə olursa olsun əlavə sorğu
getmir. `ALL` azlıqda qalan seçimdir, onun ilk səhifəsi client-də mount-da çəkilir.

⚠️ **Seçim həll olunana qədər feed RENDER OLUNMUR** (qara ekran). SSR-də hansısa
kateqoriyanı göstərsək, qayıdan istifadəçi bir an **yanlış feed-i** görür: SSR HTML
hidrasiyadan ƏVVƏL paint olunur, ona görə `useLayoutEffect` bunu xilas etmir.

⚠️ Platforma çipi süzgəci **serverdə** tətbiq olunur (`/api/reels?platform=`) — client-də
süzsək offset kursoru süzülmüş dəstlə uyğunsuzlaşır və səhifələmə element atlayır.

⚠️ **MİQRASİYA BUILD-DƏN ƏVVƏL İŞLƏMƏLİDİR.** `/reels` statik prerender olunur, yəni
`next build` zamanı DB-yə sorğu gedir. Sxem dəyişikliyi tətbiq olunmayıbsa **build-in
özü sınır** (`Export encountered errors on following paths: /reels/page`), sadəcə runtime
yox. Düzgün sıra: `git pull` → `prisma migrate deploy` → `next build`.

Bu artıq **avtomatlaşdırılıb** — [.github/workflows/deploy.yml](.github/workflows/deploy.yml)
`./deploy.sh`-dan əvvəl `prisma migrate deploy` işlədir (`deploy.sh` serverdədir və
miqrasiya işlətmir). İki incəlik: `prisma/` qovluğu konteynerə **mount olunur**, çünki
image-dəki nüsxə build vaxtı `COPY` olunub və yeni miqrasiyalar orada yoxdur; `script_stop:
true` isə miqrasiya sınanda 9 dəqiqəlik build-ə keçməyi dayandırır.

## Yalnız PlayStation

Reels-də **Epic oyunları göstərilmir** — hər üç yerdə `store: "PS"` süzgəci var:
Telegram oyun axtarışı, admin məhsul seçicisi (`/api/admin/reels/products`) və sürüm
namizədləri (`findEditionCandidates`, orada `store: base.store` ilə).

⚠️ `platform: { not: "PC" }` YAZMA — SQL-də `NULL != 'PC'` → `NULL` olduğu üçün
platform-u boş olan sətirlər də süzülüb atılır. `store` NOT NULL və defaultu `"PS"`-dir,
ona görə düzgün süzgəc odur.

## Başlıq

Telegram-dan gələn videonun başlığı **yalnız caption-dan** götürülür. Əvvəllər mənbə adı
("TikTok video") qoyulurdu — feed-də mənasız görünürdü. Caption yoxdursa başlıq **boş**
qalır və oyun seçiləndə oyunun adı ilə dolur; feed boş `<h2>` render etmir, admin
siyahısında "(başlıqsız)" göstərilir.

## Təkrar-önləmə (eyni video təkrar görünməsin)

İki ayrı səbəb var idi və hər ikisi həll olunub:

1. **Giriş nöqtəsi hamı üçün eyni idi** — `sortOrder → createdAt` sıralaması sabitdir
   və feed həmişə offset 0-dan başlayırdı. İndi sıra ziyarətə məxsus `seed` ilə
   qarışdırılır ([lib/reelRanking.ts](lib/reelRanking.ts)).
2. **İzlənmə yadda qalmırdı** — per-user qeyd YOX idi, yalnız qlobal `viewCount`.
   İndi cihaz dəftəri var ([reelSeen.ts](components/reels/reelSeen.ts),
   `localStorage["honsell:reels-seen"]`, ~500 id ring buffer).

**Sıralama formulu:** `recencyBucket(createdAt) * 1000 + seededHash(id, seed) % 1000`
— yaş 7 günlük səbətlərə bölünür, hər səbətin İÇİ qarışdırılır. Yəni bu həftəkilər
(qarışıq) əvvəldə, sonra keçən həftə. Tam təsadüfi sıralama yeni kampaniya videosunu
kataloqda itirərdi; sırf "ən yenilər" isə köhnə yaxşı videoları bir daha göstərməzdi.

⚠️ Dəyişəndə **`npm run test:reelranking`** işlət (determinizm + səbət intizamı).

**Endpoint:** `POST /api/reels/feed` (`force-dynamic`, keşlənmir). GET deyil, çünki
gövdədə 500-ə qədər `excludeIds` gedir. Keşlənən `GET /api/reels` **silinməyib** —
statik səhifə və deep link onu işlədir.

⚠️ **`excludeIds` səhifələmə boyu DONDURULUR** (`excludeRef`). Scroll edərkən yeni
tamamlanan videoları süzgəcə əlavə etsək server hovuzu kiçilir, offset-lər sürüşür və
istifadəçi element atlayır/təkrar görür. Yeni siyahı yalnız yeni feed sessiyasında
(kateqoriya/platforma dəyişimi, restart) tətbiq olunur.

⚠️ **"Görülmüş" = video SONUNA ÇATIB**, `loop` səbəbindən `ended` hadisəsi HEÇ VAXT
işə düşmür — `onTimeUpdate` ilə `currentTime >= duration - 0.3` yoxlanılır
([ReelSlot.tsx](components/reels/ReelSlot.tsx)). Bu, ciddi meyardır: sürətlə ötürülən
video bağlanmır. Təkrarlar hiss olunmağa davam edərsə həddi 50%-ə endirmək bir sətirlik
dəyişiklikdir.

⚠️ Mövcud `viewedThisSession` + `POST /api/reels/[id]/view` AYRI məqsəd daşıyır (qlobal
analitika sayğacı) — təkrar-önləmə ilə qarışdırma.

**Tükənmə:** hovuz boşalanda `exhausted: true` gəlir və `ReelExhaustedScreen`
göstərilir ("Əvvəldən başla" → dəftər təmizlənir + yeni seed). Bu, `EmptyState` ilə
QARIŞDIRILMAMALIDIR — o, "kataloqda heç video yoxdur" halıdır. Fərq dəftərin boş olub
olmamasından bilinir.

## "Saxla" düyməsi

Bir düymə, **iki fərqli hədəf** — reel kateqoriyasına görə:

| Kateqoriya | Hara yazılır | Niyə |
| --- | --- | --- |
| `GAME` | mövcud **`Favorite`** cədvəli (`/api/favorites`) | Orada endirim bildirişləri var və saxlanan şey konkret OYUN-dur |
| `STREAMING` | yeni **`ReelBookmark`** (`POST /api/reels/[id]/bookmark`) | Film/serial heç bir məhsula bağlı deyil — yalnız videonun özü var |

⚠️ Oyun favoritə düşəndə **panelde SEÇİLİ sürüm** yazılır, `ctaTargetId` yox —
istifadəçi Ultimate sürümə baxıb saxlayırsa favoritlərdə Standart görməməlidir.
Seçim `ReelStateProvider.selectedEditions`-dədir, çünki sürüm çipləri `ReelBuyPanel`-də
(ReelSlot içində), "Saxla" düyməsi isə həm orada, həm də **desktop yan raildə**
(ReelSlot-dan KƏNARDA) olur — hər ikisi eyni seçimi görməlidir.

Per-user "saxlanıldı" vəziyyəti: film/serial üçün `/api/reels/state` (batch, `saved`
sahəsi), oyun üçün `useFavorites().has()`.

**"Saxladıqlarım" feed-i** (`category=SAVED`) hər iki mənbəni birləşdirir: bookmark
edilmiş reels + favorit oyuna aid reels (`ctaTargetId` VƏ `editionGameIds hasSome`
üzrə — istifadəçi hansı sürümü saxlayıbsa reel yenə çıxsın).

⚠️ `SAVED`-də NƏ görülmüş süzgəci, NƏ də qarışdırma tətbiq olunur — saxlanılan siyahı
proqnozlaşdırılan olmalıdır. Həmçinin `localStorage`-a **yazılmır**: müvəqqəti baxışdır,
yoxsa növbəti giriş boş siyahı ilə açılardı.

## Deep link — `/reels?r=<id>`

⚠️ `page.tsx`-də `searchParams` işlətmək route-u **dinamik edir** və bütün keşləmə
arxitekturasını sındırır. Parametr **client-də** `useSearchParams()` + məcburi
`<Suspense>` sərhədi ilə oxunur, reel `GET /api/reels/[id]`-dən çəkilib feed-in başına
qoyulur. Saxlanmış seçim **dəyişdirilmir** — bu, bir dəfəlik baxışdır.

Linki hər iki rail-dəki **Paylaş** düyməsi yaradır (`useReelInteractions().share()`):
mobil-də `navigator.share` native vərəqi açır, masaüstündə link buferə kopyalanır və
düymə qısa müddət "Kopyalandı" göstərir (`navigator.clipboard` HTTPS tələb edir).

## Keşləmə arxitekturası (ƏN VACİB QAYDA)

Feed səhifəsi **statik/edge-keşlənən** qalmalıdır → `app/reels/page.tsx` içində
`cookies()` / `getCurrentUser()` **HEÇ VAXT** çağırma (homepage ilə eyni prinsip).

- İlk səhifə: `getFirstReelsPageCached(category)` → `unstable_cache`, tag **`"reels"`**,
  `revalidate: 300`. Funksiya **arqumenti avtomatik keş açarına düşür**, ona görə hər
  kateqoriya öz girişini alır; tag hamısında eynidir ki, `revalidateReels()` bir çağırışla
  hamısını sıfırlasın.
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

### Səs davranışı ([reelSound.ts](components/reels/reelSound.ts))

⚠️ **Cihazın səs DÜYMƏLƏRİ brauzerə ötürülmür.** Mobil platformalarda bu hadisə
səhifəyə ümumiyyətlə çatmır; masaüstündə yalnız bəzi brauzerlər `AudioVolumeUp`
klavişini verir (macOS-da OS onu udur). Yəni "telefonun səsini artıranda feed-in səsi
açılsın" birbaşa AŞKARLANA BİLMİR — bunu vəd edən kod yazma. Əvəzində üç mexanizm var:

1. **Seçim yadda saxlanılır** (`localStorage["honsell:reels-sound"]`) — bir dəfə səs
   açılırsa növbəti girişlərdə də açılmağa cəhd olunur. Ən çox təsir edən budur.
2. **Səsli avtoplay cəhdi** — brauzer `NotAllowedError` verirsə video **səssiz
   oynadılır** (dayandırılmır) və UI səssizə qayıdır. Saxlanmış seçim POZULMUR:
   Chrome-un media engagement göstəricisi artdıqca sonrakı girişdə keçə bilər.
   Bunun üçün `ReelSlot` `onSoundBlocked` prop-u ilə valideynə xəbər verir —
   valideyn yalnız state-i dəyişir, `storeSoundPreference` ÇAĞIRMIR.
3. **İlk toxunuş səsi açır** — səssiz ikən videoya toxunmaq pauza yox, səs açır
   (TikTok davranışı). Səs açıldıqdan sonra toxunuş adi pauza/oynat olur.
   Üst sağda "Səs üçün toxun" nişanı bunu bildirir.
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

### ⚠️ Ağır iş HEÇ VAXT cavab yolunda olmamalıdır

Telegram webhook cavabını ~60 saniyə gözləyir; gecikmə olarsa **eyni update-i təkrar
göndərir**. Əvvəllər endirmə+çevirmə (yt-dlp 150s + ffmpeg 180s) 200 qaytarılmazdan
əvvəl işləyirdi → eyni video **8 dəfə** emal olunurdu, hər dəfə yeni "Video endirilir..."
mesajı gəlirdi və paralel ffmpeg-lər 4GB serverdə bir-birini boğub
`ffmpeg vaxt aşımına uğradı` verirdi. Bu, ffmpeg problemi kimi görünür — deyil.

İndi üç müdafiə var:
1. `runIngest()` **fon rejimində** işləyir, webhook 200-ü dərhal qaytarır
   (`next start` uzunömürlü Node prosesidir, cavabdan sonra iş davam edir).
2. `seenUpdateIds` — təkrar gələn `update_id` atılır.
3. `ingestingChats` — eyni chat-da paralel ingest bloklanır.

⚠️ **Yeni ağır əməliyyat əlavə edəndə onu mütləq `runIngest` kimi cavabdan sonra işlət.**

### Remux > transcode

TikTok/Instagram/YouTube endirmələri demək olar həmişə **onsuz da H.264+AAC**-dır.
`processFile()` əvvəlcə `probeCodecs()` ilə yoxlayır: uyğundursa yalnız konteyneri
remux edir (`-c copy -movflags +faststart`) — dəqiqələr əvəzinə saniyələr. Yenidən
kodlaşdırma yalnız codec uyğun olmayanda və ya en > 1920 olanda işə düşür.

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

---

# Oyun axtarışı (navbar modalı + kataloq)

Navbar modalı və `/oyunlar` kataloqu **eyni** axtarış mühərrikini işlədir.
Əvvəl hər ikisi `title ILIKE '%q%'` idi və real kataloqda (8.5K aktiv PS sətri)
aşağıdakıların HAMISI **0 nəticə** verirdi:

```
"gta 5"               → Grand Theft Auto V        (abbreviatura + rum rəqəmi)
"spiderman"           → Marvel's Spider-Man       (defis/apostrof)
"god of war ragnarok" → God of War Ragnarök       (diakritik)
"fifa"                → EA SPORTS FC 26           (seriya adı dəyişib)
```

## Fayl xəritəsi

| Qat | Fayl |
| --- | --- |
| Sorğu normallaşdırması (saf) | [lib/gameSearchTerms.ts](lib/gameSearchTerms.ts) + [scripts/gameSearch.test.ts](scripts/gameSearch.test.ts) |
| SQL fraqmentləri | [lib/gameSearchSql.ts](lib/gameSearchSql.ts) |
| Navbar API | [app/api/search/route.ts](app/api/search/route.ts) |
| Navbar UI | [components/NavSearch.tsx](components/NavSearch.tsx) |
| Kataloq API (fuzzy budaq) | [app/api/games/route.ts](app/api/games/route.ts) |

## Necə işləyir

Sorğu `slugifyText` ilə normallaşdırılır, sonra **söz qruplarına** bölünür; hər
qrupun içi OR (variantlar), qruplar arası AND-dir. Variantlar: abbreviatura
açılışı (`gta` → `grand theft auto`, `fifa` → `ea sports fc`), rum⇄ərəb rəqəmi
(`5` ⇄ `v`), hərf/rəqəm ayrılması (`gta5` → `gta` + `5`).

Başlıq SQL-də **eyni qaydada** normallaşdırılır (LATERAL-da bir dəfə):
`gn.n` = boşluqla əhatələnmiş normal forma, `gs.s` = boşluqsuz forma.
`gs.s` defis/apostrof fərqlərini udur (`spiderman` → `marvelsspiderman2`).

- **Stopword-lar** (`ps5`, `oyun`, `ucuz`…) atılır — "spiderman 2 ps5" əvvəl
  boş nəticə verirdi. ⚠️ Süzgəc hərf/rəqəm ayrılmasından **ƏVVƏL** işləməlidir,
  yoxsa `ps5` → `ps` + `5` qalır və `5` başlıqda tələb olunur.
- **4+ sözlü sorğuda bir söz buraxılır** (`required = n - 1`), 3 və azında
  hamısı tələb olunur — "of"/"war" kimi sözlər tək başına kataloqu qaytarardı.
- Typo toleransı `similarity(title, phrase) >= 0.15` (pg_trgm) ilə OR olunur.

**Sıralama sırası vacibdir:** tam söz uyğunluğu → ifadə uyğunluğu → uyğun söz
sayı → similarity. Tam söz birinci olmasa `cod` sorğusu **"Code Blue"**-nu
Call of Duty-dən yuxarı qaldırır (prefiks uyğunluğu aldadıcıdır).

⚠️ Dəyişəndə **`npm run test:gamesearch`** işlət — SQL-in JS referansı
(`titleMatchesTerms`) həmin fayldadır və **birlikdə yenilənməlidir**, yoxsa
test yaşıl qalıb istifadəçi boş nəticə görər.

⚠️ Normallaşdırma ifadəsi **indekslənmir** (`regexp_replace` sətir-sətir).
Kataloq sorğusu onsuz da `similarity()` səbəbindən seq scan idi, ona görə
əlavə yük kiçikdir — amma yeni çağırış yeri əlavə edəndə bunu nəzərə al.

## Modal davranışı

- Oyunlar **12-lik səhifələrlə** gəlir; "Daha çox oyun göstər" eyni sorğunu
  `&offset=` ilə təkrarlayır (`take: PAGE+1` → COUNT sorğusu yoxdur).
  `offset > 0` olanda servis/streaming budaqları **ümumiyyətlə sorğulanmır**.
- Sıralamada tam oyunlar DLC/valyutadan öndədir (`productType = 'GAME'`) —
  "fifa 26" yazan istifadəçi əvvəlcə oyunu görməlidir, "FC Points 500"-ü yox.
- "Kataloqda filtrlərlə axtar" keçidi `/oyunlar?q=`-ə aparır. `GameBrowser`
  `initialQuery` alır və **sessionStorage restore-u atlanır** — köhnə filtrlər
  yeni sorğunu boşaltmasın.

# Oyun-içi kredit qiymət importu (PUBG UC)

`/pubg-uc` variantları (`ServiceProduct.type = "PUBG_UC"`) rəqib saytların qiymət
siyahısından doldurulur. Admin `/admin/pubg-uc` → **"Qiymət importu"** düyməsi.

## Fayl xəritəsi

| Qat | Fayl |
| --- | --- |
| Oyunfor parser (saf) | [lib/oyunforParser.ts](lib/oyunforParser.ts) + [scripts/oyunforParser.test.ts](scripts/oyunforParser.test.ts) |
| Bynogame parser (saf) | [lib/bynogameParser.ts](lib/bynogameParser.ts) |
| API (preview + tətbiq) | [app/api/admin/in-game-credit/route.ts](app/api/admin/in-game-credit/route.ts) |
| Admin UI | [components/admin/InGameCreditAdminClient.tsx](components/admin/InGameCreditAdminClient.tsx) |

## İki mənbə, tək format

`collectImportItems()` hər ikisini `NormalizedImportItem`-ə çevirir, ona görə
`PREVIEW_IMPORT` və `APPLY_IMPORT` mənbədən asılı deyil:

- **OYUNFOR** — admin yalnız **kateqoriya linkini** verir, HTML-i server çəkir
  (`fetchOyunforHtml`). Host allowlist `parseOyunforUrl`-dədir (SSRF).
- **BYNOGAME** — admin səhifəni Ctrl+A/Ctrl+C edib mətni yapışdırır.

Qiymət: `AZN = TRY × Settings.tryToAznRate × (1 + xeyir%/100)`.

⚠️ Parser məntiqini dəyişəndə **`npm run test:oyunfor`** işlət — fixture-lar real
səhifə markup-undan götürülüb, səhv parse = müştəriyə yanlış qiymətlə satış.

## Tələlər

- **Oyunfor-un JSON-LD-si YANILDIR.** Stokda olmayan variantlarda `availability`
  həmişə `InStock` yazır və `offers.price` **endirimsiz** qiyməti verir (16200 UC:
  JSON-LD 9540.00, DOM-dakı real qiymət 8872.20). Ona görə `parseOyunforHtml`
  bütün `<script>` bloklarını atır və yalnız `.productBox` DOM-unu oxuyur.
  Stokda olmayan blokda `addToCart`/`data-price` yoxdur — qiymət `.notranslate`-dən
  götürülür.
- **`inStock` bizim stokumuz DEYİL** — mənbənin təchizat siqnalıdır. Import bu
  sahəyə görə `isActive`-ə **toxunmur** (bizim öz `ServiceCode` e-pin stokumuz var);
  yalnız preview-də göstərilir.
- **Yeni yaradılan variant `isActive: false`** olur — şəkil yüklənənə qədər vitrində
  görünmür. Mövcud variantların şəkli/təsviri import zamanı qorunur.
- `APPLY_IMPORT` köhnə `IMPORT_FROM_TEXT` adını da qəbul edir (açıq admin tabı).
- Variantlar `metadata.amount` + `metadata.deliveryMethod` cütü ilə uyğunlaşdırılır,
  başlıqla yox — başlıq formatını dəyişsən import dublikat yaratmır.
