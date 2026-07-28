/**
 * Facet landing səhifələrinin konfiqurasiyası.
 *
 * NƏ ÜÇÜN: insanlar "God of War Ragnarök qiyməti" axtarmır, "ucuz ps5
 * oyunları", "ps4 aksiyon oyunları", "fifa 26 azerbaycan" axtarır. Oyun detal
 * səhifələri bu sorğuları tutmur — onlar long-tail quyruğudur. Bu səhifələr
 * kateqoriya sorğularını tutur və oradan detal səhifələrinə keçid verir.
 *
 * URL-lər `/oyunlar/` altında DEYİL: `/oyunlar/[slug]` artıq oyun detal
 * route-udur və `/oyunlar/ps5` orada 404 verərdi. Kök səviyyəli, açar söz
 * daşıyan URL-lər (`/ps5-oyunlari`) həm toqquşmanı həll edir, həm də real
 * axtarış sorğusuna daha yaxındır.
 *
 * Bu modul PRISMA-YA TOXUNMUR — client komponent (GameBrowser) buradan tip və
 * filtr obyekti import edir. Prisma-ya çatan modul "use client" ağacına
 * düşəndə `next build` sınır (bax: lib/gameQuery.ts ayrı saxlanılıb).
 */

/** Facet-in kataloq filtri. Həm server sorğusuna, həm client-ə eyni mənbədən gedir. */
export type FacetFilter = {
  platform?: "PS4" | "PS5";
  /** DB-də saxlanan janr adları (PS Store TR: "Aksiyon", "Spor", …). */
  genres?: string[];
  onSale?: boolean;
  priceMinAzn?: number;
  priceMaxAzn?: number;
  /** Seriya səhifələri üçün başlıq alt-sətri. */
  franchise?: string;
};

export type FacetFaq = { q: string; a: string };

export type Facet = {
  /** Tam yol, baş və son "/" olmadan: "ps5-oyunlari", "janr/aksiyon". */
  path: string;
  h1: string;
  title: string;
  description: string;
  /** Səhifənin unikal giriş mətni. Abzaslar "\n\n" ilə ayrılır. */
  intro: string;
  faq: FacetFaq[];
  filter: FacetFilter;
  /** Bu facet-lə əlaqəli digər facet path-ları — daxili keçid şəbəkəsi. */
  related: string[];
  /** Sitemap prioriteti. */
  priority: number;
};

/**
 * İndeksləmə üçün minimum məhsul sayı.
 *
 * 5 oyunu olan janr səhifəsi Google gözündə "thin content"-dir və yalnız o
 * səhifəyə deyil, bütün domenin qiymətləndirilməsinə zərər vurur. Bu həddən
 * aşağı facet-lər işləməyə davam edir (istifadəçi keçidlə gələ bilər), sadəcə
 * `noindex` alır və sitemap-a düşmür.
 */
export const FACET_MIN_PRODUCTS_FOR_INDEX = 8;

// ─── Platform ────────────────────────────────────────────────────────────────

