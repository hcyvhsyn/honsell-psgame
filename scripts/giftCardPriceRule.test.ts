/**
 * Hədiyyə kartı qiymət qaydasının SAF testləri (DB-yə toxunmur).
 *
 *   npm run test:giftcards
 *
 * Niyə kilidlənib: yuvarlaqlaşdırma float xətasına həssasdır və səhv nəticə
 * birbaşa müştəriyə göstərilən qiymətdir. `Math.floor(azn * 10) / 10` dəqiq
 * 23.80 dəyərini 23.70-ə salır — bu test məhz onu tutur.
 */

import {
  baseRateFromAnchor,
  computeGiftCardPriceRow,
  computeGiftCardPriceTable,
  floorToPriceStepCents,
  validateDiscountPct,
  validateGiftCardPriceRule,
  type GiftCardNominal,
} from "../lib/giftCardPriceRuleShared";

let failures = 0;

function eq(actual: unknown, expected: unknown, label: string) {
  const ok = actual === expected;
  if (!ok) {
    failures += 1;
    console.error(`  ✗ ${label}\n      gözlənilən: ${expected}\n      alınan:     ${actual}`);
  } else {
    console.log(`  ✓ ${label}`);
  }
}

function nominal(over: Partial<GiftCardNominal> & { tryAmount: number | null }): GiftCardNominal {
  return {
    id: `p${over.tryAmount ?? "x"}`,
    discountPct: 0,
    currentPriceAznCents: 0,
    isActive: true,
    ...over,
  };
}

console.log("\n1) floorToPriceStepCents — float tələsi");
// Bunlar naiv floor(azn*10)/10 ilə SINIR:
eq(floorToPriceStepCents(23.8), 2380, "23.80 → 2380 (naiv variant 2370 verir)");
eq(floorToPriceStepCents(35.3), 3530, "35.30 → 3530");
eq(floorToPriceStepCents(46.9), 4690, "46.90 → 4690");
eq(floorToPriceStepCents(0.3), 30, "0.30 → 30");
// Normal aşağı yuvarlaqlaşma:
eq(floorToPriceStepCents(23.76), 2370, "23.76 → 2370 (aşağı)");
eq(floorToPriceStepCents(23.79), 2370, "23.79 → 2370 (aşağı)");
eq(floorToPriceStepCents(12), 1200, "12.00 → 1200");
// Kənar hallar:
eq(floorToPriceStepCents(0.09), 0, "0.09 → 0 (pillədən aşağı)");
eq(floorToPriceStepCents(0), 0, "0 → 0");
eq(floorToPriceStepCents(-5), 0, "mənfi → 0");
eq(floorToPriceStepCents(Number.NaN), 0, "NaN → 0");

console.log("\n2) baseRateFromAnchor");
eq(baseRateFromAnchor(250, 12), 0.048, "250₺ = 12 AZN → 0.048");
eq(baseRateFromAnchor(0, 12), 0, "nominal 0 → 0");
eq(baseRateFromAnchor(250, 0), 0, "qiymət 0 → 0");

console.log("\n3) İstifadəçinin nümunəsi: 250=12 olanda 500 → 24 deyil");
const rule = { baseAznPerTry: 0.048, costAznPerTry: 0.045, epointFeePct: 3 };
const table = computeGiftCardPriceTable(
  [
    nominal({ tryAmount: 1000, discountPct: 3 }),
    nominal({ tryAmount: 250, discountPct: 0 }),
    nominal({ tryAmount: 750, discountPct: 2 }),
    nominal({ tryAmount: 500, discountPct: 1 }),
  ],
  rule,
);
eq(table.rows.map((r) => r.tryAmount).join(","), "250,500,750,1000", "cədvəl azdan çoxa sıralanır");
eq(table.rows[0].priceAznCents, 1200, "250₺ → 12.00 AZN");
eq(table.rows[1].priceAznCents, 2370, "500₺ → 23.70 AZN (24.00 deyil)");
eq(table.rows[2].priceAznCents, 3520, "750₺ → 35.20 AZN");
eq(table.rows[3].priceAznCents, 4650, "1000₺ → 46.50 AZN");
eq(table.totals.writable, 4, "4 sətir yazıla bilir");
eq(table.totals.skipped, 0, "ötürülən yoxdur");

