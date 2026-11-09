/**
 * Minimum sifariş qaydası testləri (lib/cartLimits.ts).
 * Qayda: 20 ₼ minimum YALNIZ PlayStation məhsullarına tətbiq olunur; abunəliklər
 * (Netflix/HBO → STREAMING, Spotify/YouTube → PLATFORM) tək alına bilir və sayılmır.
 *
 * İşə salmaq: npm run test:cartlimits
 */
import assert from "node:assert/strict";
import {
  MIN_ORDER_AZN_CENTS,
  countsTowardMinOrder,
  meetsMinOrder,
  minOrderBaseCents,
  minOrderProgress,
} from "@/lib/cartLimits";

const item = (productType: string, finalAzn: number, qty = 1) => ({ productType, finalAzn, qty });

// Tiplər
for (const t of ["GAME", "PS_PLUS", "EA_PLAY", "TRY_BALANCE", "ACCOUNT_CREATION", "HONSELL_GIFT_CARD", "YENI_TIP"]) {
  assert.equal(countsTowardMinOrder(t), true, `${t} minimuma sayılmalıdır`);
}
for (const t of ["STREAMING", "PLATFORM", "streaming"]) {
  assert.equal(countsTowardMinOrder(t), false, `${t} minimumdan azad olmalıdır`);
}

// Tək Netflix (8 ₼) — minimum tətbiq olunmur, sifariş açıqdır.
{
  const base = minOrderBaseCents([item("STREAMING", 8)]);
  assert.equal(base, 0);
  const p = minOrderProgress(base / 100);
  assert.equal(p.applies, false);
  assert.equal(p.reached, true);
  assert.equal(p.missingCents, 0);
  assert.equal(meetsMinOrder(base), true);
}

// Tək Spotify — eyni.
assert.equal(meetsMinOrder(minOrderBaseCents([item("PLATFORM", 6.5)])), true);

// 8 ₼ Netflix + 12 ₼ oyun = cəmi 20 ₼, amma PS hissəsi 12 ₼ → bloklanır.
{
  const base = minOrderBaseCents([item("STREAMING", 8), item("GAME", 12)]);
  assert.equal(base, 1200);
  const p = minOrderProgress(base / 100);
  assert.equal(p.applies, true);
  assert.equal(p.reached, false);
  assert.equal(p.missingCents, 800);
  assert.equal(meetsMinOrder(base), false);
}

// PS hissəsi 20 ₼-ə çatanda abunəlik əlavəsi problem deyil.
{
  const base = minOrderBaseCents([item("STREAMING", 8), item("GAME", 12.5), item("PS_PLUS", 7.5)]);
  assert.equal(base, MIN_ORDER_AZN_CENTS);
  assert.equal(meetsMinOrder(base), true);
  assert.equal(minOrderProgress(base / 100).reached, true);
}

// Say (qty) nəzərə alınır: 2 × 10.99 = 21.98 ₼.
assert.equal(minOrderBaseCents([item("TRY_BALANCE", 10.99, 2)]), 2198);

// Dəst: yalnız PS üzvləri sayılır (server dəsti üzvlərinə açır).
{
  const bundle = {
    productType: "SERVICE_BUNDLE",
    finalAzn: 25,
    qty: 1,
    serviceBundleItems: [
      { serviceType: "STREAMING", bundleAznCents: 900 },
      { serviceType: "PS_PLUS", bundleAznCents: 1600 },
    ],
  };
  assert.equal(minOrderBaseCents([bundle]), 1600);
  const subsOnly = { ...bundle, serviceBundleItems: [{ serviceType: "STREAMING", bundleAznCents: 900 }, { serviceType: "PLATFORM", bundleAznCents: 700 }] };
  assert.equal(minOrderBaseCents([subsOnly]), 0);
}

// Boş PS hissəsi serverdə də keçir; 19.99 keçmir.
assert.equal(meetsMinOrder(0), true);
assert.equal(meetsMinOrder(1999), false);
assert.equal(meetsMinOrder(2000), true);

console.log("cartLimits: bütün testlər keçdi");
