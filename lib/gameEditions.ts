/**
 * Oyun sürümlərinin (edition) qruplaşdırılması — SAF funksiyalar (client + server
 * ortaq, `lib/prisma`-ya TOXUNMUR).
 *
 * DB-də sürümləri bir-birinə bağlayan sütun yoxdur: hər sürüm ayrıca `Game`
 * sətridir. Detal səhifəsindəki "franchise seed" (başlığın ilk 1–2 sözü)
 * evristikası bura yaramır — "God of" bütün God of War seriyasını tutur, halbuki
 * bizə MƏHZ eyni oyunun sürümləri lazımdır.
 *
 * Yanaşma: başlıqdan sürüm sonəkini kəsib "baza başlıq" alırıq. Kəsmə AÇGÖZ
 * DEYİL — yalnız TANINAN keyfiyyətləndirici sözlər geriyə doğru atılır və ilk
 * tanınmayan sözdə dayanılır. Açgöz kəsmə "God of War Dijital Deluxe Sürüm"-ü
 * "God of"-a çevirərdi; bu üsul düzgün olaraq "God of War" verir.
 *
 * Baza başlıq HEÇ VAXT tək başına həqiqət sayılmır — admin yekun siyahını
 * təsdiqləyir (`Reel.editionGameIds`), ona görə səhv qruplaşma müştəriyə çatmır.
 */

/** Sürüm sonəkini başladan açar sözlər (TR + EN, PS Store TR mağazası qarışıqdır). */
const EDITION_KEYWORDS = new Set([
  "edition",
  "editions",
  "surum",
  "surumu",
  "edisyon",
  "edisyonu",
]);

/**
 * Açar sözdən ƏVVƏL gələ bilən keyfiyyətləndiricilər. Geriyə gedərkən yalnız
 * bunlar atılır — siyahıda olmayan ilk sözdə dayanırıq, beləliklə oyunun öz adı
 * kəsilmir ("WWE 2K25 Standard Edition" → "2K25" tanınmır → "WWE 2K25").
 */
const EDITION_QUALIFIERS = new Set([
  // EN
  "complete", "gold", "standard", "definitive", "enhanced", "ultimate", "deluxe",
  "digital", "console", "royal", "premium", "legendary", "classic", "special",
  "anniversary", "goty", "brutal", "remastered", "remaster", "collectors",
  "collector", "collectors'", "collector's", "directors", "director's", "cut",
  "game", "of", "the", "year", "day", "one", "launch", "grand", "slam",
  // TR (diakritikasız — müqayisə foldEdilmiş mətn üzərindədir)
  "standart", "dijital", "efsanevi", "klasik", "eksiksiz", "luks", "ozel",
  "yonetmenin", "yil", "donumu", "altin", "tam", "oyun",
]);

/** Sonda gələn platforma quyruqları — "PS4 ve PS5", "PS4 & PS5", "PS5". */
const PLATFORM_TAIL = /\s*(?:[-–—:|(]\s*)?\bPS[45](?:\s*(?:&|ve|and|\+|,|\/)\s*PS[45])*\s*\)?\s*$/i;

/**
 * Müqayisə üçün normallaşdırma: diakritikaları atır, kiçik hərfə salır.
 * Türk "İ"/"ı" hərfləri `toLowerCase()`-də birləşən nöqtə yaradır, ona görə NFD
 * ayırıb birləşən işarələri silirik — "YÖNETMENİN" → "yonetmenin".
 */
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .toLowerCase();
}

/** Tokenin sırf ayırıcı olub-olmadığı ("-", "–", ":", "|"). */
function isSeparator(token: string): boolean {
  return /^[-–—:|,()]+$/.test(token);
}

/** "25." kimi nömrəli keyfiyyətləndirici (yıl dönümü sürümləri). */
function isOrdinalNumber(token: string): boolean {
  return /^\d{1,4}\.$/.test(token);
}

/**
 * Başlıqdan sürüm sonəkini + platforma quyruğunu atıb BAZA başlığı qaytarır.
 * Sürüm sonəki yoxdursa təmizlənmiş başlığın özünü verir.
 *
 *   "EA SPORTS FC™ 26 Ultimate Sürüm PS4 ve PS5" → "EA SPORTS FC 26"
 *   "Sekiro™: Shadows Die Twice - Game of the Year Sürümü" → "Sekiro: Shadows Die Twice"
 *   "God of War™ Dijital Deluxe Sürüm" → "God of War"
 *   "God of War Ragnarök" → "God of War Ragnarök"   (sonək yoxdur, toxunulmur)
 */