console.log("\n4) Vahid qiymət nominal böyüdükcə AZALIR (məhsul tələbi)");
const rates = table.rows.map((r) => r.priceAznCents / r.tryAmount);
let monotonic = true;
for (let i = 1; i < rates.length; i++) if (rates[i] > rates[i - 1]) monotonic = false;
eq(monotonic, true, `AZN/₺ enən sıradadır (${rates.map((r) => r.toFixed(5)).join(" > ")})`);

console.log("\n5) Maya, epoint və mənfəət");
const row500 = table.rows[1];
eq(row500.costAznCents, 2250, "500₺ maya = 500 × 0.045 = 22.50");
eq(row500.epointFeeCents, 71, "epoint 3% = round(2370 × 0.03) = 71 qəpik");
eq(row500.netAfterFeeCents, 2299, "net = 2370 − 71");
eq(row500.profitAznCents, 120, "mənfəət = 2370 − 2250");
eq(row500.profitAfterFeeCents, 49, "epoint sonrası mənfəət = 2299 − 2250");

console.log("\n6) Xəbərdarlıqlar");
const noTry = computeGiftCardPriceRow(nominal({ tryAmount: null }), rule);
eq(noTry.warnings.join(","), "NO_TRY_AMOUNT", "tryAmount yoxdursa NO_TRY_AMOUNT");
eq(noTry.writable, false, "tryAmount yoxdursa yazılmır");

// Settings-dəki 0.053 kursu ilə 250₺=12 AZN satmaq ZƏRƏRDİR — canlı vəziyyət.
const belowCost = computeGiftCardPriceRow(nominal({ tryAmount: 250 }), {
  baseAznPerTry: 0.048,
  costAznPerTry: 0.053,
  epointFeePct: 3,
});
eq(belowCost.warnings.includes("BELOW_COST"), true, "0.053 maya ilə 250₺ → BELOW_COST");
eq(belowCost.profitAznCents, -125, "zərər = 1200 − 1325 = −125 qəpik");

// Yalnız epoint komissiyasından sonra mənfiyə düşən hal.
const negAfterFee = computeGiftCardPriceRow(nominal({ tryAmount: 250 }), {
  baseAznPerTry: 0.048,
  costAznPerTry: 0.0477,
  epointFeePct: 3,
});
eq(
  negAfterFee.warnings.join(","),
  "NEGATIVE_AFTER_FEE",
  "maya altında deyil, amma epointdən sonra mənfi",
);

const tiny = computeGiftCardPriceRow(nominal({ tryAmount: 1 }), rule);
eq(tiny.warnings.includes("ZERO_PRICE"), true, "1₺ × 0.048 → yuvarlaqlaşıb 0, ZERO_PRICE");
eq(tiny.writable, false, "ZERO_PRICE yazılmır");

console.log("\n7) Delta (cari qiymətlə fərq)");
const withCurrent = computeGiftCardPriceRow(
  nominal({ tryAmount: 500, discountPct: 1, currentPriceAznCents: 2320 }),
  rule,
);
eq(withCurrent.deltaCents, 50, "2370 − 2320 = +50 qəpik");

console.log("\n8) Doğrulama mesajları");
eq(validateGiftCardPriceRule(rule), null, "düzgün qayda keçir");
eq(typeof validateGiftCardPriceRule({ ...rule, baseAznPerTry: 0 }), "string", "baza 0 rədd olunur");
eq(typeof validateGiftCardPriceRule({ ...rule, baseAznPerTry: 2 }), "string", "baza 2 rədd olunur");
eq(typeof validateGiftCardPriceRule({ ...rule, epointFeePct: 100 }), "string", "epoint 100 rədd");
eq(validateDiscountPct(0), null, "0% keçir");
eq(validateDiscountPct(90), null, "90% keçir");
eq(typeof validateDiscountPct(91), "string", "91% rədd olunur");
eq(typeof validateDiscountPct(-1), "string", "mənfi faiz rədd olunur");

console.log(
  failures === 0
    ? "\n✅ Bütün testlər keçdi\n"
    : `\n❌ ${failures} test uğursuz oldu\n`,
);
process.exit(failures === 0 ? 0 : 1);
