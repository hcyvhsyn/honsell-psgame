/**
 * lib/imdbDatasets.ts testləri — `npm run test:imdb`.
 *
 * Bu məntiq sınsa müştəri kataloqda YANLIŞ ad görür (məsələn almanca adı
 * ingiliscə kimi) və ya axtarışda filmi tapa bilmir. Fixture-lar IMDb
 * `title.akas.tsv` faylının real sətir formatındadır. DB/şəbəkə tələb etmir.
 */
import {
  buildSearchText,
  parseAkaLine,
  parseHeader,
  parseRatingLine,
  pickNames,
  resolveLang,
  scoreAka,
  type AkaRow,
} from "../lib/imdbDatasets";

let failed = 0;

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  ok   ${name}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}${detail ? `\n         ${detail}` : ""}`);
  }
}

function eq(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  check(name, a === e, `gözlənilən ${e}\n         alınan     ${a}`);
}

const AKA_HEADER = "titleId\tordering\ttitle\tregion\tlanguage\ttypes\tattributes\tisOriginalTitle";
const RATING_HEADER = "tconst\taverageRating\tnumVotes";

const akaCols = parseHeader(AKA_HEADER);
const ratingCols = parseHeader(RATING_HEADER);

/** Fixture-ları oxunaqlı yazmaq üçün — `\N` boş xanadır. */
function aka(line: string): AkaRow {
  const row = parseAkaLine(line, akaCols);
  if (!row) throw new Error(`fixture parse olunmadı: ${line}`);
  return row;
}

console.log("\n── başlıq sətri və xana oxunuşu ────────────────────────────");
eq("parseHeader sütun indeksləri", akaCols, {
  titleId: 0,
  ordering: 1,
  title: 2,
  region: 3,
  language: 4,
  types: 5,
  attributes: 6,
  isOriginalTitle: 7,
});

const originalRow = aka("tt0120737\t1\tThe Lord of the Rings: The Fellowship of the Ring\t\\N\t\\N\toriginal\t\\N\t1");
eq("`\\N` region/language → null", [originalRow.region, originalRow.language], [null, null]);
check("isOriginalTitle=1 → true", originalRow.isOriginalTitle);
eq("types tək dəyər", originalRow.types, ["original"]);

const multiTypes = aka("tt1\t2\tAd\tUS\ten\timdbDisplay,alternative\tshort title,informal title\t0");
eq("types vergüllə bölünür", multiTypes.types, ["imdbDisplay", "alternative"]);
eq("attributes vergüllə bölünür", multiTypes.attributes, ["short title", "informal title"]);
check("isOriginalTitle=0 → false", multiTypes.isOriginalTitle === false);
check("region böyük, language kiçik hərfə salınır", multiTypes.region === "US" && multiTypes.language === "en");

check("titleId boşdursa sətir atılır", parseAkaLine("\\N\t1\tAd\tUS\ten\t\\N\t\\N\t0", akaCols) === null);
check("title boşdursa sətir atılır", parseAkaLine("tt1\t1\t\\N\tUS\ten\t\\N\t\\N\t0", akaCols) === null);

console.log("\n── reytinq sətri ───────────────────────────────────────────");
eq("düzgün reytinq sətri", parseRatingLine("tt0120737\t8.9\t2069000", ratingCols), {
  titleId: "tt0120737",
  averageRating: 8.9,
  numVotes: 2069000,
});
check("rəqəm olmayan reytinq atılır", parseRatingLine("tt1\tabc\t100", ratingCols) === null);
check("rəqəm olmayan səs sayı atılır", parseRatingLine("tt1\t7.5\t\\N", ratingCols) === null);
check("tconst boşdursa atılır", parseRatingLine("\\N\t7.5\t100", ratingCols) === null);

console.log("\n── dil təyini (ən səhvə meyilli hissə) ─────────────────────");
eq(
  "açıq language xanası oxunur",
  resolveLang(aka("tt1\t1\tAd\t\\N\tru\t\\N\t\\N\t0")),
  "ru"
);
eq(
  "language boşdursa region-dan çıxarılır (TR→tr)",
  resolveLang(aka("tt1\t1\tYüzüklerin Efendisi\tTR\t\\N\timdbDisplay\t\\N\t0")),
  "tr"
);
eq("SU (SSRİ) regionu → ru", resolveLang(aka("tt1\t1\tАд\tSU\t\\N\t\\N\t\\N\t0")), "ru");
eq("GB regionu → en", resolveLang(aka("tt1\t1\tName\tGB\t\\N\t\\N\t\\N\t0")), "en");
// Bu, sistemin ən vacib qorunmasıdır: almanca ad US regionunda görünə bilər.
eq(
  "hədəf olmayan dil region-a GÖRƏ xilas edilmir (de + US ≠ en)",
  resolveLang(aka("tt1\t1\tDie Gefährten\tUS\tde\t\\N\t\\N\t0")),
  null
);
eq(
  "hədəf olmayan region atılır (DE)",
  resolveLang(aka("tt1\t1\tDie Gefährten\tDE\t\\N\timdbDisplay\t\\N\t0")),
  null
);
eq(
  "iki dilli region (CA) qəbul edilmir",
  resolveLang(aka("tt1\t1\tNom\tCA\t\\N\timdbDisplay\t\\N\t0")),
  null
);

console.log("\n── namizəd balı ────────────────────────────────────────────");
const display = aka("tt1\t9\tYüzüklerin Efendisi: Yüzük Kardeşliği\tTR\t\\N\timdbDisplay\t\\N\t0");
const working = aka("tt1\t5\tYüzük Kardeşliği\tTR\ttr\tworking\t\\N\t0");
check("zəif tip (working) vitrin adını üstələmir", scoreAka(display) > scoreAka(working));

const clean = aka("tt1\t3\tThe Fellowship of the Ring\tUS\ten\timdbDisplay\t\\N\t0");
const withAttrs = aka("tt1\t4\tFellowship\tUS\ten\timdbDisplay\tshort title\t0");
check("attributes olan ad aşağı düşür", scoreAka(clean) > scoreAka(withAttrs));

const explicitLang = aka("tt1\t8\tИмя\t\\N\tru\t\\N\t\\N\t0");
const regionOnly = aka("tt1\t2\tИмя2\tRU\t\\N\t\\N\t\\N\t0");
check("açıq dil xanası region-dan güclüdür", scoreAka(explicitLang) > scoreAka(regionOnly));

console.log("\n── yekun ad seçimi: LOTR (tt0120737) ───────────────────────");
const lotr = [
  "tt0120737\t1\tThe Lord of the Rings: The Fellowship of the Ring\t\\N\t\\N\toriginal\t\\N\t1",
  "tt0120737\t10\tYüzüklerin Efendisi: Yüzük Kardeşliği\tTR\t\\N\timdbDisplay\t\\N\t0",
  "tt0120737\t11\tYüzük Kardeşliği\tTR\ttr\tworking\t\\N\t0",
  "tt0120737\t23\tВластелин колец: Братство кольца\tRU\t\\N\timdbDisplay\t\\N\t0",
  "tt0120737\t12\tDer Herr der Ringe: Die Gefährten\tDE\t\\N\timdbDisplay\t\\N\t0",
  "tt0120737\t36\tThe Lord of the Rings: The Fellowship of the Ring\tUS\t\\N\timdbDisplay\t\\N\t0",
  "tt0120737\t40\tThe Fellowship of the Ring\tXWW\ten\t\\N\tshort title\t0",
].map(aka);

const lotrNames = pickNames(lotr, "en");
eq("LOTR — orijinal + tr + ru + en", lotrNames, [
  { lang: "en", name: "The Lord of the Rings: The Fellowship of the Ring", isOriginal: true },
  { lang: "tr", name: "Yüzüklerin Efendisi: Yüzük Kardeşliği", isOriginal: false },
  { lang: "ru", name: "Властелин колец: Братство кольца", isOriginal: false },
]);
check(
  "almanca ad heç bir dilə düşmür",
  !lotrNames.some((n) => n.name.includes("Herr der Ringe"))
);
check(
  "eyni (lang,name) cütü təkrarlanmır (PK dublikatı)",
  new Set(lotrNames.map((n) => `${n.lang} ${n.name}`)).size === lotrNames.length
);

console.log("\n── yekun ad seçimi: orijinal dili latın əlifbası deyil ──────");
const squid = [
  "tt10919420\t1\t오징어 게임\t\\N\t\\N\toriginal\t\\N\t1",
  "tt10919420\t5\tSquid Game\tUS\t\\N\timdbDisplay\t\\N\t0",
  "tt10919420\t9\tSquid Game\tTR\t\\N\timdbDisplay\t\\N\t0",
  "tt10919420\t12\tИгра в кальмара\tRU\t\\N\timdbDisplay\t\\N\t0",
].map(aka);

eq("TMDB-dən gələn orijinal dil işarəsi işlədilir", pickNames(squid, "ko"), [
  { lang: "ko", name: "오징어 게임", isOriginal: true },
  { lang: "tr", name: "Squid Game", isOriginal: false },
  { lang: "ru", name: "Игра в кальмара", isOriginal: false },
  { lang: "en", name: "Squid Game", isOriginal: false },
]);

// Kataloqdakı başlıqların əksəriyyətində `originalLanguage` boşdur — həmin
// halda uydurma kod yox, ISO 639-2 "und" yazılır.
eq(
  "işarə yoxdursa orijinal dil `und` olur",
  pickNames(squid, null)[0],
  { lang: "und", name: "오징어 게임", isOriginal: true }
);

console.log("\n── kənar hallar ────────────────────────────────────────────");
eq("aka sətri yoxdursa boş siyahı", pickNames([], "en"), []);
eq(
  "yalnız orijinal sətir varsa tək ad",
  pickNames([aka("tt2\t1\tRoma\t\\N\tit\toriginal\t\\N\t1")], null),
  [{ lang: "it", name: "Roma", isOriginal: true }]
);

// Orijinal ad ingiliscədirsə və US sətri eyni adı verirsə iki ayrı sətir
// yaranmamalıdır — `en` artıq orijinal kimi yazılıb.
const sameName = [
  "tt3\t1\tDune\t\\N\ten\toriginal\t\\N\t1",
  "tt3\t2\tDune\tUS\t\\N\timdbDisplay\t\\N\t0",
].map(aka);
eq("orijinal = ingiliscə ad → tək sətir", pickNames(sameName, "en"), [
  { lang: "en", name: "Dune", isOriginal: true },
]);

// Bərabər balda IMDb-nin öz sırası həll etməlidir (determinizm — idxal hər
// dəfə eyni adı seçməlidir, yoxsa DB-də ad "titrəyir").
const tie = [
  "tt4\t7\tİkinci\tTR\t\\N\timdbDisplay\t\\N\t0",
  "tt4\t3\tBirinci\tTR\t\\N\timdbDisplay\t\\N\t0",
].map(aka);
eq("bərabər balda kiçik ordering qazanır", pickNames(tie, null), [
  { lang: "tr", name: "Birinci", isOriginal: false },
]);
eq(
  "sətir sırası nəticəni dəyişmir (determinizm)",
  pickNames([...tie].reverse(), null),
  pickNames(tie, null)
);

console.log("\n── axtarış mətni ───────────────────────────────────────────");
eq(
  "bütün adlar kiçik hərflə birləşir",
  buildSearchText("Squid Game", [{ name: "오징어 게임" }, { name: "Игра в кальмара" }]),
  "squid game\n오징어 게임\nигра в кальмара"
);
eq(
  "təkrarlanan ad bir dəfə yazılır",
  buildSearchText("Dune", [{ name: "Dune" }, { name: "Дюна" }]),
  "dune\nдюна"
);

console.log(
  failed === 0 ? "\n✅ bütün imdbDatasets testləri keçdi\n" : `\n❌ ${failed} test sındı\n`
);
process.exit(failed === 0 ? 0 : 1);
