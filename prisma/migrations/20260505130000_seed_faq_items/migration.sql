-- Seed FAQ items (idempotent via ON CONFLICT DO NOTHING)
-- 25 questions in 5 thematic groups, ordered by sortOrder ranges:
--   10–90  : Qiymət & Ödəniş
--   100–190: Çatdırılma & Aktivasiya
--   200–290: PSN Hesab & Region
--   300–390: PS Plus & Hədiyyə Kartları
--   400–490: Təhlükəsizlik & Dəstək

INSERT INTO "FaqItem" (id, question, answer, "isActive", "sortOrder", "createdAt", "updatedAt") VALUES
('faq-seed-001',
 'Oyunların qiymətləri necə formalaşır?',
 'Qiymətlər birbaşa Türkiyə PlayStation Store-dan canlı çəkilir, sonra məzənnə və xidmət haqqı əlavə olunmaqla AZN-yə çevrilir. Endirim dövrlərində PS Store-da elan olunan endirim faizi bizim saytda da əks olunur, beləliklə həmişə real bazar qiyməti görürsünüz.',
 true, 10, NOW(), NOW()),

('faq-seed-002',
 'Ödəniş üsulları hansılardır?',
 'Saytda Visa, MasterCard və yerli bank kartları (Kapital Bank, Pasha Bank, ABB və s.) ilə təhlükəsiz ödəniş edə bilərsiniz. Ödəniş prosesi şifrələnmiş bank səhifəsində aparılır, kart məlumatları bizdə saxlanılmır.',
 true, 20, NOW(), NOW()),

('faq-seed-003',
 'Hissəli ödəniş varmı?',
 'Bəli, dəstəklənən bankların kartları ilə hissəli (taksitli) ödəniş mümkündür. Ödəniş səhifəsində bankın taksit seçimləri avtomatik göstərilir; ölçü və müddət bankdan asılıdır.',
 true, 30, NOW(), NOW()),

('faq-seed-004',
 'Cüzdan (wallet) sistemi necə işləyir?',
 'Profilinizdəki cüzdana balans yükləyib istənilən vaxt sürətli sifariş üçün istifadə edə bilərsiniz. Yüklənən məbləğin müddəti yoxdur, geri qaytarma siyasəti çərçivəsində geri çəkilə bilər və cashback qazanclarınız da burada toplanır.',
 true, 40, NOW(), NOW()),

('faq-seed-005',
 'Cashback necə qazanılır və xərclənir?',
 'Hər tamamlanmış sifarişdən kateqoriyaya görə təyin olunmuş faiz cashback kimi profilinizə yüklənir. Cashback növbəti sifarişlərdə qiymətin müəyyən hissəsini ödəmək üçün istifadə oluna bilər və cüzdan səhifəsində ayrıca balans olaraq görünür.',
 true, 50, NOW(), NOW()),

('faq-seed-101',
 'Sifariş verdikdən sonra oyunu necə alıram?',
 'Ödəniş təsdiqlənən kimi admin sizin verdiyiniz PSN hesabınıza oyunu satın alır və ya aktivasiya edir. Bütün proses adətən 5–30 dəqiqə arasında tamamlanır və hesabınıza giriş etdiyinizdə oyun kitabxananızda görünür.',
 true, 100, NOW(), NOW()),

('faq-seed-102',
 'Çatdırılma müddəti nə qədərdir?',
 'Hədiyyə kartları və e-pin kodları anında — adətən 1-2 dəqiqədə e-poçtunuza göndərilir. Oyun aktivasiyaları admin yoxlaması ilə icra olunduğu üçün iş saatlarında 5-30 dəqiqə, gecə saatlarında bir qədər uzun sürə bilər.',
 true, 110, NOW(), NOW()),

('faq-seed-103',
 'PS5 oyunu hesabımda görünmür, nə etməliyəm?',
 'Konsolu yenidən başladın və "Library > Your Collection" bölməsindən baxın. Hələ də görünmürsə, hesabınızda doğru region (məs. Türkiyə) ilə daxil olduğunuza əmin olun. Problem davam edərsə dəstəyə yazın — sifariş ID ilə dərhal yoxlayırıq.',
 true, 120, NOW(), NOW()),

