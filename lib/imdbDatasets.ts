/**
 * IMDb rəsmi dataset-lərinin (datasets.imdbws.com) SAF parse qatı.
 *
 * Burada şəbəkə də, DB də yoxdur — yalnız TSV sətirlərini oxuyub hansı adın
 * seçiləcəyinə qərar verir. Səbəb: ad seçimi məntiqi işin ƏN SƏHVƏ MEYİLLİ
 * hissəsidir (bir başlığın IMDb-də 40-a qədər aka sətri olur) və onu DB/şəbəkə
 * olmadan `npm run test:imdb` ilə kilidləmək istəyirik.
 *
 * İki fayl işlədilir:
 *   title.ratings.tsv.gz — tconst, averageRating, numVotes
 *   title.akas.tsv.gz    — titleId, ordering, title, region, language, types,
 *                          attributes, isOriginalTitle
 *
 * Niyə OMDb/TMDB deyil? — hər ikisi başlıq başına bir HTTP sorğu tələb edir
 * (2000 başlıq = 2000 sorğu, OMDb-də gündə 1000 limit). Dataset-lər pulsuzdur,
 * açar istəmir, limitsizdir və IMDb xalını REAL verir (TMDB `vote_average`
 * yaxın olsa da fərqli metrikdir).
 */

/** IMDb TSV-də boş xana `\N` ilə yazılır (boş string ilə deyil). */
const NULL_TOKEN = "\\N";

/** Datasetdə maraqlandığımız hədəf dillər. Orijinal ad bundan ASILI DEYİL —
 *  o, `isOriginalTitle` bayrağı ilə ayrıca seçilir. */
export const TARGET_LANGS = ["tr", "ru", "en"] as const;
export type TargetLang = (typeof TARGET_LANGS)[number];

/**
 * IMDb bəzi sətirlərdə `language` xanasını boş qoyub yalnız `region` yazır
 * ("Yüzüklerin Efendisi" → region=TR, language=\N). Bu map həmin sətirləri
 * xilas edir.
 *
 * Qəsdən DARDIR: yalnız dili birmənalı olan regionlar var. Məsələn CA (Kanada)
 * həm ingilis, həm fransızdır — daxil edilsə fransızca adlar "en" kimi yazılardı.
 * SU (SSRİ) köhnə sətirlərdə rusca adları daşıyır, ona görə saxlanılıb.
 */
const REGION_TO_LANG: Record<string, TargetLang> = {
  TR: "tr",
  RU: "ru",
  SU: "ru",
  US: "en",
  GB: "en",
  IE: "en",
  NZ: "en",
};

/**
 * `types` xanasındakı zəif etiketlər — bunlar rəsmi vitrin adı deyil.
 * "working" çəkiliş dövrünün adıdır, "alternative"/"festival" ikinci dərəcəli,
 * "video"/"dvd"/"tv" isə konkret buraxılış formatına aiddir.
 */
const WEAK_TYPES = new Set(["working", "alternative", "festival", "video", "dvd", "tv"]);

/** IMDb-nin öz vitrin adı — ən güclü siqnal. */
const DISPLAY_TYPE = "imdbDisplay";

/** Bir `title.akas.tsv` sətri (yalnız işlətdiyimiz xanalar). */
export interface AkaRow {
  /** tconst — məs. "tt0120737". */
  titleId: string;
  /** IMDb-nin öz sıra nömrəsi; bərabər hallarda kiçik olan üstündür. */
  ordering: number;
  title: string;
  /** ISO 3166-1 region kodu, boşdursa null. */
  region: string | null;
  /** ISO 639-1 dil kodu, boşdursa null. */
  language: string | null;
  types: string[];
  attributes: string[];
  isOriginalTitle: boolean;
}

/** Bir başlıq üçün seçilmiş ad. */
export interface PickedName {
  lang: string;
  name: string;
  isOriginal: boolean;
}

export interface RatingRow {
  titleId: string;
  averageRating: number;
  numVotes: number;
}

