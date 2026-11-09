# CLAUDE.md

Honsell PS Store — Next.js (App Router) + Prisma + Postgres (local Docker, pgvector).
Öz serverində `next start` ilə işləyir (Vercel deyil). Media Cloudflare R2 → `honsell.site/cdn` proxy-si (aşağıya bax).

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

# Performans — donma qaydaları (2026-10, ölçülüb)

Sayt telefonda donurdu; səbəb JS/server DEYİL (TBT ≈ 0, TTFB 0.1–0.3s), **GPU və
ağır şəkillər** idi. Ölçmə: `/oyunlar` mobil — blur elementi 142 → 2, şəkil 5.4 MB →
2.0 MB, daimi animasiya 7 → 0. Yeni kod yazanda bunları POZMA:

- **Təkrarlanan kartda / şəkil üstündə `backdrop-blur` YOX.** Hər nişan scroll-da
  hər kadr arxasındakı şəkli yenidən bulanıqlaşdırır (kataloqda 24 kart × 6). Əvəzinə
  yarımşəffaf tünd fon (`bg-black/60`). Yapışqan/`fixed` elementdə də (navbar, alt
  menyu, Reels yazısı) — navbar-da desktop `blur(12px)`, toxunmalı cihazda
  (`@media (hover: none) and (pointer: coarse)`) blur yoxdur, fon 94% tutqundur.
- **Daimi (`infinite`) dekorativ animasiya YOX**, xüsusən `filter`/`background-position`/
  `box-shadow` animasiya edən. Navbar ikonları yalnız hover-də "pop" edir. Lazımdırsa
  yalnız `transform`/`opacity` və `ScrollAnimationManager` (`data-scroll-anim`) ilə
  ekrandan çıxanda dayansın. Köhnə `html.is-scrolling *` yaması SİLİNİB — hər scroll
  başı/sonu bütün sənədin üslubunu yenidən hesablatdırırdı; geri qaytarma.
- **PS Store qapaqları `psStoreSizedUrl(url, en)` ilə** ([lib/cdnImage.ts](lib/cdnImage.ts)):
  `image.api.playstation.com` `?w=` ilə özü ölçüləndirir (1024px/324 KB → 592px/112 KB),
  Node optimizer-inə yük yoxdur. Pillələr: 370/444/592/764. `ProductImage`-də `psWidth`.
  `GameCard`-da qapaq TƏKDİR — arxadakı `blur-xl` nüsxə silinib.
- **`public/`-a böyük fayl qoyma.** `bronze/silver/gold/diamond.svg` hər biri 2.2 MB
  idi (80px ikonun içində base64 raster), `mascote.png` 1.4 MB — indi `.webp`
  (~8–10 KB). Köhnə fayllar qalıb, kod onları yükləmir.
- **Saniyəlik taymer üçün `useSecondTicker`** ([lib/useSecondTicker.ts](lib/useSecondTicker.ts)) —
  bütün səhifəyə TƏK `setInterval`; hər kartın öz taymeri olmasın.
- Skeleton (`honsell-img-skeleton`) `opacity` nəbzidir, `background-position` yox.

# Mağaza əhatəsi — YALNIZ PlayStation (2026-10)

Tək mənbə: [lib/storeScope.ts](lib/storeScope.ts) (client-safe, saf). Satılan:
PS oyunları (`Game.store = "PS"`), `PS_PLUS`, `EA_PLAY`, `TRY_BALANCE`,
`ACCOUNT_CREATION` (TR PSN hesabı), Spotify Premium (`PLATFORM` + `metadata.musicBrand
= "SPOTIFY"`, sifariş CRM-ə gedir — `lib/crmSpotify.ts`), Netflix (`STREAMING` +
`metadata.service` ∈ `NETFLIX_SERVICE_CODES`, sifariş CRM-ə gedir — `lib/crmNetflix.ts`,
`/streaming/netflix` iki seçimlidir: öz hesabına plan (hesabı var/yoxdur, e-poçt + şifrə) və ya
bizim hesabda otaq (`NetflixCabinetPicker`: paket + 1/2 nəfər + müddət, hər nəfərə ayrıca otaq;
qiymət `metadata.seats` üzrə ayrıca paketdir); lokal test datası `npm run seed:netflix-mock`). Qalan kateqoriyaların
**səhifələri silinməyib** — sadəcə landing/naviqasiya/axtarışdan keçid yoxdur və satılmır.

**Tamamilə silinib (2026-10, kod yoxdur, cədvəllər `/// ARXİV` kimi qalır):** Epic
(kataloq, scraper, Epic hesabları, səbətdə Epic axını), Süni İntellekt kataloqu (`/ai`),
Website Xidməti (`/xidmetler`), Oyun paketləri (`GameBundle`, `/paket`), Streaming Banner
(`StreamingFeatured`). Köhnə URL-lər `next.config.mjs` `redirects()` ilə `/`-ə gedir.
Köhnə AI / Epic hesab açma sifarişləri üçün admin tab-ı yalnız data olduqda görünür.

Süzgəc tətbiq olunan yerlər: header kateqoriyaları (`SiteHeaderServer` + `SiteHeader`),
footer, ana səhifə (abunəlik matrisi, flash deal, bannerlər — banner
`linkUrl`-i `isOpenStorePath` ilə), `isServiceBundleSellable`,
navbar axtarışı, reels SERVICE CTA-sı, `/api/cart/refresh` (`missing` → səbətdən
silinir), `/api/cart/checkout` (kataloq sorğusunda süzülür → 409), birbaşa alış
endpoint-ləri (`/api/services/checkout`, `/api/games/[id]/purchase`).

⚠️ Yeni satış yolu / vitrin bloku əlavə edəndə `isSellableServiceType` /
`sellableGameWhere()` tətbiq et. Geri açmaq: `NEXT_PUBLIC_STORE_SCOPE=ALL` + `next build`.

# Streaming abunəlikləri — Şəxsi / Paylaşımlı hesab (2026-11)

Tək mənbə: [lib/streamingAccess.ts](lib/streamingAccess.ts) (client-safe). Admin: [/admin/streaming](app/admin/streaming/StreamingAdminClient.tsx)
— xidmət → **Şəxsi hesab** (`PERSONAL`, müştərinin öz hesabı, alışda e-poçt + şifrə) / **Paylaşımlı hesab**
(`SHARED`, bizim hesabda otaq, `StreamingStock`) → plan → qiymət cədvəli (müddət × nəfər).

- **Plan = ayrıca `StreamingPlatform` sətri**: `parentCode` (üst xidmət), `accessMode`, `tierName`, `features`,
  `devices`/`vpnRequired`. Kod/slug serverdə qurulur: `HBO_MAX_PAYLASIMLI_STANDART` / `hbo-max-paylasimli-standart`.
- **Admin API plan məlumatını paket metadata-sına köçürür** (`accessMode`, `groupCode`, `storeSellable`,
  `deliveryMode`) — checkout/səbət/satış əhatəsi DB-yə getmədən SİNXRON qərar verir. Paketi admin API-dən
  kənarda yaradırsan (seed), bu sahələri özün yaz.
- **Satış**: üst xidmətin "Saytda satılır" açarı (`StreamingPlatform.storeSellable`) → paketlərə `storeSellable: true`
  → `isSellableServiceProduct` / `sellableServiceWhere`. Netflix koda görə həmişə açıqdır, bayraqdan asılı deyil.
- **Qiymət cədvəli boş xana = satışdan çıxır** (`isActive=false`), paket SİLİNMİR (sifariş tarixçəsi).
- **Vitrin**: `/streaming/<xidmət>` — iki rejim varsa seçim ekranı, `?secim=sexsi|paylasimli` (+`&paket=`).
  Plan slug-ı üst xidmətə yönləndirir. Ana səhifədə hər xidmətə tək "ayda X ₼-dan" kartı.
- **Netflix kilidlidir** (`isLockedStreamingGroup`): vitrini koddadır (`lib/streamingGroups.ts`), planları CRM
  xəritəsinə bağlıdır (`lib/crmNetflix.ts`) — admin plan əlavə/silə bilməz, yalnız qiymət/cihaz/stok.
  DB sütunları boş olsa da `resolvePlatformGroup` Netflix kodlarını tanıyır.
- ⚠️ **Netflix olmayan sifarişlər CRM-ə getmir** — `/admin/orders`-da əl ilə təsdiqlənir; şəxsi hesab
  sifarişində müştərinin e-poçtu və şifrəsi orada görünür.
- Test: `npm run test:netflix` (əhatə, rejim, kod/slug, bulletlər).

# Minimum sifariş məbləği

