/**
 * Oyun axtarışı üçün sorğu normallaşdırması (SAF funksiyalar — DB yoxdur).
 *
 * Əvvəl həm navbar, həm kataloq sadəcə `title ILIKE '%q%'` işlədirdi. Real
 * kataloqda bu, aşağıdakı sorğuların HAMISINDA 0 nəticə verirdi:
 *
 *   "gta 5"                → başlıq "Grand Theft Auto V"        (abbreviatura + rum rəqəmi)
 *   "spiderman"            → başlıq "Marvel's Spider-Man"       (defis/apostrof)
 *   "god of war ragnarok"  → başlıq "God of War Ragnarök"       (diakritik)
 *   "fifa"                 → başlıq "EA SPORTS FC 26"           (seriya adı dəyişib)
 *
 * Ona görə sorğu burada **qrup-qrup** parçalanır: hər söz üçün qəbul edilən
 * variantlar (abbreviatura açılışı, rum⇄ərəb rəqəmi) hazırlanır, SQL tərəfi
 * isə başlığı eyni qaydada normallaşdırıb ("Marvel’s Spider-Man 2" →
 * "marvel s spider man 2") qruplara qarşı yoxlayır — bax lib/gameSearchSql.ts.
 *
 * ⚠️ Dəyişiklikdən sonra `npm run test:gamesearch` işlət.
 */
import { slugifyText } from "@/lib/gameSlug";

/**
 * SQL tərəfdə başlığı `slugifyText`-lə EYNİ hərflərə gətirən `translate()`
 * cütü. İki sətir hərf-hərf uyğunlaşır, ona görə uzunluqları bərabər
 * olmalıdır (testdə yoxlanılır). Yalnız kiçik hərflər var — SQL əvvəlcə
 * `lower()` tətbiq edir.
 */
export const TITLE_TRANSLATE_FROM = "ışğüöçəâîûáàäåãéèêëíìïóòôõøúùñýÿ";
export const TITLE_TRANSLATE_TO = "isguoceaiuaaaaaeeeeiiiooooouunyy";

/**
 * Axtarışa heç nə əlavə etməyən sözlər. "spiderman 2 ps5" yazan istifadəçi
 * "ps5"-i platforma kimi yazır — başlıqda olmadığı üçün bütün nəticəni
 * öldürürdü.
 */
const STOPWORDS = new Set([
  "ps",
  "ps4",
  "ps5",
  "playstation",
  "oyun",
  "oyunu",
  "oyunlari",
  "game",
  "satin",
  "al",
  "ucuz",
]);

/**
 * Abbreviatura → tam ad. Yalnız KİFAYƏT QƏDƏR spesifik qısaltmalar var:
 * "re" (Resident Evil) və ya "gt" kimi 2 hərfli ümumi tokenlər qəsdən
 * daxil edilməyib — onlar kataloqu zibilləyər.
 *
 * Dəyərlər artıq normallaşdırılmış formadadır (kiçik hərf, yalnız a-z0-9 və
 * boşluq).
 */
const ALIASES: Record<string, string[]> = {
  gta: ["grand theft auto"],
  cod: ["call of duty"],
  mw: ["modern warfare"],
  rdr: ["red dead redemption"],
  gow: ["god of war"],
  // FIFA seriyası "EA SPORTS FC" adına keçib — köhnə adı yazan müştəri
  // kataloqda heç nə tapmırdı.
  fifa: ["ea sports fc", "fc"],
  pes: ["efootball", "pro evolution soccer"],
  nfs: ["need for speed"],
  tlou: ["the last of us"],
  mk: ["mortal kombat"],
  ac: ["assassins creed", "assassin s creed"],
  gtr: ["gran turismo"],
  cp2077: ["cyberpunk 2077"],
  botw: ["breath of the wild"],
  ff: ["final fantasy"],
  dbz: ["dragon ball z"],
  wz: ["warzone"],
};

/** Rum rəqəmi ⇄ ərəb rəqəmi. "gta 5" ↔ "Grand Theft Auto V". */
const ARABIC_TO_ROMAN: Record<string, string> = {
  "1": "i",
  "2": "ii",
  "3": "iii",
  "4": "iv",
  "5": "v",
  "6": "vi",
  "7": "vii",
  "8": "viii",
  "9": "ix",
  "10": "x",
};
const ROMAN_TO_ARABIC: Record<string, string> = Object.fromEntries(
  Object.entries(ARABIC_TO_ROMAN).map(([a, r]) => [r, a])
);