export function baseGameTitle(rawTitle: string): string {
  const cleaned = rawTitle
    // Boşluqla DEYİL, silinməklə: "Sekiro™:" boşluqla "Sekiro :" olur və
    // ayırıcı ayrıca tokenə çevrilib nəticəyə sızır.
    .replace(/[™®©]/g, "")
    .replace(PLATFORM_TAIL, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";

  const tokens = cleaned.split(" ");

  // Sürüm açar sözünün SON təkrarını tap (bəzi başlıqlarda söz adın içindədir).
  let keywordIdx = -1;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = fold(tokens[i]).replace(/[^a-z0-9']/g, "");
    if (EDITION_KEYWORDS.has(t)) {
      keywordIdx = i;
      break;
    }
  }
  if (keywordIdx === -1) return cleaned;

  // Açar sözdən geriyə: yalnız tanınan keyfiyyətləndiriciləri at.
  let cut = keywordIdx;
  while (cut > 0) {
    const prev = tokens[cut - 1];
    const folded = fold(prev).replace(/[^a-z0-9'.]/g, "");
    if (isSeparator(prev) || isOrdinalNumber(folded) || EDITION_QUALIFIERS.has(folded)) {
      cut--;
      continue;
    }
    break;
  }

  // Hər şey kəsilirdisə (məs. başlıq sırf "Gold Edition"), orijinalı saxla —
  // boş baza başlıq bütün kataloqu namizəd edərdi.
  if (cut === 0) return cleaned;

  return tokens
    .slice(0, cut)
    .join(" ")
    .replace(/[\s\-–—:|,]+$/, "")
    .trim();
}

/** İki başlıq eyni oyunun sürümləridirmi? (baza başlıqlar üst-üstə düşürmü) */
export function isSameGameFamily(titleA: string, titleB: string): boolean {
  const a = fold(baseGameTitle(titleA));
  const b = fold(baseGameTitle(titleB));
  return a.length > 0 && a === b;
}

/**
 * Çipdə göstəriləcək sürüm adı — başlıqdan baza hissəni çıxarıb qalanı verir:
 *   "God of War Ragnarök Dijital Deluxe Sürüm" → "Dijital Deluxe Sürüm"
 *   "Injustice 2 - Standart Sürüm"             → "Standart Sürüm"
 *   "God of War Ragnarök"                      → "Standart"  (sonək yoxdur)
 *
 * `editionLabel` sütununu İŞLƏTMİRİK: onun ən çox rast gəlinən dəyəri "Tam Sürüm
 * Oyun"-dur (3499 sətir) və sürümləri bir-birindən AYIRMIR. Başlıq fərqi isə
 * məhz sürümün adıdır.
 */
export function editionSuffixLabel(title: string): string {
  const cleaned = title.replace(/[™®©]/g, "").replace(/\s+/g, " ").trim();
  const base = baseGameTitle(title);
  if (!base || cleaned.length <= base.length) return "Standart";
  const suffix = cleaned
    .slice(base.length)
    .replace(/^[\s\-–—:|,]+/, "")
    .replace(PLATFORM_TAIL, "")
    .trim();
  return suffix.length > 0 ? suffix : "Standart";
}

/**
 * SQL `startsWith` üçün prefiks. Baza başlığın ilk hissəsini verir; dəqiq
 * uyğunluq sonra `isSameGameFamily` ilə JS-də süzülür (SQL-də baza başlığı
 * hesablaya bilmirik). Recall SQL-dən, precision JS-dən.
 */
export function editionSearchPrefix(title: string): string {
  const base = baseGameTitle(title);
  // Diakritika/™ fərqləri prefiksi sındırmasın deyə ilk "təhlükəsiz" hissəni al:
  // ilk xüsusi simvola qədər (apostrof, tire, iki nöqtə) kəsirik.
  const safe = base.split(/[:\-–—(]/)[0].trim();
  return safe.length >= 3 ? safe : base;
}
