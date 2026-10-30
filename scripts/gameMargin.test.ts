/**
 * lib/gameMargin.ts + lib/pricing.ts oyun qiyməti testləri.
 *
 * Pillələr mayaya görə seçilir və DÖŞƏMƏ qaydası ilə monotondur — sərhəddə
 * bahalı oyun ucuzdan ucuz satılmamalıdır. Monotonluq pozulsa `aznToTryCents`
 * (kataloq qiymət süzgəci) və TRY ilə sıralama da səhv işləyir.
 *
 * İşə salmaq: npm run test:gamemargin
 */
import {
  gameTierPct,
  normalizeGameMarginTiers,
  resolveGamePriceAzn,
  tieredGameAzn,
  type GameMarginTier,
} from "../lib/gameMargin";
import { aznToTryCents, computeDisplayPrice, type PricingSettings } from "../lib/pricing";

let failures = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name}\n      gözlənilən: ${e}\n      alınan:     ${a}`);
  }
}

const TIERS: GameMarginTier[] = [
  { upToAzn: 20, pct: 50 },
  { upToAzn: 100, pct: 20 },
  { upToAzn: null, pct: 10 },
];
const AUTO = { customMarginPct: null, customPriceAznCents: null };

console.log("tieredGameAzn — pillələr və döşəmə");
check("maya 10 → 50%", tieredGameAzn(10, TIERS, 30), 15);
check("maya 19.99 → 50%", tieredGameAzn(19.99, TIERS, 30), 29.99);
check("maya 20 (daxil) → 50%", tieredGameAzn(20, TIERS, 30), 30);
check("maya 20.01 → döşəmə 30", tieredGameAzn(20.01, TIERS, 30), 30);
check("maya 25 → 20%", tieredGameAzn(25, TIERS, 30), 30);
check("maya 60 → 20%", tieredGameAzn(60, TIERS, 30), 72);
check("maya 100 → 20%", tieredGameAzn(100, TIERS, 30), 120);
check("maya 105 → döşəmə 120", tieredGameAzn(105, TIERS, 30), 120);
check("maya 200 → 10%", tieredGameAzn(200, TIERS, 30), 220);
check("pillə yoxdur → tək faiz", tieredGameAzn(100, [], 30), 130);

console.log("monotonluq (0–500 ₼, 0.01 addım)");
let prev = 0;
let broken: number | null = null;
for (let c = 0; c <= 50000; c++) {
  const p = tieredGameAzn(c / 100, TIERS, 30);
  if (p < prev && broken == null) broken = c / 100;
  prev = p;
}
check("qiymət heç vaxt düşmür", broken, null);

console.log("gameTierPct");
check("19 → 50", gameTierPct(19, TIERS, 30), 50);
check("50 → 20", gameTierPct(50, TIERS, 30), 20);
check("500 → 10", gameTierPct(500, TIERS, 30), 10);
check("pillə yoxdur → fallback", gameTierPct(500, [], 30), 30);

console.log("resolveGamePriceAzn — prioritet");
check("avto", resolveGamePriceAzn(60, AUTO, TIERS, 30), 72);
check("custom faiz", resolveGamePriceAzn(60, { customMarginPct: 15, customPriceAznCents: null }, TIERS, 30), 69);
check("custom faiz 0", resolveGamePriceAzn(60, { customMarginPct: 0, customPriceAznCents: null }, TIERS, 30), 60);
check("sabit qiymət faizdən üstündür", resolveGamePriceAzn(60, { customMarginPct: 15, customPriceAznCents: 4990 }, TIERS, 30), 49.9);

console.log("normalizeGameMarginTiers");
check("null → []", normalizeGameMarginTiers(null), []);
check("sırasız + string", normalizeGameMarginTiers([
  { upToAzn: null, pct: 10 }, { upToAzn: "100", pct: "20" }, { upToAzn: 20, pct: 50 },
]), TIERS);
check("açıq pillə yoxdur → sonuncu açılır", normalizeGameMarginTiers([
  { upToAzn: 20, pct: 50 }, { upToAzn: 100, pct: 20 },
]), [{ upToAzn: 20, pct: 50 }, { upToAzn: null, pct: 20 }]);
check("səhv sətirlər atılır", normalizeGameMarginTiers([
  { upToAzn: -5, pct: 10 }, { upToAzn: 20, pct: 900 }, { upToAzn: 20, pct: 50 }, { upToAzn: null, pct: 10 },
]), [{ upToAzn: 20, pct: 50 }, { upToAzn: null, pct: 10 }]);

// computeDisplayPrice yalnız settings-in bu sahələrini oxuyur.
const settings = {
  tryToAznRate: 0.05,
  profitMarginPct: 30,
  profitMarginGamesPct: 30,
  gameMarginTiers: TIERS,
} as PricingSettings;
const legacy = { ...settings, gameMarginTiers: [] } as PricingSettings;

console.log("computeDisplayPrice");
// 1200 TRY × 0.05 = 60 ₼ maya
check("endirimsiz", computeDisplayPrice({ priceTryCents: 120000, discountTryCents: null, ...AUTO }, settings),
  { finalAzn: 72, originalAzn: null, discountPct: null });
check("pillə yoxdur → köhnə 30%", computeDisplayPrice({ priceTryCents: 120000, discountTryCents: null, ...AUTO }, legacy),
  { finalAzn: 78, originalAzn: null, discountPct: null });
// tam 2400 TRY = 120 ₼ maya → 132; endirim 1200 TRY = 60 → 72; faiz AZN-dən
check("endirim — faiz AZN-dən", computeDisplayPrice({ priceTryCents: 240000, discountTryCents: 120000, ...AUTO }, settings),
  { finalAzn: 72, originalAzn: 132, discountPct: 45 });
check("bitmiş endirim", computeDisplayPrice({ priceTryCents: 240000, discountTryCents: 120000, discountEndAt: new Date(Date.now() - 1000), ...AUTO }, settings),
  { finalAzn: 132, originalAzn: null, discountPct: null });
// maya 20.50 → 30; endirim maya 20.00 → 30: döşəmə endirimi udur
check("döşəmə endirimi udur", computeDisplayPrice({ priceTryCents: 41000, discountTryCents: 40000, ...AUTO }, settings),
  { finalAzn: 30, originalAzn: null, discountPct: null });
check("sabit qiymət endirimi saymır", computeDisplayPrice({ priceTryCents: 240000, discountTryCents: 120000, customMarginPct: null, customPriceAznCents: 9990 }, settings),
  { finalAzn: 99.9, originalAzn: null, discountPct: null });
check("custom faiz endirimlə", computeDisplayPrice({ priceTryCents: 240000, discountTryCents: 120000, customMarginPct: 10, customPriceAznCents: null }, settings),
  { finalAzn: 66, originalAzn: 132, discountPct: 50 });

console.log("aznToTryCents ↔ computeDisplayPrice");
const price = (tryCents: number) =>
  computeDisplayPrice({ priceTryCents: tryCents, discountTryCents: null, ...AUTO }, settings).finalAzn;
for (const azn of [15, 29.99, 30, 30.01, 50, 72, 120, 120.01, 300]) {
  const floor = aznToTryCents(azn, settings, "floor");
  const ceil = aznToTryCents(azn, settings, "ceil");
  check(`${azn} ₼ floor: price ≤ azn < price(+1)`, price(floor) <= azn && price(floor + 1) > azn, true);
  check(`${azn} ₼ ceil: price ≥ azn > price(−1)`, price(ceil) >= azn && price(ceil - 1) < azn, true);
}
const legacyPrice = (tryCents: number) =>
  computeDisplayPrice({ priceTryCents: tryCents, discountTryCents: null, ...AUTO }, legacy).finalAzn;
const legacyFloor = aznToTryCents(78, legacy, "floor");
check(
  "pillə yoxdur → 78.00-a yuvarlanan ən böyük TRY",
  legacyPrice(legacyFloor) <= 78 && legacyPrice(legacyFloor + 1) > 78,
  true,
);

if (failures > 0) {
  console.error(`\n${failures} test uğursuz oldu.`);
  process.exit(1);
}
console.log("\nHamısı keçdi.");