('faq-seed-104',
 'Offline və online aktivasiya nə deməkdir?',
 'Offline aktivasiya — oyun PSN-dən sizin hesabınıza alınır və konsolu primary etmək yolu ilə ailə üzvləri də oynaya bilir. Online aktivasiya — eyni oyunu eyni anda yalnız bir hesab oynaya bilir. Hər oyunun səhifəsində hansı tipdə təklif olunduğu yazılır.',
 true, 130, NOW(), NOW()),

('faq-seed-105',
 'Eyni oyunu iki konsolda oynaya bilərəmmi?',
 'Bəli — offline (primary console) variantında alınmış oyun primary edilmiş konsolda bütün hesablar tərəfindən, eyni zamanda alıcının hesabı isə istənilən başqa konsolda oynanıla bilər. Online variantda yalnız alıcı hesabı eyni anda oynayır.',
 true, 140, NOW(), NOW()),

('faq-seed-201',
 'PSN hesabı nədir?',
 'PSN (PlayStation Network) — Sony-nin onlayn xidmətidir; oyun almaq, multiplayer oynamaq və PS Plus-dan istifadə etmək üçün lazımdır. Hər PS5 və PS4 sahibi minimum bir PSN hesabı yaratmalıdır.',
 true, 200, NOW(), NOW()),

('faq-seed-202',
 'Türkiyə PSN hesabı niyə lazımdır?',
 'Türkiyə Store-da oyunlar Azərbaycan və Avropa Store-larına görə kəskin ucuzdur, çünki regional qiymətləndirmə tətbiq olunur. Eyni oyun çox vaxt 2-3 dəfə az qiymətə alına bilir, deyə bizdə əksər sifarişlər TR hesab üzərindən aparılır.',
 true, 210, NOW(), NOW()),

('faq-seed-203',
 'Mövcud hesabımda Türkiyə oyunu ala bilərəmmi?',
 'Bəli, əgər hesabınız Türkiyə regionunda yaradılıbsa. Region sonradan dəyişdirilə bilmədiyi üçün hesabınız Azərbaycan və ya başqa region üzərindədirsə, ayrıca Türkiyə hesabı yaratmaq lazımdır — bunun üçün "Hesab Açma" xidmətindən istifadə edə bilərsiniz.',
 true, 220, NOW(), NOW()),

('faq-seed-204',
 'Hesab açma xidməti nəyi əhatə edir?',
 'Sizin üçün Türkiyə regionunda yeni PSN hesabı yaradırıq, doğrulama prosesini tamamlayırıq və hesabın e-poçt + parolunu sizə təhlükəsiz şəkildə təqdim edirik. Hesab tamamilə sizin adınıza olur və yalnız siz idarə edirsiniz.',
 true, 230, NOW(), NOW()),

('faq-seed-205',
 'PSN hesabının regionunu sonradan dəyişdirmək olarmı?',
 'Xeyr — Sony-nin siyasətinə görə hesab yaradıldıqdan sonra ölkə/region heç bir halda dəyişdirilə bilməz. Buna görə Türkiyə Store-dan ucuz oyun almaq istəyənlər ya yeni TR hesab açır, ya da mövcud TR hesabdan istifadə edirlər.',
 true, 240, NOW(), NOW()),

('faq-seed-301',
 'PS Plus Essential, Extra və Deluxe arasındakı fərq nədir?',
 'Essential — onlayn multiplayer + ayda pulsuz oyunlar + bulud yaddaş. Extra — Essential-in hər şeyi + 400-dən çox PS5/PS4 oyunundan ibarət kataloq. Deluxe — Extra-nın hər şeyi + klassik PS1, PS2, PSP oyunları və yeni AAA oyunlarda sınaq müddəti.',
 true, 300, NOW(), NOW()),