[lib/cartLimits.ts](lib/cartLimits.ts) → `MIN_ORDER_AZN` (hazırda **20**). **Yalnız PlayStation
məhsullarına** tətbiq olunur (2026-11): səbətin **kupondan əvvəlki PS hissəsi** 0-dan böyük, amma
bundan azdırsa checkout **bütün** ödəniş üsullarında bloklanır (`code: "MIN_ORDER"`). Birbaşa
alış endpoint-ləri də eyni qaydanı yoxlayır.

- **Abunəliklər azaddır** — `MIN_ORDER_EXEMPT_TYPES` = `STREAMING` (Netflix, HBO Max) + `PLATFORM`
  (Spotify, YouTube). Tək Netflix/Spotify alına bilir, amma PS hissəsinə **sayılmır**:
  8 ₼ Netflix + 12 ₼ oyun → PS hissəsi 12 ₼ → bloklanır. Qalan hər tip (yeni tiplər də) sayılır.
- Client: `minOrderBaseCents(items)` (dəst üzvləri `serviceType` ilə ayrı sayılır); server:
  açılmış sətirlərin `kind`-i + hədiyyə sətirləri. İkisi eyni qaydadır — biri dəyişsə o biri də.
- Test: `npm run test:cartlimits`.
`EPOINT_MIN_CHARGE_AZN_CENTS` (5 AZN) ayrıdır — gateway limiti, round-up üçün.

UI (hamısı `minOrderProgress(minOrderBaseCents(items) / 100)` oxuyur): səbətdə minimumdan aşağı
olanda ödəniş düymələri yerinə "Daha X ₼-lik PS məhsulu seç" + izah sətri; səbətə
əlavə olunanda `CartAddedToast` (`MinOrderMeter` compact, layout-da, səbət
vəziyyətini izləyir — yeni sətir/artan say = əlavə; ayrıca çağırış lazım deyil). Səbətdə PS
məhsulu yoxdursa toast-da sayğac göstərilmir.
Header səbət düyməsi (`CartIndicator`) yalnız say göstərir — halqa/animasiya yoxdur.

# Səbət xidmət haqqı — 3% (2026-11)

[lib/cartServiceFee.ts](lib/cartServiceFee.ts) → `CART_SERVICE_FEE_PCT` / `cartServiceFeeCents()`
(saf, client-safe). Kupondan **sonrakı** səbət cəminin üstünə **bütün** səbət ödəniş
üsullarında gəlir: kart, Apple/Google Pay, taksit (Epoint faizi baza+haqq üstünə), cüzdan,
referal. Cüzdan istisna olsaydı müştəri cüzdanı komissiyasız artırıb yayınardı.

- Server: `payableCents = discountedTotalCents + serviceFeeCents` ([checkout/route.ts](app/api/cart/checkout/route.ts)).
  Kartda `Transaction.amountAznCents`-ə və Epoint-ə gedir (`metadata.checkout.serviceFeeCents`);
  cüzdan/referalda balansdan tutulur + ayrıca `SERVICE_FEE` Transaction (mənfi məbləğ) yazılır.
- **Fulfillment, cashback, bonus, min sifariş, attribution** haqqsız `discountedTotalCents` ilədir.
- UI: [CartView](components/CartView.tsx) "Komissiya (3%)" sətri + Yekun; [InstallmentHint](components/InstallmentHint.tsx) aylığı haqq daxil göstərir.
- ⚠️ Birbaşa alış endpoint-ləri (`/api/services/checkout`, `/api/games/[id]/purchase`) və cüzdan artırma haqq **tutmur**.

# Oyun qiyməti — pillələr + custom (2026-10)

Tək mənbə: [lib/gameMargin.ts](lib/gameMargin.ts) (saf, client-safe) → `gameTryCentsToAzn` /
`computeDisplayPrice` ([lib/pricing.ts](lib/pricing.ts)). Testlər: `npm run test:gamemargin`.

- **Pillələr mayaya görə** (`TRY × məzənnə`): `Settings.gameMarginTiers` Json, məs. ≤20 ₼ → 50%,
  ≤100 ₼ → 20%, daha baha → 10%. `null`/boş → köhnə tək faiz `profitMarginGamesPct`.
  Admin: `/admin/settings` → "Oyunlar — qiymətə görə pillələr" (canlı önizləmə ilə).
- **Döşəmə qaydası:** qiymət əvvəlki pillənin tavanından aşağı düşmür (maya 20.01 → 30 ₼, 24.01 yox).
  Funksiya MONOTONDUR — `aznToTryCents` (kataloq qiymət süzgəci) binar axtarışla buna güvənir.
  Sadə "pillə × maya" yazma: sərhəddə bahalı oyun ucuzdan ucuz satılır.
- **Oyuna xüsusi:** `Game.customPriceAznCents` (sabit, PS endirimi işləmir) > `Game.customMarginPct` >
  pillələr. Admin: `/admin/games` → "Qiymət" sütunu (+ "Custom" filtri), API `/api/admin/games/[id]/pricing`.
- ⚠️ `computeDisplayPrice` game tipində `customMarginPct`/`customPriceAznCents` **məcburidir** — yeni
  `select`/raw SQL yazanda hər ikisini çək, yoxsa kataloq və checkout fərqli qiymət göstərər (tsc tutur,
  amma raw SQL `as`-cast-ı tutmur).
- `discountPct` artıq **AZN-dən** hesablanır (`1 − final/original`), TRY-dan yox — pillələrdə tam və
  endirimli qiymət fərqli faizə düşə bilər.
- Custom qiymətli oyunlar SQL qiymət süzgəcində/sıralamasında avto qiymətlə yaxınlaşdırılır (kiçik
  qeyri-dəqiqlik, qəbul edilib).

# Səbət — minimal (2026-10)

Səbətdə YALNIZ: məhsul sətirləri, yekun (endirim varsa Məhsullar/Endirim sətirləri),
"Endirim kodun var?" linki (kupon qutusu bağlı gəlir), çatdırılma üçün lazım olan
seçimlər (PSN hesabı, kredensial "Redaktə"-ləri) və ödəniş düymələri. Bonuslar,
"Niyə Honsell?", cashback bloku və "Bunları da bəyənə bilərsən" qəsdən çıxarılıb —
yeni blok əlavə etmə; bonuslar serverdə (`lib/checkoutBonuses.ts`) yenə verilir.

**Məhsul şərtləri səbətdə göstərilmir.** İlk ödəniş cəhdində bir dəfəlik modal
([components/cart/ProductTermsConsent.tsx](components/cart/ProductTermsConsent.tsx))
bütün şərtləri (`listProductTerms`, mağaza əhatəsinə görə süzülmüş) göstərir, qəbul
`localStorage["honsell.productTermsAccepted.v1"]`-də saxlanır. Şərt mətni ciddi
dəyişəndə açar versiyasını artır. ⚠️ Qəbul cihaz səviyyəsindədir və server onu
yoxlamır (əvvəl də yoxlamırdı).

# Taksit (Epoint installment)

Səbətdə "Kartla ödə"-nin altında bağlı "Taksitlə ödə" düyməsi (kart + ay seçimi, hər
müddətin yanında "+N%" və aylıq), oyun və PS Plus səhifələrində "Taksitlə ayda X ₼-dan".

**Epoint komissiyası MÜŞTƏRİYƏ yansıdılır** ("dəqiq örtük"): `installmentChargeCents`
= `base / (1 − faiz)` — Epoint faizi tam məbləğdən tutur, ona görə 20% → müştəriyə
+25%, mağazaya düz `base` qalır. Sadə `base × (1 + faiz)` YAZMA (26%-də ~7% itki).
Faiz cədvəli [lib/installmentRates.ts](lib/installmentRates.ts) — kabinetdəki "Taksit
parametrləri"-nin surətidir, API faiz qaytarmır. **Kabinetdə faiz dəyişəndə bu faylı
yenilə.** Cədvəldə olmayan kart/ay müştəriyə göstərilmir (zərərinə satış olmasın).
Admin UI yoxdur — `.env`-dəki `DATABASE_URL` Supabase-ə baxırdı, miqrasiya edilmədi.

| Qat | Fayl |
| --- | --- |
| Komissiya cədvəli | [lib/installmentRates.ts](lib/installmentRates.ts) |
| Client-safe tip + riyaziyyat + parse | [lib/installmentsShared.ts](lib/installmentsShared.ts) + [scripts/installments.test.ts](scripts/installments.test.ts) — `npm run test:installments` |
| Epoint sorğuları | `fetchEpointInstallmentOptions`, `createEpointInstallment` ([lib/epoint.ts](lib/epoint.ts)) |
| Təklif + 10 dəq keş | [lib/installments.ts](lib/installments.ts) → `GET /api/cart/installments?amount=` |
| Ödəniş | `paymentMethod: "epoint-installment"` + `installmentCardId` + `installmentMonths` ([checkout/route.ts](app/api/cart/checkout/route.ts)) |
| UI | [InstallmentPicker](components/cart/InstallmentPicker.tsx), [InstallmentHint](components/InstallmentHint.tsx) |

