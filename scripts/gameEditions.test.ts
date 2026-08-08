/**
 * lib/gameEditions.ts testləri — `npm run test:editions`.
 *
 * Bu qruplaşdırma SƏHV işləsə müştəri reels-də YANLIŞ oyunun qiymətini görür və
 * səbətə yanlış məhsul atır, ona görə real PS Store başlıqları ilə kilidlənib.
 * Yeni sürüm adı formatı görsən (məs. yeni TR etiketi), bura bir sətir əlavə et.
 *
 * DB tələb etmir — funksiyalar safdır.
 */
import {
  baseGameTitle,
  dedupeEditions,
  editionSuffixLabel,
  isSameGameFamily,
} from "../lib/gameEditions";

let failed = 0;

function eq(input: string, want: string) {
  const got = baseGameTitle(input);
  if (got === want) {
    console.log(`  ok   ${input}`);
  } else {
    failed++;
    console.log(`  FAIL ${input}\n         alındı:      ${JSON.stringify(got)}\n         gözlənilən:  ${JSON.stringify(want)}`);
  }
}

function family(a: string, b: string, want: boolean) {
  const got = isSameGameFamily(a, b);
  if (got === want) {
    console.log(`  ok   ${want ? "eyni" : "fərqli"}: "${a}" ↔ "${b}"`);
  } else {
    failed++;
    console.log(`  FAIL "${a}" ↔ "${b}" → ${got}, gözlənilən ${want}`);
  }
}

console.log("\n── baza başlıq çıxarılması ─────────────────────────────────");
// Sürüm sonəki kəsilməlidir
eq("EA SPORTS FC™ 26 Ultimate Sürüm PS4 ve PS5", "EA SPORTS FC 26");
eq("Sekiro™: Shadows Die Twice - Game of the Year Sürümü", "Sekiro: Shadows Die Twice");
eq("God of War™ Dijital Deluxe Sürüm", "God of War");
eq("WWE 2K25 Standard Edition", "WWE 2K25");
eq("The Witcher 3: Wild Hunt – Complete Edition", "The Witcher 3: Wild Hunt");
eq("Gran Turismo™ 7 25. Yıl Dönümü Dijital Deluxe Sürümü", "Gran Turismo 7");
eq("Ghost of Tsushima YÖNETMENİN SÜRÜMÜ", "Ghost of Tsushima");
eq("Marvel's Spider-Man: Miles Morales Ultimate Edition", "Marvel's Spider-Man: Miles Morales");
eq("Injustice™ 2 - Efsanevi Sürüm", "Injustice 2");
eq("Assassin's Creed® Mirage Lüks Sürüm", "Assassin's Creed Mirage");
eq("Stellar Blade™ Eksiksiz Sürüm", "Stellar Blade");
eq("HITMAN World of Assassination Deluxe Edition", "HITMAN World of Assassination");
eq("Resident Evil 4 Gold Edition PS4 & PS5", "Resident Evil 4");
eq("Mafia II: Definitive Edition", "Mafia II");
eq("Titanfall™ 2 Standart Sürüm", "Titanfall 2");
eq("Divinity: Original Sin 2 - Definitive Edition PS4 & PS5", "Divinity: Original Sin 2");
// Sonək yoxdursa başlıq TOXUNULMAZ qalmalıdır
eq("God of War Ragnarök", "God of War Ragnarök");
eq("Elden Ring", "Elden Ring");
// Başlıq sırf sürüm sözlərindən ibarətdirsə kəsilməməlidir (boş baza = bütün kataloq)
eq("RACCOON CITY EDITION", "RACCOON CITY");

console.log("\n── fərqli oyunlar BİRLƏŞMƏMƏLİDİR ──────────────────────────");
family("God of War Dijital Deluxe Sürüm", "God of War Ragnarök", false);
family("Mafia II: Definitive Edition", "Mafia: Definitive Edition", false);
family("EA SPORTS FC 26 Ultimate Sürüm", "EA SPORTS FC 25 Standart Sürüm", false);
family("Injustice 2 - Standart Sürüm", "Injustice Gods Among Us", false);
family("Little Nightmares Enhanced Edition", "Little Nightmares I & II Bundle", false);