const PLATFORM_FACETS: Facet[] = [
  {
    path: "ps5-oyunlari",
    h1: "PS5 oyunları",
    title: "PS5 Oyunları — Qiymətlər və Endirimlər",
    description:
      "PlayStation 5 oyunlarının tam kataloqu: qiymətlər manatla, aktiv endirimlər, anında çatdırılma. PS5 oyununu Azərbaycanda rəsmi PSN hesabına yüklə.",
    intro: `PlayStation 5 kataloqunun hamısı bir səhifədə — qiymətlər manatla göstərilir, endirimlər isə PS Store-da dəyişən kimi yenilənir. Siyahını janra, qiymətə və endirim vəziyyətinə görə süzgəcdən keçirə bilərsiniz.

PS5 oyunları rəqəmsal lisenziya kimi satılır. Sifariş təsdiqləndikdən sonra oyun sizin PSN hesabınıza bağlanır və konsolda "Kitabxana" bölməsindən yüklənir — disk göndərilmir, gözləmək lazım deyil. Lisenziya hesabınızda həmişəlik qalır; bu abunə deyil və müddəti bitmir.

Kataloqda bir neçə fərqli məhsul tipi var və onları qarışdırmamaq vacibdir. Tam oyunlar müstəqil işləyir. Əlavə paketlər (DLC) isə əsas oyun olmadan işləmir — onlar mövcud oyuna məzmun əlavə edir. Sanal valyuta kartları da ayrıca kateqoriyadır. Hər məhsulun kartında tipi göstərilir, süzgəcdən isə yalnız istədiyiniz tipi seçə bilərsiniz.

Bəzi oyunlar həm PS4, həm PS5 versiyasını bir paketdə verir — belə oyunlarda hər iki konsolda oynamaq mümkündür. Oyunun səhifəsində dəstəklənən platformalar açıq yazılıb, ona görə almadan əvvəl yoxlamaq faydalıdır.

PSN hesabınız yoxdursa, biz onu sizin üçün aça bilərik. Hesab tamamilə sizin adınıza olur və giriş məlumatları yalnız sizə verilir.`,
    faq: [
      {
        q: "PS5 oyununu aldıqdan sonra nə qədər müddətə çatdırılır?",
        a: "Ödəniş təsdiqləndikdən sonra oyun PSN hesabınıza yüklənir. Adətən bu bir neçə dəqiqə çəkir; iş saatlarından kənar sifarişlər növbəti iş saatında tamamlana bilər.",
      },
      {
        q: "Oyun həmişəlik mənim hesabımda qalır?",
        a: "Bəli. Oyun rəsmi PS Store lisenziyası kimi hesabınıza bağlanır və orada qalır. Abunə deyil, müddəti bitmir.",
      },
      {
        q: "PS5 oyunlarını PS4-də oynaya bilərəm?",
        a: "Yalnız oyun həm PS4, həm PS5 versiyasını əhatə edirsə. Oyunun səhifəsində dəstəklənən platformalar göstərilir — orada yalnız PS5 yazılıbsa, PS4-də işləməyəcək.",
      },
      {
        q: "Qiymətlər niyə PS Store-dakından fərqlidir?",
        a: "PS Store Türkiyə mağazasında qiymətlər lirədir. Biz həmin qiyməti manata çeviririk və xidmət haqqını əlavə edirik — yəni ödədiyiniz məbləğ heç bir gizli əlavə olmadan səhifədə göründüyü kimidir.",
      },
    ],
    filter: { platform: "PS5" },
    related: ["ps4-oyunlari", "ucuz-oyunlar", "janr/aksiyon", "janr/idman"],
    priority: 0.9,
  },
  {
    path: "ps4-oyunlari",
    h1: "PS4 oyunları",
    title: "PS4 Oyunları — Qiymətlər və Endirimlər",
    description:
      "PlayStation 4 oyunlarının tam kataloqu: qiymətlər manatla, aktiv endirimlər, anında çatdırılma. PS4 oyununu Azərbaycanda rəsmi PSN hesabına yüklə.",
    intro: `PlayStation 4 hələ də Azərbaycanda ən çox oynanan konsoldur və onun kataloqu PS5-dən nəzərəçarpacaq dərəcədə ucuzdur. Bu səhifədə PS4 üçün mövcud bütün oyunlar toplanıb — qiymətlər manatla, endirimlər canlı.

PS4 kataloqunun əsas üstünlüyü qiymətdir. Nəsil köhnəldikcə nəşriyyatçılar qiymətləri aşağı salır və böyük endirim kampaniyalarında fərq daha da böyüyür. Vaxtilə tam qiymətə satılan tanınmış oyunlar bu gün bir neçə dəfə ucuza alınır — özü də eyni tam oyun kimi, heç bir məzmun məhdudiyyəti olmadan.

Oyunlar rəqəmsal lisenziya kimi satılır və PSN hesabınıza bağlanır. Disk almağa, mağazaya getməyə ehtiyac yoxdur; sifarişdən sonra oyun konsolun kitabxanasında görünür və yüklənir.

PS5 konsolu olanlar üçün də bu səhifə maraqlıdır: PS4 oyunlarının böyük əksəriyyəti PS5-də geriyə uyğunluq sayəsində işləyir. Bu, oyunun PS5 versiyası olduğu anlamına gəlmir — qrafika PS4 səviyyəsində qalır — lakin qiymət fərqi çox vaxt bunu kompensasiya edir.

Endirimdəki oyunları görmək üçün süzgəcdən "Endirimdə" seçimini işarələyin.`,
    faq: [
      {
        q: "PS4 oyunu PS5 konsolumda işləyəcək?",
        a: "Əksər PS4 oyunları PS5-də geriyə uyğunluq sayəsində işləyir. Bu, oyunun PS5 versiyası olduğu anlamına gəlmir — qrafika PS4 səviyyəsində qalır.",
      },
      {
        q: "PS4 oyunları niyə PS5 oyunlarından ucuzdur?",
        a: "PS4 nəsli artıq köhnəlib və nəşriyyatçılar həmin kataloqu daha aşağı qiymətə satır. Böyük endirim kampaniyalarında fərq daha da böyüyür.",
      },
      {
        q: "Hesabım yoxdursa nə etməliyəm?",
        a: "Sizin üçün Türkiyə PSN hesabı aça bilərik. Hesab tamamilə sizin adınıza olur və məlumatları yalnız sizə verilir.",
      },
    ],
    filter: { platform: "PS4" },
    related: ["ps5-oyunlari", "ucuz-oyunlar", "janr/aksiyon", "janr/yaris"],
    priority: 0.9,
  },
];

// ─── Qiymət ──────────────────────────────────────────────────────────────────