**Açma (runtime env, rebuild lazım deyil):** `EPOINT_INSTALLMENT_ENABLED=1`,
`EPOINT_INSTALLMENT_MIN_AZN` (default 50). Söndürülübsə UI heç nə göstərmir.

⚠️ **Real cavab sənəddəki kimi massiv DEYİL** — `{"1": {name, installment_card_id: 1,
installment_months: [...]}, "trace_id": "…"}`. 2026-10-25: BirKart(1), TamKart(2),
BolKart(3) açıq; YapiKredi(4) ay siyahısı boşdur → göstərilmir.

⚠️ Checkout-da `payCents` (komissiya daxil) `Transaction.amountAznCents`-ə və Epoint-ə
gedir; `topUpCents` (min 5 AZN round-up → cüzdan) ondan **asılı deyil** — komissiya
cüzdana kredit kimi qayıtmamalıdır. Fulfillment/cashback `checkout.totalCents` ilədir;
komissiya `metadata.epoint.installment.feeCents`-dədir.

⚠️ Kart/ay seçimi serverdə Epoint təklifinə qarşı **yenidən yoxlanılır** (min məbləğ də).
Taksit endpoint-i `result_url` qəbul etmir — callback widget kimi kabinetdəki `/result`-a
gəlir, `order_id` = `Transaction.id`, fulfillment adi kart yolu ilədir.

⚠️ `/result` və `/reconcile` **məbləği dəqiq yoxlayır** (`AMOUNT_MISMATCH` → FAILED).
Gözlənilən = `payCents`. Epoint callback-də başqa məbləğ (məs. komissiyası çıxılmış)
göndərsə ödənilmiş sifariş FAILED görünər — ilk real taksit ödənişində yoxla.

# Media (R2) — öz proxy-miz `/cdn/<key>`

`cdn.honsell.store` domeni bitib, `honsell.site` isə **Namecheap DNS**-dədir
(Cloudflare yox) → R2 custom domain bağlana bilmir. Şəkil/video
[app/cdn/[...key]/route.ts](app/cdn/[...key]/route.ts) ilə S3 API-dən ötürülür
(`immutable` keş, Range/206, ETag/304).

**Əl ilə addım lazım deyil:**
- [lib/mediaUrl.ts](lib/mediaUrl.ts) `mediaPublicBase()` — env boşdursa və ya köhnə
  host-u göstərirsə yeni yükləmələr avtomatik `https://honsell.site/cdn`-ə yazılır.
- Köhnə DB linkləri `20261015000000_media_host_proxy` miqrasiyası ilə düzəlir
  (deploy.yml onsuz da `migrate deploy` işlədir; bütün mətn/massiv/json sütunları).
- `normalizeMediaUrl()` (`cdnImageUrl` → `ProductImage`) render vaxtı sığortadır.
- `npm run fix:mediahost` yalnız gələcəkdə host yenidən dəyişərsə lazımdır.

⚠️ `student-cards/` proxy-də **bloklanır** — private sənədlər yalnız signed URL ilə.
Yeni private prefiks əlavə etsən `PRIVATE_PREFIXES`-ə də yaz.

Uzunmüddətli: `honsell.site` zonasını Cloudflare-ə köçürüb `cdn.honsell.site`-ı R2
custom domain etmək (Node prosesi media ötürməkdən azad olur) → env + `fix:mediahost -- --to=`.

---

# Xidmət dəstləri (ServiceBundle — abunəlik dəstləri)

Bir neçə **xidməti** sərfəli qiymətə bir dəst kimi satır: "Netflix + HBO Max",
"Prime Video + Spotify", "Disney+ reklamlı + VPN". Müştəri dəsti **tək toxunuşla**
səbətə atır, səbətdə **atomik tək sətir** görür.

Bəzi üzvlər müştəri məlumatı tələb edir (Spotify Family → 5 email+şifrə, YouTube →
gmail+şifrə, Netflix VVIP → e-poçt) — bu, dəst sisteminin əsas çətinliyidir.

## Fayl xəritəsi

| Qat | Fayl |
| --- | --- |
| Client-safe tip + tələb məntiqi | [lib/serviceBundleShared.ts](lib/serviceBundleShared.ts) |
| Server (DB + qiymət) | [lib/serviceBundles.ts](lib/serviceBundles.ts) |
| Ana səhifə rail | [components/HomeServiceBundles.tsx](components/HomeServiceBundles.tsx) |
| Səbətdə üzv redaktəsi | [components/ServiceBundleMemberEditModal.tsx](components/ServiceBundleMemberEditModal.tsx) |
| Admin UI | [app/admin/service-bundles/ServiceBundlesAdminClient.tsx](app/admin/service-bundles/ServiceBundlesAdminClient.tsx) |
| Admin API | [app/api/admin/service-bundles/route.ts](app/api/admin/service-bundles/route.ts) |

## Data modeli ([prisma/schema.prisma](prisma/schema.prisma) ~765)

- **`ServiceBundle`** — `slug`, `title/subtitle/description`, `imageUrl` (boşdursa üzv
  şəkillərindən kollaj), `badgeText`, `isActive/isFeatured/sortOrder`, `startsAt/endsAt`.
- **`ServiceBundleItem`** — `@@id([bundleId, serviceProductId])`, `position`,
  `priceAznCents Int?` (`null` → xidmətin adi qiyməti).
- **Qiymət rejimi YALNIZ CUSTOM-dur** — `pricingMode`/`discountPct` sütunları YOXDUR.
  Üzvlərin sayı azdır və qiymətlər əl ilə tənzimlənir.

## Qiymət

`computeServiceBundlePricing` — list qiymət birbaşa `ServiceProduct.priceAznCents`-dir.
Xidmətlərdə `computeDisplayPrice`/flash deal **yoxdur** (oyunlardan fərq budur).
Override **yalnız aşağı sala bilər** (`Math.min(item.priceAznCents, list)`).

## "Dəst açılışı" — ƏN VACİB QAYDA

Checkout-da `SERVICE_BUNDLE` adlı **fulfillment budağı YOXDUR**. Səbətdəki dəst sətri
serverdə **sintetik payload-lara** açılır və mövcud per-type budaqlardan keçir:

```
Səbətdə:   [SERVICE_BUNDLE — 22.00₼]                    ← müştəri 1 sətir görür
Checkout:  [STREAMING netflix 12₼ bundleId=abc] [PLATFORM spotify 10₼ …]
```

Açılış `expandedPayloads` massivində baş verir ([checkout/route.ts](app/api/cart/checkout/route.ts)
~324) və **`services` sorğusundan ƏVVƏL** olmalıdır — üzv id-ləri həmin sorğuya düşməlidir.
Sonra `services.find(...)` sətrindən dərhal sonra hesablanan `unitListCents` bütün
budaqlarda `service.priceAznCents`-i əvəz edir.

Beləcə Spotify-ın `accountSlots` validasiyası, Netflix-in `deliveryMode` məntiqi,
`Subscription` yaradılması, komissiya və admin təsdiqi **dəyişmir**.

⚠️ **`games.length + services.length !== payloads.length` yoxlaması SİLİNİB.** O, say
müqayisəsi idi və paket/dəst id-si heç bir kataloq cədvəlində olmadığı üçün **səbətdə
paket olan hər checkout-u 409-a salırdı** (yəni oyun paketləri də satıla bilmirdi).
İndi `resolvedIds` çoxluğu üzərində yoxlama var — eyni məhsulun həm adi, həm hədiyyə
sətri olan səbəti də sındırmır (Prisma `id: { in: ids }` nəticəsini dedupe edir).

## Müştəri məlumatları (kredensiallar)

**`serviceInputRequirement(product)`** ([lib/serviceBundleShared.ts](lib/serviceBundleShared.ts))
— SAF funksiya, `NONE | EMAIL | EMAIL_PASSWORD | ACCOUNTS` qaytarır.
⚠️ Məntiqi checkout-dakı STREAMING/PLATFORM budaqları ilə **eyni** olmalıdır (yoxlama
sırası da: əvvəl `accountSlots`, sonra kredensial tələbi).

Toplama **səbətdə** olur (detal səhifəsi yoxdur): dəst sətrinin içində hər üzvün yanında
"Redaktə" düyməsi. Doldurulmayıbsa qırmızı nişan + checkout bloklanır.
`validateServiceBundleMemberDetails` **hər iki tərəfdə** (modal + səbət bloklaması)
işlədilir.

Məlumat `CartItem.serviceBundleItems[].details`-də saxlanılır və checkout-a
`serviceBundle: { [serviceProductId]: details }` kimi göndərilir.