export type GameSearchTerms = {
  /** İstifadəçinin yazdığı orijinal mətn (similarity() üçün lazımdır). */
  raw: string;
  /** Normallaşdırılmış tam ifadə: "marvels spider man 2". */
  phrase: string;
  /** Boşluqsuz forma: "marvelsspiderman2" — defis/apostrof fərqlərini udur. */
  squashed: string;
  /** Hər sorğu sözü üçün qəbul edilən variantlar (OR), qruplar arası AND. */
  groups: string[][];
  /**
   * Uyğun sayılmaq üçün lazım olan minimum qrup sayı. 4+ sözlü sorğuda bir
   * söz "buraxılır" — uzun sorğularda istifadəçi çox vaxt başlıqda olmayan
   * bir söz əlavə edir, sıralama onsuz da tam uyğunları yuxarı çıxarır.
   */
  required: number;
};

/** Tokeni variantlara açır: abbreviatura + rum/ərəb rəqəmi. */
function expandToken(token: string): string[] {
  const out = [token];
  for (const alias of ALIASES[token] ?? []) out.push(alias);
  const roman = ARABIC_TO_ROMAN[token];
  if (roman) out.push(roman);
  const arabic = ROMAN_TO_ARABIC[token];
  if (arabic) out.push(arabic);
  return Array.from(new Set(out));
}

/**
 * "gta5" → ["gta", "5"]. İstifadəçi seriya adı ilə nömrəni bitişik yazanda
 * (çox yayılmışdır) tək token heç bir başlığa uyğun gəlmirdi.
 */
function splitAlphaNumeric(token: string): string[] {
  const m = /^([a-z]{2,})(\d{1,4})$/.exec(token);
  if (!m) return [token];
  // Bitişik forma özü də tanınan abbreviaturadırsa (məs. "cp2077") onu
  // parçalamırıq — alias siyahısı daha dəqiq nəticə verir.
  if (ALIASES[token]) return [token];
  return [m[1], m[2]];
}

export function buildGameSearchTerms(raw: string): GameSearchTerms {
  // `slugifyText` transliterasiya + diakritik təmizləməsi + apostrof silinməsi
  // ilə tam olaraq SQL tərəfindəki normallaşdırmanı təkrarlayır.
  const rawTokens = slugifyText(raw).split("-").filter(Boolean);

  // Stopword-lar atılır, amma sorğu YALNIZ onlardan ibarətdirsə saxlanılır
  // ("ps5" yazan istifadəçi də nəsə görməlidir).
  //
  // ⚠️ Süzgəc hərf/rəqəm ayrılmasından ƏVVƏL işləməlidir: "ps5" sonra
  // parçalansaydı, arxada qalan "5" başlıqda tələb olunardı və
  // "spiderman 2 ps5" heç nə tapmazdı.
  const meaningful = rawTokens.filter((t) => !STOPWORDS.has(t));
  const tokens = (meaningful.length > 0 ? meaningful : rawTokens).flatMap(
    splitAlphaNumeric
  );

  const groups = tokens.map(expandToken);
  const phrase = tokens.join(" ");
  const squashed = tokens.join("");
  const required = groups.length <= 3 ? groups.length : groups.length - 1;

  return { raw: raw.trim(), phrase, squashed, groups, required };
}

/* ─── Referans (JS) implementasiyası ──────────────────────────────────────
 *
 * Aşağıdakılar SQL tərəfinin (lib/gameSearchSql.ts) eynisidir və testin
 * ("npm run test:gamesearch") DB-siz işləməsi üçün var. SQL-i dəyişəndə
 * BURANI DA dəyiş — iki tərəf ayrılsa test yaşıl qalıb istifadəçi boş nəticə
 * görər.
 */

const TRANSLATE_MAP: Record<string, string> = Object.fromEntries(
  [...TITLE_TRANSLATE_FROM].map((ch, i) => [ch, TITLE_TRANSLATE_TO[i]])
);

/** SQL-dəki LATERAL ifadəsinin JS qarşılığı. */
export function normalizeTitleForSearch(title: string): { n: string; s: string } {
  let translated = "";
  for (const ch of title.toLowerCase()) translated += TRANSLATE_MAP[ch] ?? ch;
  const n = ` ${translated.replace(/[^a-z0-9]+/g, " ")} `;
  return { n, s: n.replace(/ /g, "") };
}

function variantMatches(variant: string, n: string, s: string): boolean {
  if (n.includes(` ${variant}`)) return true;
  const squashed = variant.replace(/ /g, "");
  return squashed.length >= 4 && s.includes(squashed);
}

/** Başlıq sorğuya uyğun gəlirmi (similarity() budağı istisna — o, DB-dədir). */
export function titleMatchesTerms(terms: GameSearchTerms, title: string): boolean {
  const { n, s } = normalizeTitleForSearch(title);
  if (terms.groups.length === 0) {
    return title.toLowerCase().includes(terms.raw.toLowerCase());
  }
  const matched = terms.groups.filter((g) =>
    g.some((v) => variantMatches(v, n, s))
  ).length;
  return matched >= terms.required;
}