console.log("\n── eyni oyunun sürümləri BİRLƏŞMƏLİDİR ─────────────────────");
family("Injustice™ 2 - Efsanevi Sürüm", "Injustice™ 2 - Standart Sürüm", true);
family("God of War Ragnarök", "God of War Ragnarök Dijital Deluxe Sürüm", true);
family("Resident Evil 4 Gold Edition PS4 & PS5", "Resident Evil 4", true);
family("The Witcher 3: Wild Hunt – Complete Edition", "The Witcher 3: Wild Hunt", true);

console.log("\n── çipdə görünən sürüm adı ─────────────────────────────────");
function suffix(title: string, want: string) {
  const got = editionSuffixLabel(title);
  if (got === want) {
    console.log(`  ok   ${title} → "${got}"`);
  } else {
    failed++;
    console.log(`  FAIL ${title}\n         alındı: ${JSON.stringify(got)}, gözlənilən: ${JSON.stringify(want)}`);
  }
}
suffix("God of War Ragnarök", "Standart");
suffix("God of War Ragnarök Dijital Deluxe Sürüm", "Dijital Deluxe Sürüm");
suffix("Injustice™ 2 - Standart Sürüm", "Standart Sürüm");
suffix("EA SPORTS FC™ 26 Ultimate Sürüm PS4 ve PS5", "Ultimate Sürüm");
suffix("The Witcher 3: Wild Hunt – Complete Edition", "Complete Edition");
suffix("Resident Evil 4 Gold Edition PS4 & PS5", "Gold Edition");

console.log("\n── sürüm çiplərinin dublikat təmizliyi ─────────────────────");
function dedupe(
  label: string,
  input: { editionName: string | null; platform: string | null; finalAzn: number }[],
  wantNames: string[],
) {
  const got = dedupeEditions(input).map(
    (e) => `${e.editionName ?? "-"}/${e.platform ?? "-"}/${e.finalAzn}`,
  );
  if (JSON.stringify(got) === JSON.stringify(wantNames)) {
    console.log(`  ok   ${label}`);
  } else {
    failed++;
    console.log(
      `  FAIL ${label}\n         alındı: ${JSON.stringify(got)}\n         gözlənilən: ${JSON.stringify(wantNames)}`,
    );
  }
}

// Skrinşotdakı əsl hal: eyni ad + eyni qiymət, biri platformasız.
dedupe(
  "platformasız dublikat atılır",
  [
    { editionName: "Standart", platform: "PS5", finalAzn: 66.26 },
    { editionName: "Standart", platform: null, finalAzn: 66.26 },
  ],
  ["Standart/PS5/66.26"],
);

// ⚠️ Real platforma fərqi qorunmalıdır — qiymət eyni olsa belə.
dedupe(
  "PS4 və PS5 ayrı qalır",
  [
    { editionName: "Standart", platform: "PS4", finalAzn: 66.26 },
    { editionName: "Standart", platform: "PS5", finalAzn: 66.26 },
  ],
  ["Standart/PS4/66.26", "Standart/PS5/66.26"],
);

dedupe(
  "tam eyni üçlük bir dəfə qalır",
  [
    { editionName: "Deluxe", platform: "PS5", finalAzn: 91.4 },
    { editionName: "Deluxe", platform: "PS5", finalAzn: 91.4 },
  ],
  ["Deluxe/PS5/91.4"],
);

// Qiymət fərqlidirsə eyni ad birləşdirilməməlidir (endirim yalnız birində ola bilər).
dedupe(
  "fərqli qiymət birləşmir",
  [
    { editionName: "Standart", platform: null, finalAzn: 66.26 },
    { editionName: "Standart", platform: "PS5", finalAzn: 82.82 },
  ],
  ["Standart/-/66.26", "Standart/PS5/82.82"],
);

dedupe(
  "hər ikisi platformasızdırsa biri qalır",
  [
    { editionName: "Standart", platform: null, finalAzn: 66.26 },
    { editionName: "Standart", platform: null, finalAzn: 66.26 },
  ],
  ["Standart/-/66.26"],
);

dedupe("boş siyahı", [], []);

if (failed > 0) {
  console.log(`\n❌ ${failed} test sındı\n`);
  process.exit(1);
}
console.log("\n✅ bütün testlər keçdi\n");
