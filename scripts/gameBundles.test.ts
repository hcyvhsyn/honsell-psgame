/**
 * lib/gameBundleShared.ts testləri — `npm run test:bundles`.
 *
 * Paketdəki hər oyun checkout-da AYRICA `Transaction` sətri yaradır. Sətirlərin
 * cəmi müştəridən tutulan məbləğə qəpiyinə qədər bərabər olmalıdır — 1 qəpiklik
 * fərq belə sifariş cəmi ilə ödənişi uyğunsuzlaşdırır. Bölgü riyaziyyatı bura
 * kilidlənib.
 *
 * DB tələb etmir — funksiyalar safdır.
 */
import {
  allocateBundlePrices,
  clampDiscountPct,
  summarizeBundle,
  type BundleItemPrice,
} from "../lib/gameBundleShared";

let failed = 0;

function check(label: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  ok   ${label}`);
  } else {
    failed++;
    console.log(`  FAIL ${label}${detail ? `\n         ${detail}` : ""}`);
  }
}

/** Bölgünün cəmi hədəflə üst-üstə düşürmü + heç bir pay list-dən böyük deyil. */
function allocation(label: string, listCents: number[], pct: number) {
  const got = allocateBundlePrices(listCents, pct);
  const listTotal = listCents.reduce((s, c) => s + c, 0);
  const target = pct === 0 ? listTotal : Math.round((listTotal * (100 - pct)) / 100);
  const sum = got.reduce((s, c) => s + c, 0);

  check(
    `${label} — cəm = ${target}`,
    sum === target,
    `alındı: ${JSON.stringify(got)} (cəm ${sum}), gözlənilən cəm ${target}`,
  );
  check(
    `${label} — heç bir pay list qiymətindən böyük deyil`,
    got.every((c, i) => c <= listCents[i]),
    `alındı: ${JSON.stringify(got)}, list: ${JSON.stringify(listCents)}`,
  );
  check(
    `${label} — mənfi pay yoxdur`,
    got.every((c) => c >= 0),
    `alındı: ${JSON.stringify(got)}`,
  );
}

console.log("\n── PERCENT bölgüsü (largest-remainder) ─────────────────────");
// 3 oyunlu paket — sadə round() burada 1 qəpik itirirdi
allocation("3 oyun / 25%", [1899, 4599, 2333], 25);
allocation("4 oyun / 30%", [1999, 4999, 2499, 999], 30);
allocation("4 oyun / 33%", [1000, 1000, 1000, 1000], 33);
allocation("bərabər qiymətlər / 15%", [3333, 3333, 3333], 15);
allocation("qəribə rəqəmlər / 7%", [101, 103, 107, 109, 113], 7);
allocation("tək oyun / 40%", [5000], 40);
allocation("endirimsiz (0%)", [1234, 5678], 0);
allocation("maksimum endirim (95%)", [1999, 2999, 3999], 95);

console.log("\n── kənar hallar ────────────────────────────────────────────");
check("boş massiv → boş nəticə", allocateBundlePrices([], 25).length === 0);
check(
  "hamısı 0 qiymət → hamısı 0",
  allocateBundlePrices([0, 0, 0], 25).every((c) => c === 0),
);
check(
  "pulsuz oyun paketdə də pulsuz qalır",
  allocateBundlePrices([0, 1000], 50)[0] === 0,
  JSON.stringify(allocateBundlePrices([0, 1000], 50)),
);

console.log("\n── clampDiscountPct ────────────────────────────────────────");
check("mənfi → 0", clampDiscountPct(-10) === 0);
check("120 → 95", clampDiscountPct(120) === 95);
check("mətn → 0", clampDiscountPct("salam") === 0);
check("25.4 → 25", clampDiscountPct(25.4) === 25);

console.log("\n── summarizeBundle ─────────────────────────────────────────");
const items: BundleItemPrice[] = [
  { gameId: "a", title: "A", imageUrl: null, slug: null, listAznCents: 4000, bundleAznCents: 3000 },
  { gameId: "b", title: "B", imageUrl: null, slug: null, listAznCents: 6000, bundleAznCents: 4500 },
];
const s = summarizeBundle(items);
check("list cəmi 10000", s.listTotalAznCents === 10000, String(s.listTotalAznCents));
check("paket cəmi 7500", s.totalAznCents === 7500, String(s.totalAznCents));
check("qənaət 2500", s.savingsAznCents === 2500, String(s.savingsAznCents));
check("faiz 25", s.discountPct === 25, String(s.discountPct));

const noSavings = summarizeBundle([
  { gameId: "a", title: "A", imageUrl: null, slug: null, listAznCents: 1000, bundleAznCents: 1000 },
]);
check("qənaət yoxdursa faiz 0", noSavings.discountPct === 0);
check("boş paket 0 qaytarır", summarizeBundle([]).discountPct === 0);

console.log(
  failed === 0
    ? "\n✅ bütün paket testləri keçdi\n"
    : `\n❌ ${failed} test uğursuz oldu\n`,
);
process.exit(failed === 0 ? 0 : 1);