const PRICE_FACETS: Facet[] = [
  {
    path: "ucuz-oyunlar",
    h1: "Ucuz PlayStation oyunları",
    title: "Ucuz PlayStation Oyunları — 20 manatadək",
    description:
      "20 manatdan ucuz PS4 və PS5 oyunları. Endirimli qiymətlər manatla, anında çatdırılma, rəsmi PSN lisenziyası.",
    intro: `Konsol oyunu bahalı olmaq məcburiyyətində deyil. Bu səhifədə qiyməti 20 manatdan aşağı olan bütün PS4 və PS5 oyunları toplanıb — həm daimi ucuz buraxılışlar, həm də müvəqqəti endirimə düşmüş böyük adlar.

Siyahı avtomatik yenilənir. PS Store-da endirim başlayan kimi oyun buraya düşür, endirim bitəndə isə çıxır. Yəni burada gördüyünüz qiymət həmin andakı real qiymətdir — köhnəlmiş siyahı deyil. Endirimli oyunlarda kampaniyanın bitmə tarixi oyunun öz səhifəsində göstərilir.

Bu qiymət aralığında iki fərqli qrup var. Birincisi — bir neçə il əvvəl çıxmış böyük buraxılışlar; onlar tam oyundur və məzmunca heç nə itirmir, sadəcə yaşlıdır. İkincisi — kiçik studiyaların oyunları; onlar qısa ola bilər, əvəzində çox vaxt daha orijinal ideyalar təklif edir.

Hamısı tam versiyadır. Demo və sınaq versiyaları kataloqda ayrıca işarələnir və bu siyahıya düşmür. Səbətə istədiyiniz qədər oyun əlavə edə bilərsiniz — hamısı eyni PSN hesabına yüklənir.

Daha dar büdcə ilə axtarırsınızsa, aşağıdakı keçidlə 10 manatadək olan oyunlara baxa bilərsiniz.`,
    faq: [
      {
        q: "Bu qiymətlər nə qədər müddətə keçərlidir?",
        a: "Endirimli oyunların bitmə tarixi oyunun öz səhifəsində göstərilir. Endirimsiz ucuz oyunlarda isə qiymət nəşriyyatçı dəyişənə qədər sabit qalır.",
      },
      {
        q: "Ucuz oyunlar tam versiyadır, yoxsa demo?",
        a: "Hamısı tam oyundur. Demo və sınaq versiyaları kataloqda ayrıca işarələnir və bu siyahıya düşmür.",
      },
      {
        q: "Bir neçə ucuz oyunu birlikdə ala bilərəm?",
        a: "Bəli, səbətə istədiyiniz qədər oyun əlavə edə bilərsiniz. Hamısı eyni PSN hesabına yüklənir.",
      },
    ],
    filter: { priceMaxAzn: 20 },
    related: ["ucuz-oyunlar/10-manatadek", "ps4-oyunlari", "ps5-oyunlari"],
    priority: 0.8,
  },
  {
    path: "ucuz-oyunlar/10-manatadek",
    h1: "10 manatadək PlayStation oyunları",
    title: "10 Manatadək PlayStation Oyunları",
    description:
      "Qiyməti 10 manatdan aşağı olan PS4 və PS5 oyunları. Endirimli qiymətlər, anında çatdırılma, rəsmi lisenziya.",
    intro: `Ən dar büdcə üçün siyahı: qiyməti 10 manatdan aşağı olan bütün PlayStation oyunları. Burada əsasən bir neçə il əvvəl çıxmış buraxılışlar və dərin endirimə düşmüş oyunlar toplanır.

Bu qiymət aralığı göründüyündən daha maraqlıdır. Böyük endirim kampaniyaları zamanı — xüsusən ilin sonu və yay satışlarında — vaxtilə tam qiymətə satılan tanınmış adlar bu siyahıya düşür. Kampaniya bitəndə oyun avtomatik siyahıdan çıxır, yəni burada gördüyünüz hər qiymət həmin andakı real qiymətdir.

Siyahını platformaya görə süzgəcdən keçirə bilərsiniz: PS4 kataloqunda bu aralıqda daha çox seçim var, çünki nəsil köhnəldikcə qiymətlər aşağı düşür. PS5 tərəfdə isə bu qiymətə əsasən daha kiçik, müstəqil studiyaların oyunları rast gəlinir.

Bütün oyunlar tam versiyadır — demo və sınaq versiyaları kataloqda ayrıca işarələnir və bu siyahıya düşmür. Ödəniş təsdiqləndikdən sonra oyun PSN hesabınıza yüklənir və orada həmişəlik qalır.`,
    faq: [
      {
        q: "Bu qədər ucuz oyunlar keyfiyyətlidirmi?",
        a: "Qiymət oyunun yaşı və endirim kampaniyası ilə bağlıdır, keyfiyyətlə yox. Bir neçə il əvvəl tam qiymətə satılan oyunlar bu siyahıda tez-tez görünür.",
      },
      {
        q: "Siyahı nə vaxt yenilənir?",
        a: "Kataloq PS Store ilə müntəzəm sinxronlaşdırılır, ona görə qiymətlər və endirimlər gün ərzində yenilənir.",
      },
    ],
    filter: { priceMaxAzn: 10 },
    related: ["ucuz-oyunlar", "ps4-oyunlari"],
    priority: 0.7,
  },
];

// ─── Seriya (franchise) ──────────────────────────────────────────────────────
//
// `franchise` başlıq üzrə alt-sətr axtarışıdır, ona görə termin kifayət qədər
// spesifik olmalıdır: "FIFA" düzgündür, "FC" isə "FC 26" ilə yanaşı təsadüfi
// başlıqları da tutardı.

