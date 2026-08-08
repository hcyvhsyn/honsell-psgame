/**
 * lib/reelRanking.ts testləri — `npm run test:reelranking`.
 *
 * Bu sıralama sınsa istifadəçi ya həmişə eyni videoları görür (qarışdırma
 * işləmir), ya da səhifələmə element atlayır (determinizm pozulur). DB tələb
 * etmir — funksiyalar safdır.
 */
import { rankReels, recencyBucket, reelScore, seededHash } from "../lib/reelRanking";

let failed = 0;

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  ok   ${name}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}${detail ? `\n         ${detail}` : ""}`);
  }
}

const NOW = new Date("2026-08-08T12:00:00Z").getTime();
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000);

const reels = [
  { id: "a1", createdAt: daysAgo(0) }, // bu həftə
  { id: "b2", createdAt: daysAgo(2) }, // bu həftə
  { id: "c3", createdAt: daysAgo(5) }, // bu həftə
  { id: "d4", createdAt: daysAgo(10) }, // keçən həftə
  { id: "e5", createdAt: daysAgo(12) }, // keçən həftə
  { id: "f6", createdAt: daysAgo(40) }, // köhnə
];

console.log("\n── determinizm (səhifələmənin sabitliyi) ───────────────────");
const r1 = rankReels(reels, "seed-one", NOW).map((r) => r.id);
const r2 = rankReels(reels, "seed-one", NOW).map((r) => r.id);
check("eyni seed → eyni sıra", JSON.stringify(r1) === JSON.stringify(r2), `${r1} vs ${r2}`);
check("seededHash determinist", seededHash("a1", "s") === seededHash("a1", "s"));
check("fərqli id → fərqli hash", seededHash("a1", "s") !== seededHash("a2", "s"));
check("fərqli seed → fərqli hash", seededHash("a1", "s1") !== seededHash("a1", "s2"));

console.log("\n── qarışdırma (hər ziyarətdə fərqli sıra) ──────────────────");
const seeds = ["s1", "s2", "s3", "s4", "s5", "s6"];
const orders = new Set(seeds.map((s) => rankReels(reels, s, NOW).map((r) => r.id).join(",")));
check(
  "fərqli seed-lər fərqli sıralar verir",
  orders.size > 1,
  `${orders.size} fərqli sıra alındı (${seeds.length} seed)`,
);

console.log("\n── yenilər öndə (səbət intizamı) ───────────────────────────");
check("bu həftə → səbət 0", recencyBucket(daysAgo(3), NOW) === 0);
check("keçən həftə → səbət 1", recencyBucket(daysAgo(10), NOW) === 1);
check("40 gün → səbət 5", recencyBucket(daysAgo(40), NOW) === 5);

// Hər seed-də bu həftənin üç videosu köhnələrdən ƏVVƏL gəlməlidir.
let orderingHolds = true;
for (const s of seeds) {
  const ids = rankReels(reels, s, NOW).map((r) => r.id);
  const lastFresh = Math.max(ids.indexOf("a1"), ids.indexOf("b2"), ids.indexOf("c3"));
  const firstOld = Math.min(ids.indexOf("d4"), ids.indexOf("e5"), ids.indexOf("f6"));
  if (lastFresh > firstOld) {
    orderingHolds = false;
    console.log(`         seed=${s} pozdu: ${ids.join(",")}`);
  }
}
check("bu həftəkilər həmişə köhnələrdən əvvəl", orderingHolds);

check(
  "köhnə video ən sonda (f6, səbət 5)",
  seeds.every((s) => rankReels(reels, s, NOW).at(-1)?.id === "f6"),
);

console.log("\n── kənar hallar ───────────────────────────────────────────");
check("boş massiv sınmır", rankReels([], "s", NOW).length === 0);
check("giriş massivi dəyişdirilmir", (() => {
  const input = [...reels];
  const before = input.map((r) => r.id).join(",");
  rankReels(input, "s", NOW);
  return input.map((r) => r.id).join(",") === before;
})());
check("ISO string tarix işləyir", recencyBucket(daysAgo(3).toISOString(), NOW) === 0);
check("yararsız tarix sona düşür", reelScore({ id: "x", createdAt: "zibil" }, "s", NOW) > reelScore({ id: "y", createdAt: daysAgo(400) }, "s", NOW));

if (failed > 0) {
  console.log(`\n❌ ${failed} test sındı\n`);
  process.exit(1);
}
console.log("\n✅ bütün testlər keçdi\n");
