/**
 * lib/gameSearchTerms.ts testləri — `npm run test:gamesearch`.
 *
 * Başlıqlar real kataloqdan götürülüb. Hər sətir əvvəl SINIQ olan bir sorğunu
 * təmsil edir: köhnə `title ILIKE '%q%'` yolunda bunların hamısı **0 nəticə**
 * qaytarırdı (navbar modalı "GTA 5" üçün boş açılırdı).
 *
 * DB tələb etmir — SQL tərəfinin JS referansı `titleMatchesTerms`-dədir.
 */
import {
  TITLE_TRANSLATE_FROM,
  TITLE_TRANSLATE_TO,
  buildGameSearchTerms,
  normalizeTitleForSearch,
  titleMatchesTerms,
} from "../lib/gameSearchTerms";

let failed = 0;

function match(q: string, title: string, want: boolean) {
  const got = titleMatchesTerms(buildGameSearchTerms(q), title);
  if (got === want) {
    console.log(`  ok   ${want ? "tapır " : "atır  "} "${q}" → ${title}`);
  } else {
    failed++;
    console.log(`  FAIL "${q}" → ${title}: alındı ${got}, gözlənilən ${want}`);
  }
}

console.log("\n── translate cütü ──────────────────────────────────────────");
if ([...TITLE_TRANSLATE_FROM].length === [...TITLE_TRANSLATE_TO].length) {
  console.log("  ok   FROM/TO uzunluqları bərabərdir");
} else {
  failed++;
  console.log(
    `  FAIL translate cütü uyğunsuzdur: ${[...TITLE_TRANSLATE_FROM].length} ≠ ${[...TITLE_TRANSLATE_TO].length}`
  );
}

console.log("\n── başlıq normallaşdırması ─────────────────────────────────");
{
  const cases: [string, string][] = [
    ["Marvel’s Spider-Man 2", " marvel s spider man 2 "],
    ["God of War Ragnarök", " god of war ragnarok "],
    ["EA SPORTS FC™ 26", " ea sports fc 26 "],
  ];
  for (const [title, want] of cases) {
    const got = normalizeTitleForSearch(title).n;
    if (got === want) {
      console.log(`  ok   ${title} → ${JSON.stringify(got)}`);
    } else {
      failed++;
      console.log(`  FAIL ${title}\n         alındı:     ${JSON.stringify(got)}\n         gözlənilən: ${JSON.stringify(want)}`);
    }
  }
}

console.log("\n── abbreviatura + rum rəqəmi ───────────────────────────────");
match("gta 5", "Grand Theft Auto V", true);
match("gta5", "Grand Theft Auto V", true);
match("gta v", "Grand Theft Auto V", true);
match("gta", "Grand Theft Auto V", true);
match("gta 5", "Grand Theft Auto: The Trilogy", false);
match("cod", "Call of Duty®: Modern Warfare® III", true);
match("gow ragnarok", "God of War Ragnarök", true);
match("rdr 2", "Red Dead Redemption 2", true);
match("nfs unbound", "Need for Speed™ Unbound", true);
match("tlou 2", "The Last of Us Part II", true);

console.log("\n── seriya adı dəyişikliyi ──────────────────────────────────");
// FIFA → EA SPORTS FC: köhnə adı yazan müştəri kataloqda heç nə tapmırdı.
match("fifa", "EA SPORTS FC™ 26", true);
match("fifa 26", "EA SPORTS FC™ 26", true);
match("fifa 26", "EA SPORTS FC™ 25", false);
match("ea fc 26", "EA SPORTS FC™ 26", true);

console.log("\n── defis / apostrof / diakritik ────────────────────────────");
match("spiderman", "Marvel's Spider-Man 2", true);
match("spider man 2", "Marvel’s Spider-Man 2", true);
match("marvels spiderman", "Marvel's Spider-Man Remastered", true);
match("god of war ragnarok", "God of War Ragnarök", true);
match("ragnarok", "God of War Ragnarök: Valhalla", true);
match("assassins creed", "Assassin's Creed Mirage", true);
match("ac mirage", "Assassin's Creed Mirage", true);

console.log("\n── söz sırası və artıq sözlər ──────────────────────────────");
// 4+ sözlü sorğuda bir söz buraxıla bilər — istifadəçi tez-tez başlıqda
// olmayan bir söz əlavə edir.
match("god of war ragnarok deluxe", "God of War Ragnarök", true);
match("spiderman 2 ps5", "Marvel's Spider-Man 2", true);
match("resident evil 4 remake", "Resident Evil 4", true);
// 3 və daha az sözdə bütün sözlər tələb olunur — əks halda "of"/"war" kimi
// sözlər bütün kataloqu qaytarardı.
match("god of tsushima", "Ghost of Tsushima DIRECTOR'S CUT", false);

console.log("\n── yanlış pozitivlərə qarşı ────────────────────────────────");
// Qısa token boşluqsuz formada axtarılmır: "v" hərfi olan hər başlıq
// uyğun gəlməməlidir.
match("v", "Marvel's Spider-Man 2", false);
match("witcher", "Marvel's Spider-Man 2", false);
match("hogwarts", "Hogwarts Legacy", true);
match("hogwarts legacy ps5", "Hogwarts Legacy", true);

console.log("\n── stopword-lar ────────────────────────────────────────────");
{
  const t = buildGameSearchTerms("ucuz ps5 oyunu hogwarts");
  const ok = t.groups.length === 1 && t.groups[0][0] === "hogwarts";
  if (ok) console.log("  ok   stopword-lar atılır");
  else {
    failed++;
    console.log(`  FAIL stopword-lar atılmadı: ${JSON.stringify(t.groups)}`);
  }
}
{
  // Sorğu YALNIZ stopword-lardan ibarətdirsə boş qalmamalıdır.
  const t = buildGameSearchTerms("ps5");
  if (t.groups.length > 0) console.log("  ok   yalnız stopword olan sorğu saxlanılır");
  else {
    failed++;
    console.log(`  FAIL yalnız stopword: ${JSON.stringify(t.groups)}`);
  }
}

if (failed > 0) {
  console.log(`\n❌ ${failed} test sındı\n`);
  process.exit(1);
}
console.log("\n✅ bütün testlər keçdi\n");