function franchiseFacet(opts: {
  slug: string;
  name: string;
  term: string;
  intro: string;
  faq: FacetFaq[];
  related?: string[];
}): Facet {
  return {
    path: `seriya/${opts.slug}`,
    h1: `${opts.name} oyunları`,
    title: `${opts.name} Oyunları — Bütün Buraxılışlar və Qiymətlər`,
    description: `${opts.name} seriyasının PlayStation buraxılışları: qiymətlər manatla, aktiv endirimlər, anında çatdırılma.`,
    intro: opts.intro,
    faq: opts.faq,
    filter: { franchise: opts.term },
    related: opts.related ?? ["ps5-oyunlari", "ps4-oyunlari", "ucuz-oyunlar"],
    priority: 0.7,
  };
}

const FRANCHISE_FACETS: Facet[] = [
  franchiseFacet({
    slug: "fifa",
    name: "FIFA",
    term: "FIFA",
    intro: `FIFA seriyasının PlayStation-da mövcud bütün buraxılışları bir siyahıda. Seriya onilliklər boyu futbol simulyasiyasının standartı olub və hər buraxılış öz dövrünün komanda heyətlərini, liqalarını və stadionlarını daşıyır.

Köhnə buraxılışların qiyməti yenilərdən xeyli aşağıdır və offline rejimlər — karyera, sürətli matç, turnir — tam işləyir. Nəzərə almalı olduğunuz yeganə məsələ onlayn rejimlərdir: EA köhnə buraxılışların serverlərini bir müddət sonra bağlayır, ona görə onlayn oynamaq əsas məqsədinizdirsə, ən son buraxılışlara baxın.

Vacib bir detal: 2023-cü ildən sonra seriya "EA SPORTS FC" adı ilə davam edir. EA ilə FIFA təşkilatı arasındakı lisenziya müqaviləsi bitdiyi üçün ad dəyişdi — oyun, komanda və inkişaf xətti eynidir. Ən son futbol oyununu axtarırsınızsa, EA SPORTS FC səhifəsinə keçin.

Siyahıda həm əsas oyunlar, həm də Ultimate Team paketləri və sezon məzmunu kimi əlavələr görünə bilər. Hər məhsulun səhifəsində nəyin daxil olduğu yazılıb.`,
    faq: [
      {
        q: "FIFA ilə EA SPORTS FC arasında fərq nədir?",
        a: "Eyni seriyadır. EA ilə FIFA arasındakı lisenziya müqaviləsi bitdiyi üçün ad dəyişdi — oyun və komanda eynidir.",
      },
      {
        q: "Köhnə FIFA buraxılışlarında onlayn oynamaq olur?",
        a: "EA köhnə buraxılışların serverlərini bir müddət sonra bağlayır. Offline rejimlər həmişə işləyir, onlayn rejimlər isə oyunun yaşından asılıdır.",
      },
    ],
    related: ["seriya/ea-sports-fc", "janr/idman", "ps5-oyunlari"],
  }),
  franchiseFacet({
    slug: "ea-sports-fc",
    name: "EA SPORTS FC",
    term: "EA SPORTS FC",
    intro: `EA SPORTS FC — FIFA seriyasının davamı və hazırda EA-nın əsas futbol oyunu. Bütün mövcud buraxılışlar və sürümlər bu səhifədə toplanıb.

Hər buraxılış adətən bir neçə sürümdə satılır: Standard, Ultimate və bəzən xüsusi kolleksiya nəşrləri. Fərq əsas oyunda deyil — o hamısında eynidir. Fərq Ultimate Team məzmunundadır: oyunçu paketləri, sezon xalları və bir neçə gün erkən giriş. Yalnız karyera və offline matçlar oynamaq fikrindəsinizsə, Standard sürüm kifayətdir.

Bəzi buraxılışlar həm PS4, həm PS5 versiyasını bir paketdə verir. Bu, iki konsolu olan və ya yaxın vaxtda PS5-ə keçməyi planlaşdıran oyunçular üçün faydalıdır — oyunun səhifəsində dəstəklənən platformalar açıq göstərilir.

Onlayn rejimlər — Ultimate Team, Rivals, Champions — PS Plus abunəsi tələb edir. Karyera rejimi və offline matçlar abunəsiz oynanılır.`,
    faq: [
      {
        q: "Ultimate Sürüm ilə Standard arasında fərq nədir?",
        a: "Əsas oyun eynidir. Ultimate adətən Ultimate Team paketləri, sezon məzmunu və bir neçə gün erkən giriş verir.",
      },
      {
        q: "PS4 versiyasını alsam PS5-də oynaya bilərəm?",
        a: "Bəzi buraxılışlar hər iki konsolu bir paketdə verir. Oyunun səhifəsində platformalar göstərilir — orada həm PS4, həm PS5 varsa, ikisində də oynaya bilərsiniz.",
      },
    ],
    related: ["seriya/fifa", "janr/idman", "ps5-oyunlari"],
  }),
  franchiseFacet({
    slug: "call-of-duty",
    name: "Call of Duty",
    term: "Call of Duty",
    intro: `Call of Duty seriyasının PlayStation buraxılışları — kampaniya, çoxoyunçu rejim və Warzone məzmunu daxil olmaqla.

Seriyada demək olar hər il yeni buraxılış çıxır və bu, alıcı üçün bir üstünlük yaradır: köhnə hissələr sürətlə ucuzlaşır. Bir-iki il əvvəlki buraxılışın kampaniyası bu gün də tam dəyərlidir və qiyməti yenisinin bir neçə dəfə altındadır.

Seçim edərkən əsas sual budur: onlayn oynayacaqsınız, yoxsa kampaniya üçün alırsınız? Kampaniya rejimi buraxılışın yaşından asılı olmayaraq həmişə işləyir. Onlayn çoxoyunçu isə aktiv oyunçu bazası tələb edir — son bir-iki buraxılışda matç tapmaq sürətlidir, daha köhnə hissələrdə isə gözləmə uzana bilər.

PlayStation-da onlayn çoxoyunçu üçün PS Plus abunəsi lazımdır. Warzone kimi pulsuz oynanan hissələr istisnadır — onlar abunəsiz işləyir.`,
    faq: [
      {
        q: "Çoxoyunçu rejimi üçün PS Plus lazımdır?",
        a: "Bəli, PlayStation-da onlayn çoxoyunçu üçün PS Plus abunəsi tələb olunur. Warzone kimi pulsuz oyunlar istisnadır.",
      },
      {
        q: "Köhnə Call of Duty hissələrində serverlər işləyir?",
        a: "Son bir neçə buraxılışda oyunçu bazası aktivdir. Daha köhnə hissələrdə onlayn rejim boş ola bilər, kampaniya isə həmişə oynanılır.",
      },
    ],
    related: ["janr/aksiyon", "ps5-oyunlari", "ucuz-oyunlar"],
  }),
  franchiseFacet({
    slug: "gta",
    name: "GTA",
    term: "Grand Theft Auto",
    intro: `Grand Theft Auto seriyasının PlayStation buraxılışları. Seriya açıq dünya janrının ən tanınmış nümayəndəsidir və hər hissə öz şəhərini, hekayəsini və oyun sistemini gətirir.

GTA V həm PS4, həm PS5 versiyasında mövcuddur. PS5 versiyası daha yüksək kadr sürəti, təkmilləşdirilmiş işıqlandırma və sürətli yüklənmə təklif edir; PS4 versiyası isə eyni oyunu daha aşağı qiymətə verir. Hansını seçməyiniz konsolunuzdan və büdcənizdən asılıdır.

GTA Online oyunun tərkib hissəsidir və ayrıca satılmır. Onlayn oynamaq üçün PS Plus abunəsi tələb olunur. Oyun daxilində valyuta paketləri (Shark Card) ayrıca satılır, lakin onlar məcburi deyil — onlayn məzmunun böyük hissəsi oynamaqla açılır.

Seriyanın köhnə hissələri də kataloqda rast gələ bilər və onlar adətən çox ucuzdur. Yaş reytinqinə diqqət edin: GTA buraxılışlarının hamısı PEGI 18-dir.`,
    faq: [
      {
        q: "GTA V alsam GTA Online da daxildir?",
        a: "Bəli, GTA Online oyunun tərkib hissəsidir və ayrıca ödəniş tələb etmir. Onlayn oynamaq üçün PS Plus lazımdır.",
      },
      {
        q: "PS4 versiyasından PS5 versiyasına keçid pulsuzdur?",
        a: "Bu, alınan nəşrdən asılıdır və vaxtaşırı dəyişir. Oyunun səhifəsində hansı platformaların daxil olduğu göstərilir.",
      },
    ],
    related: ["janr/aksiyon", "ps5-oyunlari", "ps4-oyunlari"],
  }),
  franchiseFacet({
    slug: "ea-sports-ufc",
    name: "EA SPORTS UFC",
    term: "UFC",
    intro: `EA SPORTS UFC seriyasının PlayStation buraxılışları — real döyüşçülər, karyera rejimi və onlayn matçlar.

Seriya digər idman oyunlarından fərqli olaraq hər il yenilənmir; buraxılışlar arasında bir neçə il fasilə olur. Bunun praktiki nəticəsi budur ki, mövcud buraxılış uzun müddət aktual qalır və vaxt keçdikcə qiyməti ciddi şəkildə aşağı düşür.

Karyera rejimi seriyanın ən güclü tərəfidir: döyüşçü yaradırsınız, məşq edir, üslub seçir və çempionluğa doğru gedirsiniz. Bu rejim tamamilə offline oynanılır və PS Plus tələb etmir.

Onlayn matçlar üçün PS Plus abunəsi lazımdır. Onlayn oyunçu bazası ən son buraxılışda ən aktivdir — köhnə hissələrdə rəqib tapmaq uzun çəkə bilər, lakin karyera və offline döyüşlər həmişə işləyir.`,
    faq: [
      {
        q: "Onlayn matçlar üçün PS Plus lazımdır?",
        a: "Bəli, onlayn rejimlər üçün PS Plus abunəsi tələb olunur. Karyera və offline döyüşlər abunəsiz oynanılır.",
      },
    ],
    related: ["janr/idman", "ps5-oyunlari"],
  }),
  franchiseFacet({
    slug: "mortal-kombat",
    name: "Mortal Kombat",
    term: "Mortal Kombat",
    intro: `Mortal Kombat seriyasının PlayStation buraxılışları — hekayə kampaniyası, klassik döyüş rejimləri və onlayn matçlar.

Seriya döyüş janrında nadir haldır: burada tam hüquqlu, kinematik hekayə kampaniyası var və onu təkbaşına oynamaq mümkündür. Bu, döyüş oyunlarına yeni başlayanlar üçün yaxşı giriş nöqtəsidir, çünki mexanikaları hekayə boyu tədricən öyrədir.

Son hissələr həm PS4, həm PS5 üçün mövcuddur. Əlavə döyüşçülər adətən ayrıca DLC və ya döyüşçü paketi kimi satılır; bəzi genişləndirilmiş nəşrlər isə onları əvvəlcədən daxil edir. Hansı nəşrin nə verdiyi məhsulun öz səhifəsində göstərilir.

Onlayn matçlar üçün PS Plus abunəsi tələb olunur. Seriyanın bütün buraxılışları PEGI 18 reytinqlidir.`,
    faq: [
      {
        q: "Əlavə döyüşçüləri ayrıca almalıyam?",
        a: "Bəli, yeni döyüşçülər adətən DLC və ya döyüşçü paketi kimi satılır. Bəzi nəşrlər onları əvvəlcədən daxil edir.",
      },
    ],
    related: ["janr/aksiyon", "ps5-oyunlari"],
  }),
];