('faq-seed-302',
 'PS Plus üzvlüyü nə qədər müddətdir?',
 '1, 3 və 12 ay variantlarında satılır. 12 aylıq plan adambaşına ayda ən sərfəli olduğu üçün ən populyar seçimdir. Hər plan üzvlük müddəti boyunca eyni səviyyədə xidmət təklif edir, yəni 12 ay Essential = 12 ay daimi onlayn oyun imkanı.',
 true, 310, NOW(), NOW()),

('faq-seed-303',
 'PSN Hədiyyə kartı nədir və necə istifadə olunur?',
 'PSN Hədiyyə kartı (TRY Wallet Top-up) Türkiyə hesabınızın cüzdanına müəyyən məbləğdə Türk lirəsi yükləyən e-pin koddur. Kodu PSN Store-da "Redeem Code" bölməsinə daxil edirsiniz və balans dərhal hesabınıza əlavə olunur.',
 true, 320, NOW(), NOW()),

('faq-seed-304',
 'Hədiyyə kartı hansı bölgələrdə işləyir?',
 'Bizdə satılan hədiyyə kartları yalnız Türkiyə PSN hesablarında işləyir, çünki TRY (Türk lirəsi) valyutasındadır. Avropa, ABŞ və ya başqa region hesabında istifadə oluna bilməz — region uyğunluğuna mütləq diqqət edin.',
 true, 330, NOW(), NOW()),

('faq-seed-305',
 'PS Plus avtomatik yenilənirmi?',
 'Üzvlük müddəti bitəndən sonra Sony-nin standart davranışı kart avtomatik yenilənmədir; bu funksiyanı PSN ayarlarından ("Subscription > Auto-Renewal") söndürə bilərsiniz. Bizdən aldığınız aktivasiyalarda biz auto-renewal-i sönmüş şəkildə təhvil veririk.',
 true, 340, NOW(), NOW()),

('faq-seed-401',
 'Hesab məlumatlarımın təhlükəsizliyi necədir?',
 'Bütün ödəniş əməliyyatları SSL şifrələnmə ilə bank tərəfindən aparılır, kart məlumatları saytda saxlanılmır. PSN hesab parolunuzu paylaşmamağınızı tövsiyə edirik — Hesab Açma xidmətində sizin üçün yaradılan hesabın tam məlumatları yalnız sizə verilir.',
 true, 400, NOW(), NOW()),

('faq-seed-402',
 'Geri qaytarma siyasəti varmı?',
 'Hələ aktivasiya edilməmiş oyunlar və istifadə olunmamış e-pin kodları üçün geri qaytarma mümkündür. Aktivasiya tamamlanmış sifarişlər PSN-in rəqəmsal məhsul siyasətinə görə geri qaytarılmır. Detallar üçün dəstəklə əlaqə saxlayın.',
 true, 410, NOW(), NOW()),

('faq-seed-403',
 'Sifarişlə bağlı problem yaransa nə etməliyəm?',
 'Profilinizdən "Sifarişlərim" bölməsinə keçib həmin sifariş üzərində "Dəstəyə yaz" düyməsi ilə bilet açın. Adətən iş saatlarında 15 dəqiqə, gecə saatlarında 1-2 saat ərzində cavab verilir. Acil hallarda info@honsell.store-a yaza bilərsiniz.',
 true, 420, NOW(), NOW()),

('faq-seed-404',
 'Aktivasiya prosesində hesabım banlana bilərmi?',
 'Xeyr. Biz heç bir hack, jailbreak və ya icazəsiz vasitə istifadə etmirik — hər oyun PSN-in rəsmi mağazasından sizin hesabınızla satın alınır. Bu Sony-nin qaydalarına tam uyğundur, deyə banlanma riski yoxdur.',
 true, 430, NOW(), NOW()),

('faq-seed-405',
 'Hansı dillərdə dəstək verilir?',
 'Müştəri dəstəyi Azərbaycan, Türk və İngilis dillərində verilir. Sayt interfeysi Azərbaycan dilindədir; oyun adları və PS Store məlumatları əsasən ingiliscə qalır, çünki rəsmi mağaza məlumatlarıdır.',
 true, 440, NOW(), NOW())

ON CONFLICT (id) DO NOTHING;