## Tələlər / bilinməli məqamlar

- **Detal səhifəsi YOXDUR** — rail kartı birbaşa səbətə atır. `slug` sütunu var, gələcəkdə
  `/xidmet-paket/<slug>` əlavə edilə bilər.
- **Deaktiv xidmət → dəst tamamilə gizlənir** (`isServiceBundleSellable`).
- **`ACCOUNT_CREATION` / `EPIC_ACCOUNT_CREATION` / `HONSELL_GIFT_CARD` dəstə salına
  bilməz** (`SERVICE_BUNDLE_EXCLUDED_TYPES`) — hesab açılışı onsuz da başqa məhsulun ön
  şərtidir, endirimli hədiyyə kartı isə pul çap etməkdir. **Qalan bütün tiplər icazəlidir**,
  yəni yeni tip (məs. VPN) əlavə olunanda dəst sistemi onu avtomatik qəbul edir.
- **Kupon dəstə düşmür** — `checkout/route.ts`-dəki `scopeItems` (`serviceBundleId` olan
  sətirlər atılır) və `/api/cart/coupon` preview-i (`SERVICE_BUNDLE_PRODUCT_TYPE`).
  Biri unudulsa müştəri preview-də bir rəqəm görür, kassada `COUPON_INVALID` alır.
- **Dəst hədiyyə olunmur** — checkout `isGift` gələn dəst sətrini buraxır.
- **`/api/cart/refresh` tərkibi də qaytarır** (`serviceBundles` sahəsi) — admin dəsti
  dəyişəndə səbətdəki snapshot özünü yeniləyir, amma müştərinin doldurduğu `details`
  `serviceProductId` üzrə **köçürülür** (yoxsa hər refresh formu sıfırlayardı).
- **Səbətdə `add()` replace budağındadır** (`STREAMING`/`PLATFORM` kimi) — sətir müştəri
  məlumatı daşıyır, təkrar əlavə onu təzələməlidir. Qty həmişə 1.
- **PSN tələbi** — dəstdə `PS_PLUS`/`EA_PLAY`/`TRY_BALANCE` üzvü varsa `deliveryNeedsPsn`
  UI-də də tetiklənir ([CartView.tsx](components/CartView.tsx)).
- **İkiqat fulfillment yolu** — cüzdan ([checkout/route.ts](app/api/cart/checkout/route.ts))
  və kart ([lib/epointCartCheckout.ts](lib/epointCartCheckout.ts)) ayrıdır; damğa
  (`serviceBundleId`/`serviceBundleTitle`) **hər ikisinə** yazılır.
- **Komissiya endirimli məbləğdən** yazılır — açılmış sətrin `amountAznCents`-i dəst
  qiymətidir, admin təsdiqi vaxtı `awardStreamingReferralCommission` onu götürür.
- **Yeni tab lazım deyil** — açılmış sətirlər adi `SERVICE_PURCHASE` sətirləridir və
  `/admin/orders`-un mövcud səbətlərinə düşür; başlıqda `📦 <dəst adı> → <xidmət>` görünür.
- `revalidateServices()` və `revalidateStreaming()` **`"service-bundles"` tag-ını da**
  sıfırlayır — dəstin üstündən xətlənmiş list qiyməti xidmətin öz qiymətindən gəlir.

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
| Kateqoriya çipi + vərəq | [components/reels/ReelCategoryChip.tsx](components/reels/ReelCategoryChip.tsx) + [ReelCategoryGate.tsx](components/reels/ReelCategoryGate.tsx) |
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

Sürümlər feed-ə **ucuzdan bahaya** sıralı gəlir və kart `[0]`-ı göstərir — sıralama
kosmetika deyil, MƏHSUL QƏRARIDIR: müştəri ən ucuzu axtarmadan görməlidir.

### ⚠️ Kartda YALNIZ ƏN UCUZ SÜRÜM göstərilir

`ReelBuyPanel` bir vaxtlar sürüm çipləri sırası idi (2–4 çip, hər biri öz qiyməti ilə).
Feed-də sürətlə sürüşdürülən video altında bu, müştəridən **qərar tələb edirdi** və
kartı üç sətir uzadırdı. İndi kart `editions[0]`-ı götürür — sıralama onsuz da
ucuzdan bahayadır, yəni müştəri ən sərfəli variantı seçim etmədən görür.

Kart tərkibi: kaver + oyun adı + sürüm adı + qiymət (+ köhnə qiymət və `−N%`) +
platforma çipi + "Səbətə əlavə et".

⚠️ `Reel.editionGameIds` **hələ də lazımdır** — ən ucuzu tapmaq üçün siyahı olmalıdır,
sadəcə hamısı GÖSTƏRİLMİR. Tam sürüm siyahısı məhsul səhifəsindədir.

⚠️ Kart varkən videonun `title`-ı **gizlədilir** — oyun reels-ində `title` onsuz da
oyunun adı ilə dolur və kartın başlığı ilə eyni olur.

⚠️ Platforma yalnız **bir yerdə** yazılır (aşağıdakı çipdə), sürüm sətrində təkrarlanmır.

### Sürüm siyahısının təmizliyi

İki süzgəc **hər iki qatda** tətbiq olunur, çünki mənbəni düzəltmək köhnə sətirləri
düzəltmir:

1. **PC sətirləri atılır** — `store` "PS" olsa da `platform` "PC" ola bilir (idxal
   qalıqları) və feed-də PC çipi kimi görünürdü.
   `findEditionCandidates` (mənbə: admin siyahısı + Telegram avto-doldurma) **və**
   [lib/reels.ts](lib/reels.ts)-dəki `editions` qurulması (mövcud `editionGameIds`-də PC
   id-si artıq yazılıb qalıb).

   ⚠️ Süzgəc **JS-dədir, SQL-də yox** — `platform: { not: "PC" }` yazsan `NULL != 'PC'`
   → `NULL` olduğu üçün platforması boş sətirlər də süzülüb atılar (feed-də mövcud
   `store` süzgəci tələsinin eynisi).

2. **`dedupeEditions()`** ([lib/gameEditions.ts](lib/gameEditions.ts), SAF) — eyni
   `editionName|platform|finalAzn` təkrarını atır; **əlavə olaraq** platforması boş olan
   sətri, eyni ad+qiymətli və platforması DOLU sətir varsa atır ("etiketsiz dublikat").
   Real **PS4/PS5 fərqi qorunur** — hər ikisinin platforması dolu olduğu üçün ayrı qalır.

⚠️ Süzgəclərdən sonra siyahı boşalarsa əsas məhsul tək sürüm kimi saxlanılır — panel
tamamilə yox olmasın.

⚠️ Dəyişəndə **`npm run test:editions`** işlət (dedupe testləri də oradadır).

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

Kod düzəldi, amma **köhnə sətirlər qaldı** — onlar üçün bir dəfəlik təmizləyici var:
`npm run clean:reeltitles` ([scripts/cleanReelTitles.ts](scripts/cleanReelTitles.ts),
`--dry-run` dəstəkləyir, idempotentdir). Başlıq `""` olur, `null` yox — sütun nullable
deyil.

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

## "Saxla" (düyməsi HAZIRDA GİZLİDİR — mexanizm qalır)

⚠️ **Rail-də saxla düyməsi YOXDUR** (ekran büdcəsi qərarı, yuxarıdakı bölməyə bax).
Aşağıdakı mexanizmin hamısı işlək qalır və `SAVED` feed-i onu oxuyur; sadəcə **yazan
düymə yoxdur**, yəni yeni `ReelBookmark` yaranmır. Geri qaytarmaq = rail-ə düymə əlavə
etmək (`useReelInteractions().toggleSave` hazırdır).

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
üzrə — istifadəçi hansı sürümü saxlayıbsa reel yenə çıxsın). Düymə gizli olduğu üçün
praktikada **yalnız favorit oyun** qolu dolur.

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

## Ekran büdcəsi (ƏN VACİB UX QAYDASI)

Feed bir dəfə 12 interaktiv elementə çatmışdı və hamısı ağ **"Səbətə at"** düyməsi ilə
yarışırdı. İndi **6**-dır. Yeni düymə əlavə edəndə bunu POZMA — nə isə əlavə edirsənsə,
nəyi çıxardığını da de.

| Yer | Nə var |
| --- | --- |
| Sol üst | home |
| Üst mərkəz | kateqoriya çipi (`Oyunlar ▾`) + "Saxladıqlarım" düyməsi |
| Sağ üst | səs |
| Sağ rail | bəyən, rəy yaz, paylaş — ikon + etiket + **say yalnız `> 0` olanda** |
| Alt | məhsul kartı (kaver + ad + qiymət + səbət) |