// ─── Janr ────────────────────────────────────────────────────────────────────
//
// DİQQƏT: `genres` dəyərləri PS Store-un TÜRKCƏ janr adlarıdır, çünki kataloq
// tr-tr mağazasından çəkilir (bax: lib/psStoreMetadata.ts). Slug azərbaycanca,
// filtr dəyəri türkcədir — bu qəsdəndir, DB-dəki dəyəri dəyişmək lazım deyil.

function genreFacet(opts: {
  slug: string;
  name: string;
  /** "Rollu oyunlar" kimi adlarda "… oyunları" şəkilçisi təkrar olur. */
  h1?: string;
  genres: string[];
  intro: string;
  faq: FacetFaq[];
  related?: string[];
}): Facet {
  return {
    path: `janr/${opts.slug}`,
    h1: opts.h1 ?? `${opts.name} oyunları`,
    title: `${opts.h1 ?? `${opts.name} Oyunları`} — PS4 və PS5`,
    description: `PlayStation üçün ${opts.name.toLocaleLowerCase("az-AZ")} oyunları: qiymətlər manatla, aktiv endirimlər, anında çatdırılma.`,
    intro: opts.intro,
    faq: opts.faq,
    filter: { genres: opts.genres },
    related: opts.related ?? ["ps5-oyunlari", "ps4-oyunlari", "ucuz-oyunlar"],
    priority: 0.8,
  };
}