/** Başlıq sətrindən sütun adı → indeks map-i. Sütun sırası dəyişsə də kod
 *  sınmasın deyə indeksləri sabit yazmırıq. */
export function parseHeader(line: string): Record<string, number> {
  const out: Record<string, number> = {};
  line.split("\t").forEach((name, i) => {
    out[name.trim()] = i;
  });
  return out;
}

/** `\N` → null, əks halda trim olunmuş string. */
function cell(cells: string[], index: number | undefined): string | null {
  if (index === undefined) return null;
  const raw = cells[index];
  if (raw === undefined) return null;
  const v = raw.trim();
  if (v === "" || v === NULL_TOKEN) return null;
  return v;
}

/** Vergüllə ayrılmış çoxdəyərli xana (`types`, `attributes`). */
function listCell(cells: string[], index: number | undefined): string[] {
  const v = cell(cells, index);
  if (!v) return [];
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * `title.akas.tsv` sətrini oxuyur. Yararsız sətir (titleId və ya title boş)
 * üçün `null` qaytarır — caller onu sadəcə atır.
 */
export function parseAkaLine(line: string, cols: Record<string, number>): AkaRow | null {
  const cells = line.split("\t");
  const titleId = cell(cells, cols.titleId);
  const title = cell(cells, cols.title);
  if (!titleId || !title) return null;

  const orderingRaw = cell(cells, cols.ordering);
  const ordering = orderingRaw ? Number(orderingRaw) : Number.MAX_SAFE_INTEGER;

  return {
    titleId,
    ordering: Number.isFinite(ordering) ? ordering : Number.MAX_SAFE_INTEGER,
    title,
    region: cell(cells, cols.region)?.toUpperCase() ?? null,
    language: cell(cells, cols.language)?.toLowerCase() ?? null,
    types: listCell(cells, cols.types),
    attributes: listCell(cells, cols.attributes),
    isOriginalTitle: cell(cells, cols.isOriginalTitle) === "1",
  };
}

/**
 * `title.ratings.tsv` sətrini oxuyur. Reytinq və ya səs sayı rəqəm deyilsə
 * `null` — yarımçıq sətri DB-yə yazmaqdansa atmaq düzgündür.
 */
export function parseRatingLine(line: string, cols: Record<string, number>): RatingRow | null {
  const cells = line.split("\t");
  const titleId = cell(cells, cols.tconst);
  if (!titleId) return null;

  // `Number(null)` SIFIRDIR — boş xananı birbaşa Number()-a vermək boş reytinqi
  // "0.0" kimi DB-yə yazardı. Ona görə null yoxlaması ayrıca gedir.
  const ratingRaw = cell(cells, cols.averageRating);
  const votesRaw = cell(cells, cols.numVotes);
  if (ratingRaw === null || votesRaw === null) return null;

  const rating = Number(ratingRaw);
  const votes = Number(votesRaw);
  if (!Number.isFinite(rating) || !Number.isFinite(votes)) return null;

  return { titleId, averageRating: rating, numVotes: Math.trunc(votes) };
}

/** Sətrin hansı hədəf dilə aid olduğunu təyin edir (yoxdursa null). */
export function resolveLang(row: AkaRow): TargetLang | null {
  if (row.language) {
    const direct = TARGET_LANGS.find((l) => l === row.language);
    if (direct) return direct;
    // Dil xanası dolu, amma hədəflərimizdən deyil (məs. "de") — region-a
    // BAXMIRIQ: almanca ad "region=US" sətrində gələ bilər, onu "en" saymaq
    // istifadəçiyə səhv ad göstərərdi.
    return null;
  }
  if (row.region) return REGION_TO_LANG[row.region] ?? null;
  return null;
}

/**
 * Eyni dildəki namizədlər arasında hansının üstün olduğunu ölçür — böyük bal
 * qazanır. Bərabərlik `ordering` ilə pozulur (caller-də).
 *
 * Ağırlıqların sırası TƏSADÜFİ DEYİL — `imdbDisplay` ən güclüsüdür, çünki o,
 * IMDb-nin həmin bölgə üçün rəsmi vitrin adıdır. Əvvəlcə açıq `language` xanası
 * daha ağır idi və LOTR-də ingiliscə ad kimi "The Fellowship of the Ring"
 * (region=XWW, attributes="short title") seçilirdi — tam ad isə region=US
 * sətrində, `language` xanası boş halda dururdu. Yəni "dili açıq yazılıb"
 * keyfiyyət göstəricisi deyil, sadəcə xananın doldurulmasıdır.
 *
 * Zəif tip cəzası (-200) hər şeyi üstələyir: `working` adı heç bir halda
 * vitrinə çıxmamalıdır.
 */
export function scoreAka(row: AkaRow): number {
  let score = 0;
  if (row.types.includes(DISPLAY_TYPE)) score += 100; // IMDb-nin rəsmi vitrin adı
  if (row.language) score += 30; // açıq dil xanası — zəif, amma faydalı siqnal
  if (row.types.some((t) => WEAK_TYPES.has(t))) score -= 200;
  // "short title", "informal title", "closing credits title" və s. — tam ad üstündür.
  if (row.attributes.length > 0) score -= 60;
  return score;
}

/**
 * Bir başlığın BÜTÜN aka sətirlərindən yekun ad siyahısını qurur:
 * hər hədəf dil üçün ən yaxşı bir ad + orijinal ad.
 *
 * @param rows    Eyni `titleId`-yə aid sətirlər (sırası əhəmiyyətsizdir).
 * @param fallbackOriginalLang
 *   Orijinal sətrin dili boşdursa istifadə olunan ehtiyat kod (adətən TMDB-dən
 *   gələn `original_language`). O da yoxdursa ISO 639-2 `"und"` (undetermined)
 *   yazılır — uydurma kod işlətməmək üçün.
 */
export function pickNames(rows: AkaRow[], fallbackOriginalLang?: string | null): PickedName[] {
  const best = new Map<TargetLang, { row: AkaRow; score: number }>();
  let original: AkaRow | null = null;

  for (const row of rows) {
    if (row.isOriginalTitle && (original === null || row.ordering < original.ordering)) {
      original = row;
    }

    const lang = resolveLang(row);
    if (!lang) continue;

    const score = scoreAka(row);
    const prev = best.get(lang);
    // Bərabər balda IMDb-nin öz sırası (kiçik `ordering`) həll edir.
    if (!prev || score > prev.score || (score === prev.score && row.ordering < prev.row.ordering)) {
      best.set(lang, { row, score });
    }
  }

  const out: PickedName[] = [];
  // `(lang, name)` DB-də primary key-in bir hissəsidir — eyni cütü iki dəfə
  // qaytarsaq createMany dublikat atar.
  const seen = new Set<string>();
  function push(lang: string, name: string, isOriginal: boolean) {
    const key = `${lang} ${name}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ lang, name, isOriginal });
  }

  if (original) {
    const lang =
      original.language ??
      (original.region ? REGION_TO_LANG[original.region] : null) ??
      fallbackOriginalLang?.toLowerCase() ??
      "und";
    push(lang, original.title, true);
  }

  for (const lang of TARGET_LANGS) {
    const hit = best.get(lang);
    if (hit) push(lang, hit.row.title, false);
  }

  return out;
}

/**
 * Ad siyahısından axtarış üçün tək sətir qurur (hamısı kiçik hərflə, `\n` ilə).
 *
 * Niyə massiv yox, tək string? — kataloq RSC payload-una ~2000 başlıq düşür;
 * tək string massivdən həm kiçikdir, həm də client-də bir `includes()` ilə
 * yoxlanır (dil başına ayrıca dövr yox).
 */
export function buildSearchText(mainTitle: string, names: Array<{ name: string }>): string {
  const parts = new Set<string>();
  parts.add(mainTitle.toLowerCase());
  for (const n of names) parts.add(n.name.toLowerCase());
  return [...parts].join("\n");
}