**Rail-dən qəsdən çıxarılanlar:** dislike (sıralama ona baxmır — `lib/reelRanking.ts`
yalnız `createdAt`+seed işlədir; ticarət feed-ində mənfi siqnal yersizdir), baxış sayı
(kiçik rəqəm məhsulun boş olduğunu elan edir → ZƏRƏR verir), "Saxla", səs.

⚠️ **API-lər silinməyib.** `react(-1)`, `toggleSave`, `POST /api/reels/[id]/bookmark`,
`ReelReaction`/`ReelBookmark` cədvəlləri və `/api/reels/state`-in `saved` sahəsi qalır —
sadəcə onları çağıran düymə yoxdur. Geri qaytarmaq bir düymədir və mövcud data itmir.

⚠️ **"Saxla"-nın silinməsinin nəticəsi:** `ReelBookmark`-a yazan YEGANƏ yol o düymə idi.
Yəni **film/serial artıq saxlanıla bilmir**; `SAVED` feed-i praktikada yalnız favorit
oyunlara aid reels ilə dolur (favorit məhsul səhifəsindən əlavə olunur). Film tərəfini
geri istəyirsənsə rail-ə düyməni qaytarmaq kifayətdir.

⚠️ İki rail **eyni düymə dəstini** göstərməlidir — fərqli olsalar istifadəçi cihaz
dəyişəndə funksiya itirdiyini sanır.

## Kateqoriya çipi + seçim vərəqi

Üstdə 4 tab-lıq sətir yox, **tək çip** var: `🎮 Oyun ▾` (film rejimində aktiv platforma
da yazılır: `🎬 Film & Serial · Netflix ▾`). Kateqoriya gündəlik dəyişilən şey deyil —
bir dəfə seçilir və `localStorage`-da qalır, ona görə daimi sətir yer israfı idi.

[ReelCategoryGate.tsx](components/reels/ReelCategoryGate.tsx) **İKİ rolda** işlədilir və
fərq `onClose` prop-undan bilinir:

| Rol | `onClose` | Davranış |
| --- | --- | --- |
| İlk giriş qapısı | **verilmir** | bağlana bilmir — seçim məcburidir |
| Çipdən açılan vərəq | verilir | X + fon toxunuşu ilə bağlanır, hazırkı seçim ✓ ilə işarəli |

⚠️ **"Saxladıqlarım" vərəqdə YOXDUR** — çipin yanında öz düyməsi var (toggle: SAVED-də
ikən basmaq əvvəlki feed-ə qaytarır, `previousCategoryRef`). Səbəb: saxlanmış siyahıya
baxmaq tez-tez edilən hərəkətdir, kateqoriya isə bir dəfə seçilir — ikisi eyni menyuda
olmamalıdır.

⚠️ İlk girişdə vərəq bağlana bilməməlidir: seçim həll olunana qədər feed ümumiyyətlə
render olunmur (SSR-də hansısa kateqoriyanı göstərsək qayıdan istifadəçi bir an yanlış
feed-i görür — SSR HTML hidrasiyadan ƏVVƏL paint olunur).

⚠️ "Saxladıqlarım" **ilk girişdə göstərilmir** — istifadəçinin hələ heç nəyi yoxdur,
boş feed ilə qarşılaşardı.

Platforma süzgəci də vərəqin içindədir (əvvəl üst sətirdə idi) — süzgəc süzgəcin yanında
olsun deyə. Gizli qalmasın deyə **aktiv platforma çipin yazısına düşür**.

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
                     ├─ 🎮 Oyun → "Oyunun adını yaz" → mətn → oyun düymələri
                     │            → sürümlər AVTO doldurulur → yayım
                     │            └─ 🕹️ "Oyunsuz yayımla" ────┐
                     └─ 🕹️ Ümumi (məhsulsuz) ─────────────────┴→ CTA-sız yayım