const GENRE_FACETS: Facet[] = [
  genreFacet({
    slug: "aksiyon",
    name: "Aksiyon",
    genres: ["Aksiyon", "Nişancı", "Dövüş"],
    intro: `PlayStation-un ən böyük janrı — aksiyon oyunları. Bura bir neçə fərqli oyun tipi daxildir: açıq dünya macəraları, birinci və üçüncü şəxs nişançı oyunlar, döyüş oyunları və sürətli tempoli hərəkət oyunları.

Janrın genişliyi seçimi çətinləşdirə bilər, ona görə siyahını platformaya, qiymətə və endirim vəziyyətinə görə süzgəcdən keçirmək faydalıdır. Konkret bir seriyanı axtarırsınızsa — məsələn Call of Duty və ya GTA — aşağıdakı seriya keçidlərindən birbaşa keçin.

Nəzərə alınmalı bir məqam: aksiyon oyunlarının bir hissəsi onlayn çoxoyunçuya köklənib və orada PS Plus abunəsi tələb olunur. Təkoyunçu kampaniyalar isə abunəsiz tam oynanılır. Oyunun səhifəsində hansı rejimlərin olduğu göstərilir.

Yaş reytinqi bu janrda xüsusilə vacibdir — aksiyon oyunlarının çoxu PEGI 16 və ya PEGI 18-dir. Hər oyunun səhifəsində PEGI işarəsi və məzmun təsviri göstərilir.`,
    faq: [
      {
        q: "Aksiyon oyunları üçün PS Plus lazımdır?",
        a: "Yalnız onlayn çoxoyunçu rejimində oynamaq istəyirsinizsə. Təkoyunçu kampaniyalar abunəsiz tam oynanılır.",
      },
      {
        q: "Yaş məhdudiyyətinə necə baxım?",
        a: "Hər oyunun səhifəsində PEGI yaş reytinqi göstərilir. Aksiyon janrında oyunların çoxu PEGI 16 və ya PEGI 18-dir.",
      },
    ],
    related: ["seriya/call-of-duty", "seriya/gta", "ps5-oyunlari"],
  }),
  genreFacet({
    slug: "idman",
    name: "İdman",
    genres: ["Spor", "Simülasyon"],
    intro: `Futbol, basketbol, döyüş idmanları və idman simulyasiyaları — PlayStation-un idman kataloqu bir səhifədə toplanıb.

İdman oyunlarının özünəməxsus bir alış məntiqi var. Əksər seriyalarda hər il yeni buraxılış çıxır və köhnəsi sürətlə ucuzlaşır — bəzən bir neçə ay ərzində qiymət bir neçə dəfə aşağı düşür. Əgər ən son komanda heyətləri sizin üçün həlledici deyilsə, bir buraxılış geridə qalmaq ciddi qənaət deməkdir.

Onlayn heyət yeniləmələri yalnız cari buraxılış üçün verilir. Köhnə oyunlarda komanda tərkibləri oyunun çıxdığı vaxtdakı kimi qalır, lakin oyunun özü — karyera, turnir, sürətli matç — tam işləyir.

Onlayn rejimlər üçün PS Plus abunəsi lazımdır. Offline karyera və yerli çoxoyunçu rejimlər abunəsiz oynanılır.`,
    faq: [
      {
        q: "Köhnə idman oyunlarını almağın mənası varmı?",
        a: "Offline karyera və sürətli matç rejimləri tam işləyir və qiymət fərqi böyükdür. Onlayn rejimlər isə vaxtla bağlanır.",
      },
      {
        q: "Komanda heyətləri yenilənir?",
        a: "Onlayn heyət yeniləmələri yalnız cari buraxılışlar üçün verilir. Köhnə oyunlarda heyət çıxış vaxtındakı kimi qalır.",
      },
    ],
    related: ["seriya/ea-sports-fc", "seriya/fifa", "ps5-oyunlari"],
  }),
  genreFacet({
    slug: "yaris",
    name: "Yarış",
    genres: ["Yarış", "Sürüş/Yarış"],
    intro: `Yarış oyunları — realistik simulyatorlardan arkad sürüşə qədər. Bu iki qütb arasındakı fərq böyükdür, ona görə seçim edərkən nə axtardığınızı bilmək vacibdir.

Simulyasiya yönümlü oyunlar real fizika, şin aşınması, yanacaq idarəsi və dəqiq trek modelləri təklif edir; öyrənmə əyrisi dikdir, əvəzində dərinlik böyükdür. Arkad yarışlar isə dərhal əyləncə verir — drift, nitro, sadələşdirilmiş idarəetmə. Hər iki tip bu siyahıdadır.

Sükan dəstəyi ayrıca diqqət tələb edir. Simulyasiya oyunlarının əksəriyyəti sükan və pedal dəstlərini dəstəkləyir, arkad yarışlarda isə dəstək məhdud ola bilər və ya ümumiyyətlə olmaya bilər. Oyunun səhifəsindəki uyğun aksesuarlar siyahısını yoxlayın.

Onlayn yarışlar üçün PS Plus abunəsi tələb olunur; karyera və tək yarışlar abunəsiz oynanılır.`,
    faq: [
      {
        q: "Yarış oyunları sükanı dəstəkləyir?",
        a: "Simulyasiya yönümlü oyunların çoxu dəstəkləyir. Arkad yarışlarda dəstək məhdud ola bilər — oyunun səhifəsindəki aksesuar siyahısını yoxlayın.",
      },
    ],
    related: ["janr/idman", "ps5-oyunlari", "ucuz-oyunlar"],
  }),
  genreFacet({
    slug: "macera",
    name: "Macəra",
    genres: ["Macera"],
    intro: `Hekayə yönümlü macəra oyunları — PlayStation-un tarixən ən güclü olduğu sahə. Sony-nin öz studiyaları bu janrda konsolun ən tanınmış oyunlarını buraxıb.

Janra həm böyük büdcəli açıq dünya buraxılışları, həm də daha kiçik, tamamilə hekayəyə köklənmiş oyunlar daxildir. Birincilər onlarla saatlıq məzmun və geniş dünya verir; ikincilər isə adətən 6-12 saat çəkir və daha sıx, fokuslanmış təcrübə təklif edir.

Bu janrın oyunlarının böyük əksəriyyəti təkoyunçudur, yəni PS Plus abunəsi tələb olunmur. Oyunu yüklədikdən sonra internet bağlantısı olmadan da oynaya bilərsiniz.

Dil dəstəyi macəra oyunlarında xüsusilə vacibdir, çünki hekayə təcrübənin əsasını təşkil edir. Türkcə altyazı bəzi böyük buraxılışlarda mövcuddur — hər oyunun səhifəsində dəstəklənən dillərin siyahısı göstərilir.`,
    faq: [
      {
        q: "Macəra oyunları üçün internet lazımdır?",
        a: "Oyunu yükləmək üçün lazımdır. Yükləndikdən sonra təkoyunçu macəra oyunları internetsiz oynanılır.",
      },
    ],
    related: ["janr/aksiyon", "janr/rollu-oyun", "ps5-oyunlari"],
  }),
  genreFacet({
    slug: "rollu-oyun",
    name: "RPG",
    h1: "Rollu oyunlar (RPG)",
    genres: ["Rol Yapma", "RPG"],
    intro: `Rollu oyunlar (RPG) — uzun kampaniyalar, personaj inkişafı və seçimlərin nəticəyə təsir etdiyi hekayələr.

Bu janr qiymətə görə ən çox oyun saatı verən kateqoriyalardan biridir. Böyük RPG buraxılışları asanlıqla 50-100 saat məzmun təklif edir, bəziləri isə yan tapşırıqlarla birlikdə daha çox. Yəni ilk baxışda baha görünən oyun, saat başına hesablananda kataloqun ən sərfəli seçimlərindən çıxır.

Janr daxilində iki geniş üslub var: Qərb RPG-ləri adətən açıq dünya, geniş seçim azadlığı və personaj yaradıcılığı üzərində qurulur; yapon RPG-ləri isə daha xətti hekayə, hazır personajlar və növbəli döyüş sistemləri təklif edir. Hər ikisi bu siyahıdadır.

Əksər RPG-lər təkoyunçudur və PS Plus tələb etmir. Dil dəstəyi vacib amildir — bu oyunlarda mətn həcmi çox böyükdür; oyunun səhifəsində dəstəklənən dillər göstərilir.`,
    faq: [
      {
        q: "RPG oyunları azərbaycan və ya türk dilini dəstəkləyir?",
        a: "Dəstəklənən dillər oyundan asılıdır. Türkcə altyazı bəzi böyük buraxılışlarda var; oyunun səhifəsində dil siyahısı göstərilir.",
      },
    ],
    related: ["janr/macera", "ps5-oyunlari", "ucuz-oyunlar"],
  }),
  genreFacet({
    slug: "qorxu",
    name: "Qorxu",
    genres: ["Korku", "Hayatta Kalma"],
    intro: `Qorxu və sağ qalma oyunları — gərgin atmosfer, məhdud resurslar və psixoloji təzyiq üzərində qurulmuş janr.

Janr daxilində iki fərqli yanaşma var. Sağ qalma qorxusu resurs qıtlığı üzərində işləyir: patron sayılır, hər qarşılaşma risk daşıyır, qaçmaq çox vaxt döyüşməkdən ağıllıdır. Psixoloji qorxu isə birbaşa təhlükədən çox atmosfer, səs və gözlənti hissi ilə təsir edir.

Səs bu janrda təcrübənin böyük hissəsini təşkil edir — bir çox oyun düşmənin yerini yalnız səslə bildirir. Qulaqlıqla oynamaq həm daha effektiv, həm də janrın nəzərdə tutduğu təcrübəyə daha yaxındır.

Yaş reytinqinə xüsusi diqqət yetirin: bu janrda oyunların böyük əksəriyyəti PEGI 18-dir və zorakılıq səviyyəsi yüksəkdir. Hər oyunun səhifəsində PEGI işarəsi və məzmun xəbərdarlıqları göstərilir.`,
    faq: [
      {
        q: "Qorxu oyunları uşaqlar üçün uyğundurmu?",
        a: "Əksəriyyəti deyil — bu janrda oyunların çoxu PEGI 18 reytinqlidir. Hər oyunun səhifəsində yaş reytinqi göstərilir.",
      },
    ],
    related: ["janr/aksiyon", "janr/macera", "ps5-oyunlari"],
  }),
];