```

## "Ümumi oyun məzmunu" (məhsulsuz reel)

Hər video konkret oyunun reklamı deyil — setup turu, konsol müqayisəsi, məzəli an,
kanal anonsu. Əvvəllər yeganə yol oyun seçmək idi: admin ya **səhv oyun bağlayırdı**,
ya da qaralama asılı qalırdı (`tgStage` mətn gözləyən halda).

İndi çıxış **iki yerdə** var və hər ikisi eyni callback-ə (`rk|<reelId>|X`) gedir:
növ sualında ayrıca düymə, və oyun axtarışının hər nəticəsində (siyahı gələndə də,
`0 nəticə` olanda da) "🕹️ Oyunsuz yayımla" sətri.

**Necə saxlanılır:** `category: "GAME"` + `ctaType: "URL"` + `ctaHref: null` = **CTA
yoxdur**. Ayrıca bayraq LAZIM DEYİL — feed bunu onsuz da düzgün oxuyur: `lib/reels.ts`
məhsulu boş qoyur, `hasBuyPanel` false olur, rail-dəki səbət düyməsi `product || href`
şərti ilə gizlənir. Kart olmadığı üçün videonun başlığı **görünür** (kart varkən gizlənir).

⚠️ Bu budaqda `tgStage` mütləq sıfırlanır — istifadəçi əvvəl "🎮 Oyun" basıb, sonra
fikrini dəyişib bu düyməyə basa bilər; qaralama mətn gözləyən qalsa növbəti yazdığı söz
yenidən oyun axtarışı kimi oxunardı.

Admin paneldən də eyni şey alınır: CTA tipi `URL`, link xanası **boş** (admin API-si
`ctaHref`-i məcbur etmir).

Callback formatları (limit **64 bayt**, cuid = 25 simvol):

| Prefiks | Format | Uzunluq |
| --- | --- | --- |
| `rk` | `rk\|<reelId>\|G⎮S⎮X` — növ seçimi (`X` = məhsulsuz) | 30 |
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

# Qiymət güdmə (GamePriceWatch — admin əl ilə qeyd edir)

Oyunla maraqlanan, amma **qiyməti baha görüb almayan** müştəri üçün: admin
`/admin/price-watch`-də nömrə + oyun qeyd edir, oyun **endirimə düşən kimi**
avtomatik WhatsApp mesajı gedir.

`Favorite`-dan fərqi QƏSDƏNDİR: favorit **qeydiyyatlı istifadəçi** tələb edir
(`userId` + e-poçt), güdülən müştərilərin isə əksəriyyəti WhatsApp/Instagram-dan
yazır və hesabı yoxdur. Ona görə `GamePriceWatch`-də **`userId` sütunu YOXDUR** —
telefon nömrəsi tək identifikatordur.

## Fayl xəritəsi

| Qat | Fayl |
| --- | --- |
| Client-safe tip + status məntiqi | [lib/priceWatchShared.ts](lib/priceWatchShared.ts) |
| Server (DB + göndəriş) | [lib/priceWatch.ts](lib/priceWatch.ts) |
| WhatsApp mətni | `sendPriceWatchWhatsApp` ([lib/orderNotifications.ts](lib/orderNotifications.ts)) |
| Tetikləyici | [app/api/scrape-ps-store/route.ts](app/api/scrape-ps-store/route.ts) Phase 4 |
| Admin UI | [app/admin/price-watch/PriceWatchAdminClient.tsx](app/admin/price-watch/PriceWatchAdminClient.tsx) |
| Admin API | [app/api/admin/price-watch/route.ts](app/api/admin/price-watch/route.ts) |

## Data modeli ([prisma/schema.prisma](prisma/schema.prisma) ~1850)

- **`GamePriceWatch`** — `phone` (E.164), `name?`, `gameId`, `note?`,
  `basePriceAznCents?` (qeyd anındaki qiymət möhürü), `isActive`,
  `lastNotifiedAt?`, `notifyCount`. `@@unique([phone, gameId])`.
- **`GamePriceWatchNotification`** — dedup, `@@unique([watchId, discountStartedAt])`.

## Trigger

**Yalnız endirimsiz → endirimli keçidi.** Ayrıca cron YOXDUR — qiymət yalnız
scrape-də dəyişir, ona görə mövcud favorit bildirişləri ilə **eyni yerdən**
(Phase 4, `newlyDiscounted` dövrü) tetiklənir.

Dalğa açarı `discountWaveKey()` = `discountEndAt ?? now` — `FavoriteNotification`
ilə eyni prinsip. Oyun tam qiymətə qayıdıb yenidən endirimə düşsə açar dəyişir və
müştəri **yeni mesaj alır**; eyni dalğada təkrar scrape unique constraint-ə düşür.

## Tələlər / bilinməli məqamlar

- ⚠️ **Güdmə bloku `favRows.length === 0` yoxlamasından ƏVVƏL olmalıdır.** Phase
  4-dəki dövr favorit sətri olmayan oyunu `continue` ilə atır; güdmə blokunu ondan
  sonra qoysan güdülən oyunların əksəriyyətində (favoriti olmayanlar) mesaj **heç
  vaxt getmir**. Səhv səssizdir — log-da heç nə görünmür.
- ⚠️ **Dedup sətri mesajdan ƏVVƏL yaradılır, uğursuzluqda geri alınır.** Tərsi
  (əvvəl göndər, sonra yaz) olsa yazma sınanda müştəri hər scrape-də təkrar mesaj
  alar — spam riski uğursuz göndərişdən betərdir.
- ⚠️ **`basePriceAznCents` yalnız YARADILANDA yazılır.** Admin eyni cütü təkrar
  əlavə edəndə API upsert kimi davranır, amma baza qiymətinə **toxunmur** — yoxsa
  müştərinin ilk soruşduğu (baha) qiymət itər və mesajdaki "əvvəl 62 ₼ idi"
  müqayisəsi mənasız olar.
- ⚠️ **`isOnSale` üçün `discountPct` işlədilir, `discountTryCents != null` YOX.**
  `computeDisplayPrice` bitmiş endirimi özü ləğv edir
  ([lib/pricing.ts:288](lib/pricing.ts#L288)), ona görə xam sütuna baxsan bitmiş
  endirim admin panelində "aktiv" görünər.
- **"İndi göndər"** düyməsi yalnız endirim AKTİV olanda görünür (qeyd endirim
  başladıqdan sonra yazılıbsa keçid anı qaçıb). Dedup sətrini `upsert` edir —
  admin qərarı dedup-dan üstündür, amma sonrakı scrape təkrar göndərmir.
- **Mesaj mətni favorit mesajından AYRIDIR** — bu müştəri saytda favorit
  qoymamışdır, ona "favoritinizdəki oyun" yazsan nədən danışdığımızı anlamaz.
  Əvəzinə "soruşduğunuz oyun".
- Oyun kataloqdan silinsə qeyd də gedir (`onDelete: Cascade`); oyun **deaktiv**
  olsa qeyd qalır və admin panelində "Oyun deaktiv" xəbərdarlığı görünür.
- `WASENDER_API_KEY` yoxdursa qeydlər saxlanılır, **mesaj getmir** — admin
  panelində bu, banner kimi göstərilir.

---

# Rəy linki ödəniş təsdiqi mesajında (CRM + sayt)

Müştəri ödəniş təsdiqi mesajını alanda rəy linki **eyni mesajın sonunda** gəlir, ayrıca
mesaj göndərilmir. İki ayrı mexanizm var. Onlar qəsdən birləşdirilməyib:

| Mənbə | Link | Harada |
| --- | --- | --- |
| CRM təsdiqləri (abunə uzatma, kabinet təyini, music satışı) | `/rey/<token>` (`WhatsappReviewInvite`) | `offerReviewLink` ([lib/whatsappReviewInvites.ts](lib/whatsappReviewInvites.ts)) → `POST /api/partner/review-links` |
| Sayt sifarişi təsdiqi (oyun, xidmət, Honsell gift card) | `/review/<token>` (`ReviewInvite`, sifarişə bağlı) | `issueReviewInvite` URL qaytarır → `sendOrderApprovedWhatsApp({ reviewUrl })` |

- **Sayt sifarişində yeni dəvət YARADILMIR.** Hər sifarişin onsuz da e-poçtla gedən
  `/review/` dəvəti var. WhatsApp eyni linki daşıyır, yoxsa müştəri eyni sifarişə iki
  dəfə rəy yaza bilərdi.
- **CRM limiti mağazadadır:** telefon üzrə `SUBMITTED` dəvət varsa link heç vaxt
  verilmir, yoxdursa son dəvətdən 30 gün keçməlidir (`REVIEW_LINK_COOLDOWN_DAYS`).
  Admin panelindən əl ilə göndərilən dəvət də sayılır, çünki eyni cədvəldir.
- **Məhsulsuz dəvət:** CRM məhsulu (Netflix slotu) mağaza kataloqunda yoxdur, ona görə
  dəvət `productTitle` + `platform` ilə yaranır, `products` boşdur, **satış qeydi
  yaranmır**. `/rey` verify-ı boş siyahıda heç nə yaratmır.
- `sendWhatsapp: false`: mağaza mesaj göndərmir, CRM öz mesajına əlavə edir.
- `externalRef` olan retry limitə düşmür və mövcud linki qaytarır. Bank sətri olan
  təsdiqdə açar `crm:cardTransaction:<id>`-dir, ona görə CRM-in `/bank/payments` ⭐
  statusu (köhnə əl modalı ilə eyni açar) avtomatik dolur.

# CRM → sayt hesabı sorğusu (müştəri sinxronu)

`GET /api/partner/customers?phone=<p>[&phone=<p2>]` ([route.ts](app/api/partner/customers/route.ts),
`requirePartnerKey`) — CRM müştəri səhifəsi telefona uyğun sayt hesablarını (balanslar, seqment,
sifariş sayı/xərc, son 15 alış) canlı oxuyur. Uyğunlaşma `User.phone`-un **son 9 rəqəmi** ilə,
raw SQL-də (`regexp_replace` — telefon sərbəst formatda saxlanılır, `phoneCandidates` boşluqlu
formatı tutmur). Yalnız oxumadır; cavab formasını dəyişəndə CRM-in `HonsellStoreAccount`
tipini ([psCustomer/lib/honsell-store.ts](../psCustomer/lib/honsell-store.ts)) də yenilə.

# PS Store skreypi — concept ↔ SKU (ƏN VACİB TƏLƏ)

PS Store iki fərqli obyekt qaytarır və skreyperin **hər iki mənbəyi** var:

| Mənbə | Nə qaytarır | id forması |
| --- | --- | --- |
| Kateqoriya hub-ları (`/category/<uuid>/<n>`) | **concept** (oyunun özü) | sırf rəqəm — `230079` |
| Axtarış (`/search/<q>`) | **SKU** (satıla bilən sürüm) | `EP9000-PPSA15508_00-…` |

Uzun müddət hər ikisi eyni `Game` cədvəlinə eyni cür yazılırdı. Dörd nəticə:

1. **`/tr-tr/product/<rəqəm>` 302 ilə ana səhifəyə atır** — concept yalnız
   `/tr-tr/concept/<id>`-dədir. Ölü link həm məhsul səhifəsində, həm də admin
   sifariş panelində (fulfiller-in açdığı link) görünürdü.
2. **`platform` NULL qalır** — `resolvePlatform` CUSA/PPSA koduna baxır.
   Vitrində PS4/PS5 çipi olmayan kart = concept sətridir (ayırd edici əlamət).
3. **Eyni oyun iki kart** — concept sətri + seed-dən gələn SKU sətri.
4. **Ad concept-in, qiymət default SKU-nun.** `Concept:230079` adı
   "The Last of Us™ Part II", `defaultProduct`-u isə Part II **Remastered** →
   vitrində mövcud olmayan "Part II −40%" məhsulu görünürdü. Eyni hal:
   concept "Call of Duty®" ⇒ SKU "Call of Duty®: Modern Warfare® 4".

## Həll

`Phase 2.4` ([app/api/scrape-ps-store/route.ts](app/api/scrape-ps-store/route.ts))
upsert-dən **əvvəl** hər concept-i öz SKU-suna çevirir. Qiymət/media concept qrid
sətrindən onsuz da doğrudur (concept-in qiyməti = default SKU-nun qiyməti) —
yalnız `productId`, **ad**, `platform` və `productUrl` dəyişir.

| Qat | Fayl |
| --- | --- |
| Saf parser + link qurucu | [lib/psStoreConcept.ts](lib/psStoreConcept.ts) + [scripts/psStoreConcept.test.ts](scripts/psStoreConcept.test.ts) |
| Skreyp fazası | `Phase 2.4` — [app/api/scrape-ps-store/route.ts](app/api/scrape-ps-store/route.ts) |
| Köhnə sətirlərin təmizlənməsi | [scripts/resolveConceptGames.ts](scripts/resolveConceptGames.ts) — `npm run fix:concepts` |
| Keş cədvəli | `PsStoreConcept` ([prisma/schema.prisma](prisma/schema.prisma)) |

⚠️ **`PsStoreConcept.productTitle` mütləqdir.** Yalnız `productId` keşlənsə
ikinci run-da SKU keşdən gələr, ad isə yenidən concept qridindən götürülərdi —
yəni keşin özü hətanı geri gətirərdi.

⚠️ **Faza discount-end fazasından ƏVVƏL olmalıdır** — o faza `/product/<id>`
açır və concept id-si ilə həmişə 302 alırdı (endirim bitmə tarixi heç vaxt
yazılmırdı). Eyni səbəbdən Phase 3.6 stale-refresh də concept sətirlərini
həmişə `refreshFailures`-a yazıb boş sorğu yandırırdı.

⚠️ **Çevirmə uğursuz olsa sətir OLDUĞU KİMİ qalır** — kataloqdan oyun düşməsin.
`productUrl` isə o halda da `/concept/` ilə qurulur (`psStoreProductUrl`).

⚠️ **Köhnə sətirləri SİLMƏ.** `Favorite`, `GamePriceWatch`, `LootBoxItem`,
`GameBundleItem`, `CollectionGame`, `GameReview` cascade ilə uçar,
`Transaction.gameId` isə köhnə sifarişlərdə NULL-a düşər. `fix:concepts`
dublikatı `isActive: false` edir və favorit/qiymət-izləmə sətirlərini əsl SKU
sətrinə **köçürür**; SKU kataloqda yoxdursa concept sətrinin özünü yeniləyir
(`Game.id` dəyişmir → bütün əlaqələr yerində qalır).

⚠️ Dəyişəndə **`npm run test:concept`** işlət. `npm run fix:concepts -- --dry-run`
heç nə yazmır, yalnız hesabat verir.

## Kataloq örtüyü — hub səhifə limiti

`maxPages` default-u **25**-dir və admin paneli parametr göndərmir. Səhifə
ölçüsü artıq 24 deyil, **250** (`CATEGORY_PAGE_SIZE`), yəni hub başına 6250
sətir taranır. Real hub ölçüləri: PS5 6793, PS4 9524, AllDeals 4623,
ReadySetPlay 4436, yeni oyunlar 147, PS5 Pro 281 — PS4 istisna hamısı tam
gəlir (PS4 üçün `?pages=40`).

⚠️ Səhifələmə **`pageInfo.isLast` ilə** dayanır, "bu səhifədə yeni sətir yoxdur"
ilə YOX — hub-lar üst-üstə düşür (iki endirim hub-ının ilk səhifələri eynidir)
və köhnə `pageAdded === 0` şərti hub-ı erkən kəsirdi.

API `?pages=` və `?seeds=` qəbul edir — dar bir scrape kataloqu bozmur, çünki
toxunulmayan sətirlər deaktiv edilmir.

# PS Store listinq mənbəyi — HTML DEYİL, GraphQL

**2026-08:** mağaza listinq səhifələrini (`/tr-tr/category/<uuid>/<n>`,
`/tr-tr/search/<q>`) tam client-side yükləməyə keçdi. HTML hələ gəlir,
`__NEXT_DATA__` hələ var, amma içində yalnız naviqasiya olur
(`pageProps.batarangs = {}`). Skreyper 200 OK alırdı, parse keçirdi və
**0 məhsul** çıxırdı → admin paneldəki
*"No products extracted. The PS Store markup may have changed."*

⚠️ Bu, User-Agent/başlıq məsələsi DEYİL — brauzerin tam başlıq dəsti ilə də
cavab boşdur. HTML-ə qayıtmağa çalışma.

⚠️ **Yalnız listinq qatı dəyişdi.** `/tr-tr/product/<sku>` hələ də batarang-ları,
`/tr-tr/concept/<id>` hələ də apolloState-i SSR edir — yəni
[lib/psStoreOffer.ts](lib/psStoreOffer.ts) (endirim bitmə tarixi),
[lib/psStoreConcept.ts](lib/psStoreConcept.ts) və
[lib/psStoreMetadata.ts](lib/psStoreMetadata.ts) toxunulmadı.

| Qat | Fayl |
| --- | --- |
| API client + sətir çıxarışı | [lib/psStoreListing.ts](lib/psStoreListing.ts) |
| Testlər (real fixture) | [scripts/psStoreListing.test.ts](scripts/psStoreListing.test.ts) — `npm run test:listing` |

Endpoint `https://web.np.playstation.com/api/graphql/v1/op`, GET, **cookie/auth
tələb etmir**. `x-psn-store-locale-override: tr-TR` başlığı bölgəni təyin edir.
Ölçülmüş limitlər: kateqoriya `size` 1000-ə qədər (biz 250 işlədirik), axtarış
**50**-də dayanır (100 → validation error).

## ⚠️ Persisted query hash (ƏN VACİB TƏLƏ)

Endpoint yalnız whitelist-dəki sorğuları qəbul edir — sorğu mətnini göndərmək
olmur (`{"message":"Query not whitelisted"}`), yalnız
`extensions.persistedQuery.sha256Hash`. Mağaza sorğuya bir sahə əlavə etsə hash
dəyişir və **bizim bütün listinq sorğuları 400 verir**.

Hash-i bundle-dan hesablamağa **çalışma** — apollo-nun `sortAST` + `print` +
`__typename` transformasiyasının bütün variantları sınandı, heç biri tutmadı.
İşləyən yol brauzerin öz sorğusunu tutmaqdır:

```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --user-data-dir=/tmp/psprof --log-net-log=/tmp/net.json \
  --net-log-capture-mode=IncludeSensitive --virtual-time-budget=20000 \
  --dump-dom "https://store.playstation.com/tr-tr/category/<uuid>/1" >/dev/null
grep -o 'operationName=[A-Za-z]*[^"]*sha256Hash[^"]*' /tmp/net.json
```

`categoryGridRetrieve` və `getSearchResults` sətirlərindəki hash götürülür.
Deploy gözləməmək üçün hər ikisi env ilə override oluna bilir:
`PS_STORE_GQL_CATEGORY_HASH`, `PS_STORE_GQL_SEARCH_HASH`.

Sıfır məhsul halında xəta mətni **iki yerə ayrılır** — API sorğuları uğursuz
olubsa mesaj birbaşa hash-i göstərir, yoxsa köhnə "markup" mətni yanıldırdı.

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

# Film/serial kataloqu — çoxdilli adlar və IMDb reytinqi

Streaming kataloqundakı (`StreamingTitle`) başlıqlar **türkcə, rusca, ingiliscə və
orijinal dildə** adlarını daşıyır və **həqiqi IMDb xalı** ilə göstərilir. Mənbə
IMDb-nin rəsmi datasetləridir (`datasets.imdbws.com`) — pulsuz, açar tələb etmir,
sorğu limiti yoxdur.

## Fayl xəritəsi

| Qat | Fayl |
| --- | --- |
| TSV parse + ad seçimi (saf) | [lib/imdbDatasets.ts](lib/imdbDatasets.ts) + [scripts/imdbDatasets.test.ts](scripts/imdbDatasets.test.ts) |
| İdxal runner-i | [scripts/importImdbData.ts](scripts/importImdbData.ts) — `npm run import:imdb` |
| Kataloq loader-i | [app/streaming/(scraped)/loadScrapedTitles.ts](app/streaming/(scraped)/loadScrapedTitles.ts) |
| Kart + reytinq seçimi | [components/ScrapedTitleCard.tsx](components/ScrapedTitleCard.tsx) |
| Kataloq filtri/sıralaması | [app/streaming/(scraped)/ScrapedCatalogClient.tsx](app/streaming/(scraped)/ScrapedCatalogClient.tsx) |

## Data modeli

- **`StreamingTitleName`** — `@@id([titleId, lang, name])`, `isOriginal`, `source`
  (`IMDB_AKAS` | `TMDB` | `MANUAL`). Ayrıca cədvəldir, `titleTr/titleRu` sütunları
  DEYİL: yeni dil əlavə etmək miqrasiya tələb etməsin və bir dildə birdən çox
  variant saxlana bilsin.
- **`StreamingTitle.imdbRating` / `imdbVotes`** — `title.ratings.tsv.gz`-dən.

⚠️ **`imdbRating` ilə `tmdbRating` eyni şey DEYİL.** İkincisi TMDB istifadəçilərinin
səsidir; rəqəmlər yaxın olsa da fərqli metrikdir. Vitrin IMDb-ni üstün tutur,
yoxdursa TMDB-yə düşür (`displayRating()`) — **cəmlənmir/ortalanmır**, çünki
qarışdırılmış rəqəm heç bir mənbəni təmsil etmir və istifadəçi IMDb-də yoxlayanda
başqa rəqəm görər.

## Ad seçimi (`pickNames`) — ən səhvə meyilli hissə

Bir başlığın `title.akas.tsv.gz`-də **40-a qədər** sətri olur. Hər hədəf dil üçün
`scoreAka()` ən yaxşısını seçir:

| Siqnal | Bal |
| --- | --- |
| `types` = `imdbDisplay` | **+100** |
| `language` xanası dolu | +30 |
| `types` ∈ {working, alternative, festival, video, dvd, tv} | −200 |
| `attributes` dolu ("short title" və s.) | −60 |