// ─── Reyestr ─────────────────────────────────────────────────────────────────

export const ALL_FACETS: Facet[] = [
  ...PLATFORM_FACETS,
  ...PRICE_FACETS,
  ...FRANCHISE_FACETS,
  ...GENRE_FACETS,
];

const BY_PATH = new Map(ALL_FACETS.map((f) => [f.path, f]));

export function getFacet(path: string): Facet | null {
  return BY_PATH.get(path) ?? null;
}

/** `/seriya/[slug]` və `/janr/[slug]` route-larının statik generasiyası üçün. */
export function facetSlugsUnder(prefix: "seriya" | "janr" | "ucuz-oyunlar"): string[] {
  return ALL_FACETS.filter((f) => f.path.startsWith(`${prefix}/`)).map((f) =>
    f.path.slice(prefix.length + 1)
  );
}

/** Facet filtrini `/api/games` query parametrlərinə çevirir (client tərəf). */
export function facetToApiParams(filter: FacetFilter): Record<string, string> {
  const params: Record<string, string> = {};
  if (filter.platform) params.platform = filter.platform;
  // `/api/games` vergüllə ayrılmış janr siyahısını qəbul edir, yəni client
  // server ilə EYNİ filtri göndərir — 1-ci səhifə ilə sonrakılar arasında say
  // uyğunsuzluğu olmur.
  if (filter.genres && filter.genres.length > 0) params.genre = filter.genres.join(",");
  if (filter.onSale) params.onSale = "1";
  if (filter.priceMinAzn != null) params.priceMin = String(filter.priceMinAzn);
  if (filter.priceMaxAzn != null) params.priceMax = String(filter.priceMaxAzn);
  if (filter.franchise) params.franchise = filter.franchise;
  return params;
}