⚠️ **`imdbDisplay` açıq `language` xanasından AĞIR olmalıdır.** Əvvəlcə tərsi idi və
LOTR-də ingiliscə ad kimi *"The Fellowship of the Ring"* (region=XWW, "short title")
seçilirdi — tam ad isə region=US sətrində, `language` boş halda dururdu. Yəni dil
xanasının doldurulması keyfiyyət göstəricisi deyil.

⚠️ **Hədəf olmayan dil region-a görə XİLAS EDİLMİR.** `language=de` + `region=US`
sətri "en" sayılmır — almanca ad ingiliscə kimi göstərilərdi. Region→dil map-i
(`REGION_TO_LANG`) qəsdən dardır: `CA` (Kanada) iki dilli olduğu üçün YOXDUR.

⚠️ Bərabər balda IMDb-nin öz `ordering` sırası həll edir — **determinizm** üçün,
yoxsa hər idxalda DB-dəki ad dəyişər.

⚠️ Orijinal sətrin dili çox vaxt boşdur. Sıra: sətrin öz `language` → region map →
`StreamingTitle.originalLanguage` (TMDB) → ISO 639-2 **`"und"`**. Uydurma kod yazma.

⚠️ **Orijinal dil kodunun YEGANƏ mənbəyi TMDB-dir** — IMDb datasetlərində belə sütun
yoxdur. `tmdbEnrich.ts` onu `/find` cavabından götürüb `ScrapedTitle.originalLanguage`
ilə daşıyır, `persist.ts` isə boş olan sətirlərə backfill edir. Bu zəncir qırılsa ad
DB-yə düzgün yazılır, amma **hamısı `und` etiketi ilə** — ilk dry-run-da məhz belə
olmuşdu (1778 başlığın 1778-i `und`), çünki scrape yolu həmin sahəni götürmürdü.

⚠️ Məntiqi dəyişəndə **`npm run test:imdb`** işlət.

## Real örtük (2026-08, 1826 IMDb ID-li başlıq)

| Data | Örtük |
| --- | --- |
| IMDb reytinqi | 1755 (96%) |
| Orijinal ad | 1778 (97%) |
| İngiliscə ad | 1651 (90%) |
| Rusca ad | 783 (43%) |
| **Türkcə ad** | **474 (26%)** |

⚠️ **Türkcə örtük aşağıdır və bu, kodun qüsuru deyil** — IMDb `title.akas` Prime-ın
Avropa kataloqundakı əksər başlıq üçün türkcə ad daşımır. Artırmaq lazımdırsa yol
TMDB `/translations`-dır (icma tərcümələri IMDb-dən zəngindir); o, başlıq başına bir
HTTP sorğu tələb edir, ona görə yalnız `tr`/`ru` adı ÇATIŞMAYAN başlıqlar üçün
işlədilməlidir. Bu hələ qurulmayıb.

## İdxal

```
npm run import:imdb                # reytinq + adlar
npm run import:imdb -- --dry-run   # DB-yə yazmadan statistika
npm run import:imdb -- --skip-akas # yalnız reytinqlər (~7MB, 10 saniyə)
```

⚠️ **Fayllar TAM oxunmur.** `title.akas.tsv.gz` açılmış halda ~2GB-dır; `readFile`
ilə oxumaq 4GB serverdə prosesi öldürər. Skript gunzip + readline ilə sətir-sətir
axıdır və yaddaşda **yalnız bizim IMDb ID-lərimizə** aid sətirləri saxlayır.

⚠️ Hər sətri parse etmə — əvvəlcə `line.indexOf("\t")` ilə ilk xananı yoxla.
Sətirlərin %99.9-u bizə aid deyil.

`IMDB_DATASET_DIR` təyin olunsa fayllar ora endirilir və təkrar işə salmada şəbəkəyə
çıxılmır. Yarımçıq endirmə `.part` adı ilə yazılır — kəsilmiş fayl "keş" kimi qalmasın.

İdxal köhnə `source="IMDB_AKAS"` sətirlərini silib yenidən yazır; **`MANUAL`/`TMDB`
mənbəli adlara toxunmur** (admin əl düzəlişi idxalla silinməməlidir).

⚠️ `/streaming/katalog` **prerender olunur** (`revalidate = 600`) və yeni sütunları
sorğulayır — yəni miqrasiya tətbiq olunmayıbsa `next build`-in ÖZÜ sınır, sadəcə
runtime yox. `/reels` ilə eyni tələdir; `deploy.yml` onsuz da `prisma migrate deploy`-u
build-dən əvvəl işlədir.

## Vitrin

- **Axtarış** `searchText` üzərində işləyir — `buildSearchText()` bütün dil
  variantlarını kiçik hərfli tək sətirdə birləşdirir. Massiv yox, tək string:
  kataloq RSC payload-una ~2000 başlıq düşür və client bir `includes()` ilə yoxlayır.
- **Sıralama** xam reytinqlə DEYİL, `ratingRankScore()` çəkili balı ilə (IMDb
  Top-250 formulu). Xam reytinq işlətsək 8 səsli "10.0" başlıqlar siyahının başını
  tutur — kataloqda belələri çoxdur.

# HBO Max kollektoru (AZ kataloqu + real dublyaj/altyazı)

HBO Max-ın Azərbaycan kataloqu (seriallar + filmlər) və hər epizodun **AZ player-də görünən**
dilləri. Metadata trekləri qlobaldır və AZ-da görünənlərdən çoxdur — vitrin YALNIZ player-də
təsdiqlənmiş region treklərini göstərir.

**Harada işləyir:** yalnız Mac-də (AZ IP + HBO-ya giriş edilmiş `.hbomax-profile/` + lokal
kollektor DB `HBOMAX_DATABASE_URL`, docker `honsell-hbomax-dev` :55433). Prod serverdə brauzer
YOXDUR — prod datanı HTTPS ilə alır.

```
npm run dev:hbomax                       # lokal DB + admin → Streaming → HBO Max Kollektor (düymələr)
npm run hbomax:catalog-sync [-- --missing | --limit N | --show <id>]
npm run hbomax:validate-pending          # AZ player, gündəlik 300 limit
npm run hbomax:project                   # lokal vitrinə
npm run hbomax:publish [-- --all]        # → prod (POST /api/hbomax/import, HBOMAX_IMPORT_TOKEN)
```

| Qat | Fayl |
| --- | --- |
| Kollektor (kəşf, detal, növbə, aqreqasiya, proyeksiya) | [lib/scrapers/hbomaxCollector/](lib/scrapers/hbomaxCollector/) |
| Prod idxalı (server) | [lib/hbomaxImport.ts](lib/hbomaxImport.ts) + [app/api/hbomax/import/route.ts](app/api/hbomax/import/route.ts) |
| Mac → prod göndəriş | [lib/scrapers/hbomaxCollector/publish/publishToProd.ts](lib/scrapers/hbomaxCollector/publish/publishToProd.ts) |
| Admin düymələri (yalnız `dev:hbomax`) | [lib/hbomaxAdminRunner.ts](lib/hbomaxAdminRunner.ts) + [app/admin/streaming/hbomax/](app/admin/streaming/hbomax/) |
| Vitrin (kart, ⓘ modal, detal) | [lib/streamingLanguageStates.ts](lib/streamingLanguageStates.ts), [components/streaming/](components/streaming/), [lib/streamingTitleDetail.ts](lib/streamingTitleDetail.ts) |

⚠️ **Kollektor `.env`-dəki `DATABASE_URL`-ə heç vaxt yazmır** — `db/collectorDb.ts` ilk import
olunmalıdır və lokal olmayan host `HBOMAX_ALLOW_REMOTE_DB=1` tələb edir.

⚠️ **Film = 1 sezon × 1 epizod** (`showType` MOVIE/STANDALONE, `ProviderTitle.kind = MOVIE`) —
növbə/validasiya/aqreqasiya seriallarla eynidir; UI filmdə sezon/epizod bölmələrini gizlədir.

⚠️ **HBOMAX platformasını yalnız bu proyeksiya idarə edir** — JustWatch HBO scraper-i
orchestrator-dan çıxarılıb (`persist.ts` öz siyahısında olmayan HBOMAX sətirlərini deaktiv edərdi).

⚠️ **Brauzer bağlananda run DAYANIR** (`isBrowserClosed`) — əks halda qalan başlıqlar/epizodlar
"uğursuz" yazılırdı (cəhd sayları yanırdı). Yarımçıq kataloq run-u `--missing` ilə davam edir.

⚠️ Prod-da vitrinin coverage/modal hissəsi `HBOMAX_STOREFRONT_COVERAGE=1` tələb edir (miqrasiyadan
SONRA). Token yoxdursa `/api/hbomax/import` 404 qaytarır.

⚠️ Testlər: `npm run test:hbomax-queue`, `test:hbomax-lang`, `test:hbomax-db` (lokal test DB).

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
