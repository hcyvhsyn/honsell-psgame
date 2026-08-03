/**
 * Qutu açılışı (loot box) riyaziyyatının saf (DB-siz) unit testləri.
 * İşə salmaq: `npm run test:lootbox`  (npx tsx scripts/lootBox.test.ts)
 *
 * Bu testlərin əsas məqsədi MARJA ZƏMANƏTİni qorumaqdır: büdcəni aşan bir
 * hovuzun heç bir yolla "ok" qaytarmadığını təsdiqləyir. DB tələb edən axınlar
 * (çəkiliş, ödəniş, geri satma) scripts/lootBoxDrain.ts-də yoxlanılır.
 */
import assert from "node:assert/strict";
import {
  computePoolEconomics,
  poolCostBudgetCents,
  minPrizeCentsFor,
  maxPrizeCentsFor,
  validateLootBoxConfig,
  buildOddsTable,
  toPublicOdds,
  sellBackAmountCents,
  prizeTierFor,
  isLootBoxOrderCode,
  allocateTickets,
  affordabilityFor,
  LOOT_BOX_OUTCOMES,
  LOOT_BOX_POOL_STATUSES,
} from "../lib/lootBoxShared";
import type { LootBoxConfig, LootBoxTicketSpec, CandidateGame } from "../lib/lootBoxShared";

let passed = 0;
const failures: string[] = [];
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
  } catch (err) {
    failures.push(`✗ ${name}\n   ${(err as Error).message}`);
  }
}

// 5 AZN qutu, 100 bilet, hədəf marja 23%.
const CFG: LootBoxConfig = {
  priceAznCents: 500,
  poolSize: 100,
  targetMarginPct: 23,
  minPrizePct: 60,
  maxPrizePct: 200,
};

/** Oyunun mayası göstərilən qiymətin ~81.3%-idir (23% markup modeli). */
const costOf = (valueCents: number) => Math.round(valueCents / 1.23);

function spec(title: string, valueCents: number, ticketCount: number): LootBoxTicketSpec {
  return { gameId: `g-${title}`, title, ticketCount, valueAznCents: valueCents, costAznCents: costOf(valueCents) };
}

/** Plandaki istinad hovuzu: 100 bilet, dəyər 473 AZN, marja ~23.1%. */
const REFERENCE_POOL: LootBoxTicketSpec[] = [
  spec("A", 300, 25),
  spec("B", 400, 28),
  spec("C", 500, 22),
  spec("D", 600, 15),
  spec("E", 800, 7),
  spec("F", 1000, 3),
];

// ── Büdcə hesablanması ────────────────────────────────────────────────────────
test("poolCostBudgetCents: 100 × 5 AZN, 23% marja → 385 AZN", () => {
  assert.equal(poolCostBudgetCents(CFG), 38_500);
});
test("poolCostBudgetCents: aşağıya yuvarlaqlaşdırır (marja bizim xeyrimizə)", () => {
  // 7 × 333 qəpik × 0.735 = 1713.1... → 1713 (yuxarı yuvarlaqlaşsa marja pozulardı)
  const budget = poolCostBudgetCents({ priceAznCents: 333, poolSize: 7, targetMarginPct: 26.5 });
  assert.equal(budget, 1713);
  assert.ok(budget <= (7 * 333 * 73.5) / 100);
});
test("minPrizeCentsFor / maxPrizeCentsFor: 60% → 3 AZN, 200% → 10 AZN", () => {
  assert.equal(minPrizeCentsFor(CFG), 300);
  assert.equal(maxPrizeCentsFor(CFG), 1000);
});

// ── İstinad hovuzu keçir ──────────────────────────────────────────────────────
test("istinad hovuzu: 100 bilet, büdcədən keçir, marja ≥ hədəf", () => {
  const e = computePoolEconomics(REFERENCE_POOL, CFG);
  assert.deepEqual(e.violations, []);
  assert.equal(e.ok, true);
  assert.equal(e.ticketTotal, 100);
  assert.equal(e.totalValueCents, 47_300);
  assert.equal(e.revenueCents, 50_000);
  assert.ok(e.totalCostCents <= e.budgetCostCents, `maya ${e.totalCostCents} > büdcə ${e.budgetCostCents}`);
  assert.ok(e.marginPct >= CFG.targetMarginPct, `marja ${e.marginPct} < ${CFG.targetMarginPct}`);
  assert.equal(e.evValueCents, 473);
  assert.equal(e.lowestPrizeCents, 300);
  assert.equal(e.highestPrizeCents, 1000);
  assert.ok(e.headroomCents >= 0);
});

// ── ƏSAS ZƏMANƏT: büdcəni aşan hovuz rədd edilir ──────────────────────────────
test("büdcəni 1 qəpik aşan hovuz RƏDD edilir", () => {
  // Bütün biletləri elə seçirik ki, maya büdcədən dəqiq 1 qəpik çox olsun.
  const budget = poolCostBudgetCents(CFG); // 38_500
  const tickets: LootBoxTicketSpec[] = [
    { gameId: "x", title: "X", ticketCount: 100, valueAznCents: 500, costAznCents: Math.floor(budget / 100) },
  ];
  const okCase = computePoolEconomics(tickets, CFG);
  assert.equal(okCase.ok, true, "dəqiq büdcə həddi keçməli idi");

  const overCase = computePoolEconomics(
    [{ ...tickets[0], costAznCents: tickets[0].costAznCents + 1 }],
    CFG
  );
  assert.equal(overCase.ok, false);
  assert.ok(overCase.violations.some((v) => v.includes("Maya büdcəsi aşılır")));
  assert.ok(overCase.headroomCents < 0);
});

test("hər bilet maksimum hədiyyə olsa büdcə aşılır → rədd", () => {
  const e = computePoolEconomics([spec("Cekpot", 1000, 100)], CFG);
  assert.equal(e.ok, false);
  assert.ok(e.violations.some((v) => v.includes("Maya büdcəsi aşılır")));
});

test("marja hesablanması gəlirə görədir (mənfəət / gəlir)", () => {
  const e = computePoolEconomics([spec("Y", 500, 100)], CFG);
  // maya 407 × 100 = 40_700; gəlir 50_000 → marja = 9300/50000 = 18.6%
  assert.equal(e.totalCostCents, 40_700);
  assert.ok(Math.abs(e.marginPct - 18.6) < 0.01, `marja ${e.marginPct}`);
  // 18.6% < 23% olduğu üçün rədd edilməlidir — 23% markup 23% marja DEYİL.
  assert.equal(e.ok, false);
});

// ── Maya bilinmirsə hovuz yaradılmamalıdır ────────────────────────────────────
test("mayası 0 olan oyun hovuza qoyula bilmir (zəmanəti mənasız edərdi)", () => {
  const e = computePoolEconomics(
    [{ gameId: "z", title: "Mayasız", ticketCount: 100, valueAznCents: 500, costAznCents: 0 }],
    CFG
  );
  assert.equal(e.ok, false);
  assert.ok(e.violations.some((v) => v.includes("Maya dəyəri hesablana bilməyən")));
  // Bilet sayılmadığı üçün "büdcədən keçdi" illüziyası yaranmır.
  assert.equal(e.ticketTotal, 0);
});
test("mayası mənfi/NaN olan oyun da rədd edilir", () => {
  for (const bad of [-100, Number.NaN, Number.POSITIVE_INFINITY]) {
    const e = computePoolEconomics(
      [{ gameId: "z", title: "Pis", ticketCount: 10, valueAznCents: 500, costAznCents: bad }],
      CFG
    );
    assert.equal(e.ok, false, `maya ${bad} keçməməli idi`);
  }
});
test("mayası satış dəyərindən yüksək oyun rədd edilir", () => {
  const e = computePoolEconomics(
    [{ gameId: "z", title: "Zərərli", ticketCount: 100, valueAznCents: 300, costAznCents: 350 }],
    CFG
  );
  assert.equal(e.ok, false);
  assert.ok(e.violations.some((v) => v.includes("Mayası satış qiymətindən yüksək")));
});

// ── Bilet sayı hovuz ölçüsünə bərabər olmalıdır ───────────────────────────────
test("bilet sayı poolSize-a bərabər deyilsə rədd edilir", () => {
  const few = computePoolEconomics([spec("A", 300, 99)], CFG);
  assert.equal(few.ok, false);
  assert.ok(few.violations.some((v) => v.includes("Bilet sayı 99")));

  const many = computePoolEconomics([spec("A", 300, 101)], CFG);
  assert.equal(many.ok, false);
  assert.ok(many.violations.some((v) => v.includes("Bilet sayı 101")));
});
test("boş resept rədd edilir", () => {
  const e = computePoolEconomics([], CFG);
  assert.equal(e.ok, false);
  assert.ok(e.violations.some((v) => v.includes("Heç bir hədiyyə əlavə edilməyib")));
  assert.equal(e.evValueCents, 0);
});
test("bilet sayı 0 və ya mənfi olan sətir rədd edilir", () => {
  const e = computePoolEconomics([spec("A", 300, 100), spec("B", 300, 0)], CFG);
  assert.equal(e.ok, false);
  assert.ok(e.violations.some((v) => v.includes("bilet sayı ən azı 1")));
});
test("eyni oyun iki dəfə əlavə edilə bilmir", () => {
  const dup: LootBoxTicketSpec[] = [
    { gameId: "same", title: "Bir", ticketCount: 50, valueAznCents: 300, costAznCents: 244 },
    { gameId: "same", title: "İki", ticketCount: 50, valueAznCents: 300, costAznCents: 244 },
  ];
  const e = computePoolEconomics(dup, CFG);
  assert.equal(e.ok, false);
  assert.ok(e.violations.some((v) => v.includes("iki dəfə əlavə edilib")));
});

// ── Min/maks hədiyyə həddi ────────────────────────────────────────────────────
test("minimum həddən aşağı hədiyyə tutulur", () => {
  const e = computePoolEconomics([spec("Ucuz", 299, 100)], CFG);
  assert.equal(e.ok, false);
  assert.ok(e.violations.some((v) => v.includes("Minimum hədiyyə həddindən")));
});
test("maksimum həddən yuxarı hədiyyə tutulur", () => {
  const e = computePoolEconomics([spec("Baha", 1001, 100)], CFG);
  assert.equal(e.ok, false);
  assert.ok(e.violations.some((v) => v.includes("Maksimum hədiyyə həddindən")));
});
test("sərhəd dəyərləri (dəqiq min və dəqiq maks) qəbul edilir", () => {
  const e = computePoolEconomics([spec("Min", 300, 97), spec("Maks", 1000, 3)], CFG);
  assert.ok(!e.violations.some((v) => v.includes("hədiyyə həddindən")), e.violations.join(" | "));
});

// ── Konfiqurasiya validasiyası ────────────────────────────────────────────────
const VALID_CONFIG = {
  slug: "5-azn",
  title: "5 AZN qutu",
  priceAznCents: 500,
  poolSize: 100,
  targetMarginPct: 23,
  minPrizePct: 60,
  maxPrizePct: 200,
  sellBackPct: 70,
  refillAtRemaining: 20,
};
test("validateLootBoxConfig: düzgün konfiqurasiya səhvsizdir", () => {
  assert.deepEqual(validateLootBoxConfig(VALID_CONFIG), []);
});
test("validateLootBoxConfig: pis slug rədd edilir", () => {
  for (const slug of ["5 AZN", "Qutu", "5_azn", ""]) {
    assert.ok(
      validateLootBoxConfig({ ...VALID_CONFIG, slug }).some((e) => e.includes("Slug")),
      `slug "${slug}" keçməməli idi`
    );
  }
});
test("validateLootBoxConfig: min > maks rədd edilir", () => {
  const errors = validateLootBoxConfig({ ...VALID_CONFIG, minPrizePct: 100, maxPrizePct: 100 });
  assert.deepEqual(errors, []); // 100/100 keçərlidir (sabit dəyərli qutu)
  const bad = validateLootBoxConfig({ ...VALID_CONFIG, minPrizePct: 101, maxPrizePct: 100 });
  assert.ok(bad.some((e) => e.includes("Minimum hədiyyə faizi")));
});
test("validateLootBoxConfig: refill həddi hovuz ölçüsündən kiçik olmalıdır", () => {
  assert.ok(
    validateLootBoxConfig({ ...VALID_CONFIG, refillAtRemaining: 100 }).some((e) => e.includes("Yeni hovuz həddi"))
  );
});
test("validateLootBoxConfig: hədəf marja 90%-dən yuxarı ola bilməz", () => {
  assert.ok(validateLootBoxConfig({ ...VALID_CONFIG, targetMarginPct: 95 }).some((e) => e.includes("Hədəf marja")));
});

// ── Ehtimal cədvəli ───────────────────────────────────────────────────────────
test("buildOddsTable: faizlər 100%-ə cəmlənir və bahalı birinci gəlir", () => {
  const rows = buildOddsTable(REFERENCE_POOL);
  assert.equal(rows.length, 6);
  assert.equal(rows[0].valueAznCents, 1000);
  assert.equal(rows[0].count, 3);
  assert.ok(Math.abs(rows[0].pct - 3) < 1e-9);
  assert.equal(rows[rows.length - 1].valueAznCents, 300);
  const total = rows.reduce((s, r) => s + r.pct, 0);
  assert.ok(Math.abs(total - 100) < 1e-9, `cəm ${total}`);
});
test("buildOddsTable: eyni dəyərli oyunlar bir sətirdə birləşir", () => {
  const rows = buildOddsTable([spec("A", 500, 10), spec("B", 500, 30)]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].count, 40);
  assert.equal(rows[0].pct, 100);
});
test("buildOddsTable: boş giriş boş cədvəl verir", () => {
  assert.deepEqual(buildOddsTable([]), []);
  assert.deepEqual(buildOddsTable([spec("A", 500, 0)]), []);
});
test("toPublicOdds: bilet SAYI публик cədvəldən çıxarılır", () => {
  const publicRows = toPublicOdds(buildOddsTable(REFERENCE_POOL));
  assert.equal(publicRows.length, 6);
  for (const row of publicRows) {
    assert.deepEqual(Object.keys(row).sort(), ["pct", "valueAznCents"]);
    assert.equal("count" in row, false);
  }
});

// ── Geri satma ────────────────────────────────────────────────────────────────
test("sellBackAmountCents: 70% düzgün yuvarlaqlaşdırılır", () => {
  assert.equal(sellBackAmountCents(1000, 70), 700);
  assert.equal(sellBackAmountCents(499, 70), 349); // 349.3 → 349
  assert.equal(sellBackAmountCents(501, 70), 351); // 350.7 → 351
  assert.equal(sellBackAmountCents(0, 70), 0);
  assert.equal(sellBackAmountCents(1000, 0), 0);
});
test("geri satma oyunu təhvil verməkdən HƏMİŞƏ ucuzdur (marja artır)", () => {
  // Bu, sistemin əsas iqtisadi iddiasıdır: 70% kredit < ~81% maya.
  for (const value of [300, 400, 500, 600, 800, 1000]) {
    const credit = sellBackAmountCents(value, 70);
    const deliverCost = costOf(value);
    assert.ok(credit < deliverCost, `dəyər ${value}: kredit ${credit} ≥ maya ${deliverCost}`);
  }
});

// ── Hədiyyə səviyyələri ───────────────────────────────────────────────────────
test("prizeTierFor: nisbətə görə düzgün səviyyə", () => {
  assert.equal(prizeTierFor(300, 500), "COMMON"); // 0.60
  assert.equal(prizeTierFor(399, 500), "COMMON"); // 0.798
  assert.equal(prizeTierFor(400, 500), "STANDARD"); // 0.80
  assert.equal(prizeTierFor(500, 500), "STANDARD"); // 1.00
  assert.equal(prizeTierFor(600, 500), "RARE"); // 1.20
  assert.equal(prizeTierFor(800, 500), "LEGENDARY"); // 1.60
  assert.equal(prizeTierFor(1000, 500), "LEGENDARY"); // 2.00
  assert.equal(prizeTierFor(500, 0), "STANDARD"); // sıfıra bölmə qorunması
});

// ── Sabitlər / kod formatı ────────────────────────────────────────────────────
test("status sabitləri gözlənilən dəyərləri saxlayır", () => {
  assert.deepEqual([...LOOT_BOX_OUTCOMES], ["PENDING_CHOICE", "CLAIMED_GAME", "SOLD_BACK"]);
  assert.deepEqual([...LOOT_BOX_POOL_STATUSES], ["OPEN", "EXHAUSTED", "RETIRED"]);
});
test("isLootBoxOrderCode: BOX-XXXXXX formatı", () => {
  assert.equal(isLootBoxOrderCode("BOX-A1B2C3"), true);
  assert.equal(isLootBoxOrderCode("BOX-a1b2c3"), false); // yalnız böyük hərf
  assert.equal(isLootBoxOrderCode("HON-A1B2C3"), false);
  assert.equal(isLootBoxOrderCode("BOX-A1B2C"), false);
});

// ── ƏSAS ZƏMANƏT: geri qoyulmadan çəkiliş simulyasiyası ───────────────────────
//
// Bu, sistemin bütün iddiasının sübutudur: hovuz tam bitəndə realizə olunmuş
// maya planlaşdırılan maya ilə HƏRFƏN bərabər olur — təsadüf marjaya təsir
// etmir. `drawTicket`-in DB versiyası da eyni alqoritmi işlədir (mövcud
// biletləri say → təsadüfi indeks → o bileti DRAWN et).

type SimTicket = { valueAznCents: number; costAznCents: number; drawn: boolean };

function buildSimPool(specs: LootBoxTicketSpec[]): SimTicket[] {
  const pool: SimTicket[] = [];
  for (const s of specs) {
    for (let i = 0; i < s.ticketCount; i++) {
      pool.push({ valueAznCents: s.valueAznCents, costAznCents: s.costAznCents, drawn: false });
    }
  }
  return pool;
}

/** `lib/lootBoxes.ts` → drawTicket ilə eyni məntiq, DB-siz. */
function drawOne(pool: SimTicket[], rand: () => number): SimTicket {
  const available = pool.filter((t) => !t.drawn);
  if (available.length === 0) throw new Error("NO_TICKETS");
  const picked = available[Math.floor(rand() * available.length)];
  picked.drawn = true;
  return picked;
}

/** Determinik psevdo-təsadüfi generator (test təkrarlana bilsin deyə). */
function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

test("tam drenaj: realizə olunmuş maya planla HƏRFƏN bərabərdir", () => {
  const planned = computePoolEconomics(REFERENCE_POOL, CFG);
  assert.equal(planned.ok, true);

  for (const seed of [1, 42, 12345, 999_983]) {
    const pool = buildSimPool(REFERENCE_POOL);
    const rand = seededRandom(seed);

    let realizedCost = 0;
    let realizedValue = 0;
    for (let i = 0; i < CFG.poolSize; i++) {
      const t = drawOne(pool, rand);
      realizedCost += t.costAznCents;
      realizedValue += t.valueAznCents;
    }

    assert.equal(realizedCost, planned.totalCostCents, `seed ${seed}: maya uyğun gəlmir`);
    assert.equal(realizedValue, planned.totalValueCents, `seed ${seed}: dəyər uyğun gəlmir`);
    assert.equal(pool.filter((t) => t.drawn).length, CFG.poolSize, `seed ${seed}: hər bilet bir dəfə çəkilməlidir`);
    assert.throws(() => drawOne(pool, rand), /NO_TICKETS/, `seed ${seed}: hovuz bitməli idi`);
  }
});

test("tam drenaj: realizə olunmuş marja dizayn marjasına bərabərdir", () => {
  const planned = computePoolEconomics(REFERENCE_POOL, CFG);
  const pool = buildSimPool(REFERENCE_POOL);
  const rand = seededRandom(7);

  let revenue = 0;
  let cost = 0;
  for (let i = 0; i < CFG.poolSize; i++) {
    revenue += CFG.priceAznCents;
    cost += drawOne(pool, rand).costAznCents;
  }

  const realizedMargin = ((revenue - cost) / revenue) * 100;
  assert.ok(Math.abs(realizedMargin - planned.marginPct) < 1e-9, `${realizedMargin} ≠ ${planned.marginPct}`);
  assert.ok(realizedMargin >= CFG.targetMarginPct, `realizə marja ${realizedMargin} < hədəf ${CFG.targetMarginPct}`);
});

test("geri satma marjanı HEÇ VAXT pisləşdirmir (hər nisbətdə)", () => {
  const planned = computePoolEconomics(REFERENCE_POOL, CFG);

  // Müştərilərin 0%, 25%, 50%, 75%, 100%-i hədiyyəni geri satır.
  for (const sellBackShare of [0, 0.25, 0.5, 0.75, 1]) {
    const pool = buildSimPool(REFERENCE_POOL);
    const rand = seededRandom(2024);
    let revenue = 0;
    let cost = 0;

    for (let i = 0; i < CFG.poolSize; i++) {
      const t = drawOne(pool, rand);
      revenue += CFG.priceAznCents;
      // Geri satılan hədiyyə TAM nominalla maya sayılır (konservativ mühasibat).
      cost += i < CFG.poolSize * sellBackShare ? sellBackAmountCents(t.valueAznCents, 70) : t.costAznCents;
    }

    const margin = ((revenue - cost) / revenue) * 100;
    assert.ok(
      margin >= planned.marginPct - 1e-9,
      `geri satma ${sellBackShare * 100}%: marja ${margin.toFixed(2)}% < baza ${planned.marginPct.toFixed(2)}%`
    );
    assert.ok(margin >= CFG.targetMarginPct, `geri satma ${sellBackShare * 100}%: marja hədəfdən aşağı`);
  }
});

test("qismən drenaj: ən pis halda belə maya büdcəni aşa bilmir", () => {
  // Hovuzdakı ƏN BAHALI biletlər ardıcıl çəkilsə (mümkün ən pis ssenari),
  // ödənilmiş məbləğə düşən maya hələ də ümumi büdcədən çox ola bilməz.
  const planned = computePoolEconomics(REFERENCE_POOL, CFG);
  const sortedByCostDesc = buildSimPool(REFERENCE_POOL).sort((a, b) => b.costAznCents - a.costAznCents);

  let cost = 0;
  for (let i = 0; i < CFG.poolSize; i++) {
    cost += sortedByCostDesc[i].costAznCents;
    // Hovuz bitənə qədər ani marja mənfi ola bilər — zəmanət hovuz
    // səviyyəsindədir. Vacib olan: sonda büdcə aşılmır.
  }
  assert.equal(cost, planned.totalCostCents);
  assert.ok(cost <= planned.budgetCostCents);
});

// ── Avtomatik oyun seçimi (allokator) ─────────────────────────────────────────
//
// Allokator yalnız TƏKLİF verir; son yoxlama computePoolEconomics-dədir.
// Bu testlərin məqsədi: allokator heç bir girişdə büdcəni aşan təklif verməsin.

function candidate(id: string, valueCents: number, stars = 1): CandidateGame {
  return { gameId: id, title: `Oyun ${id}`, valueAznCents: valueCents, costAznCents: costOf(valueCents), stars };
}

/** Kataloqa bənzər namizəd dəsti: 3–10 AZN aralığında müxtəlif oyunlar. */
const CATALOG: CandidateGame[] = [
  candidate("a", 300),
  candidate("b", 350),
  candidate("c", 400),
  candidate("d", 450),
  candidate("e", 500),
  candidate("f", 600),
  candidate("g", 700),
  candidate("h", 800),
  candidate("i", 900),
  candidate("j", 1000),
];

test("allokator: büdcəyə sığan tam hovuz qurur", () => {
  const r = allocateTickets(CATALOG, CFG);
  assert.equal(r.economics.ticketTotal, CFG.poolSize, r.notes.join(" | "));
  assert.equal(r.economics.ok, true, r.economics.violations.join(" | "));
  assert.ok(r.economics.totalCostCents <= r.economics.budgetCostCents);
  assert.ok(r.economics.marginPct >= CFG.targetMarginPct);
});

test("allokator: ULDUZ verilən oyun daha tez-tez çıxır", () => {
  const starred = CATALOG.map((c) => (c.gameId === "e" ? { ...c, stars: 5 } : c));
  const r = allocateTickets(starred, CFG);
  const eCount = r.tickets.find((t) => t.gameId === "e")?.ticketCount ?? 0;
  const plainCount = r.tickets.find((t) => t.gameId === "d")?.ticketCount ?? 0;
  assert.ok(eCount > plainCount, `ulduzlu ${eCount} ≤ adi ${plainCount}`);
});

test("allokator: bir oyun hovuzun 40%-dən çoxunu tuta bilmir", () => {
  // Hamısına maksimum ulduz — yenə də heç biri hədd keçməməlidir.
  const allStarred = CATALOG.map((c) => ({ ...c, stars: 5 }));
  const r = allocateTickets(allStarred, CFG);
  const cap = Math.ceil((CFG.poolSize * 40) / 100);
  for (const t of r.tickets) {
    assert.ok(t.ticketCount <= cap, `${t.gameId}: ${t.ticketCount} > ${cap}`);
  }
});

test("allokator: ÇOX BAHALI kataloqda belə büdcəni aşmır", () => {
  // Hamısı maksimum dəyərdə (10 AZN) — bu, büdcəni tam hovuzda aşır.
  const expensive = [
    candidate("x1", 1000, 5),
    candidate("x2", 1000, 5),
    candidate("x3", 1000, 5),
    candidate("x4", 950, 5),
  ];
  const r = allocateTickets(expensive, CFG);
  // Tam hovuz qurula bilməz, amma qurulan hissə HEÇ VAXT büdcəni aşmamalıdır.
  assert.ok(r.economics.totalCostCents <= r.economics.budgetCostCents);
  assert.ok(r.economics.ticketTotal < CFG.poolSize);
  assert.ok(r.notes.some((n) => n.includes("Büdcə")), r.notes.join(" | "));
  // Və computePoolEconomics bunu qəbul etməməlidir (bilet sayı tam deyil).
  assert.equal(r.economics.ok, false);
});

test("allokator: aralıqdan kənar oyunlar avtomatik süzülür", () => {
  const mixed = [
    ...CATALOG,
    candidate("tooCheap", 100), // 3 AZN-dən aşağı
    candidate("tooRich", 5000), // 10 AZN-dən yuxarı
  ];
  const r = allocateTickets(mixed, CFG);
  assert.equal(r.excluded.outOfRange, 2);
  assert.equal(r.tickets.some((t) => t.gameId === "tooCheap" || t.gameId === "tooRich"), false);
  assert.equal(r.economics.ok, true, r.economics.violations.join(" | "));
});

test("allokator: mayası bilinməyən / zərərli oyunlar süzülür", () => {
  const bad = [
    ...CATALOG,
    { gameId: "noCost", title: "Mayasız", valueAznCents: 500, costAznCents: 0, stars: 5 },
    { gameId: "loss", title: "Zərərli", valueAznCents: 400, costAznCents: 450, stars: 5 },
  ];
  const r = allocateTickets(bad, CFG);
  assert.equal(r.excluded.noCost, 1);
  assert.equal(r.excluded.lossMaking, 1);
  assert.equal(r.tickets.some((t) => t.gameId === "noCost" || t.gameId === "loss"), false);
});

test("allokator: namizəd yoxdursa təmiz boş nəticə verir", () => {
  const r = allocateTickets([], CFG);
  assert.deepEqual(r.tickets, []);
  assert.equal(r.economics.ok, false);
  assert.ok(r.notes.some((n) => n.includes("Uyğun oyun tapılmadı")));
});

test("allokator: büdcə boşluğunu dəyərə çevirir (səxavətli olur)", () => {
  // Yalnız ucuz oyunlar + bir neçə bahalı: boşluq qalarsa bahalılar seçilməlidir.
  const r = allocateTickets(CATALOG, CFG);
  const headroomPct = (r.economics.headroomCents / r.economics.budgetCostCents) * 100;
  // Boşluq 5%-dən az olmalıdır — yəni büdcə demək olar tam istifadə olunub.
  assert.ok(headroomPct < 5, `büdcənin ${headroomPct.toFixed(1)}%-i istifadəsiz qaldı`);
});

test("allokator: müxtəlif hovuz ölçüləri və marjalarda heç vaxt büdcəni aşmır", () => {
  for (const poolSize of [10, 25, 50, 100, 250]) {
    for (const targetMarginPct of [10, 23, 26, 40, 60]) {
      for (const priceAznCents of [300, 500, 1000, 5000]) {
        const cfg: LootBoxConfig = { priceAznCents, poolSize, targetMarginPct, minPrizePct: 60, maxPrizePct: 200 };
        // Namizədləri bu qutunun aralığına uyğun qururuq.
        const min = Math.round(priceAznCents * 0.6);
        const max = Math.round(priceAznCents * 2);
        const pool: CandidateGame[] = [];
        for (let i = 0; i < 12; i++) {
          const v = Math.round(min + ((max - min) * i) / 11);
          pool.push(candidate(`g${i}`, v, (i % 5) + 1));
        }
        const r = allocateTickets(pool, cfg);
        assert.ok(
          r.economics.totalCostCents <= r.economics.budgetCostCents,
          `poolSize=${poolSize} marja=${targetMarginPct} qiymət=${priceAznCents}: ` +
            `maya ${r.economics.totalCostCents} > büdcə ${r.economics.budgetCostCents}`
        );
        if (r.economics.ticketTotal === poolSize) {
          assert.ok(
            r.economics.marginPct >= targetMarginPct,
            `poolSize=${poolSize} marja=${r.economics.marginPct} < ${targetMarginPct}`
          );
        }
      }
    }
  }
});

// ── Hədiyyə paylanması (pillələr) ────────────────────────────────────────────
test("paylanma: hovuz tək dəyərdə toplanmır", () => {
  /*
    3–9 AZN aralığında 200 oyun (5 AZN qutu üçün). Yuxarı hədd qəsdən 10 deyil:
    təkrar limiti 1 olanda allokator 100 FƏRQLİ oyun almalıdır, onların orta
    mayası isə büdcəyə sığmalıdır. 3–10 aralığı bu şərti bir neçə qəpiklə
    pozur və hovuz qurulmur — bu, allokatorun düzgün davranışıdır.
  */
  const catalog: CandidateGame[] = Array.from({ length: 200 }, (_, i) =>
    candidate(`p${i}`, 300 + Math.round((i * 600) / 199)),
  );
  const r = allocateTickets(catalog, CFG, { maxSharePct: 40, maxTicketsPerGame: 1 });

  const total = r.tickets.reduce((s, t) => s + t.ticketCount, 0);
  assert.equal(total, CFG.poolSize, "hovuz dolmalıdır");

  const odds = buildOddsTable(r.tickets);
  const topPct = Math.max(...odds.map((o) => o.pct));
  assert.ok(odds.length >= 5, `ən azı 5 fərqli dəyər olmalıdır, oldu: ${odds.length}`);
  assert.ok(topPct <= 60, `bir dəyər hovuzun ${topPct}%-ni tutdu — paylanma pozulub`);

  // Ən azı bir "əfsanəvi" (≥ 1.6× qutu qiyməti) bilet olmalıdır — həyəcanın mənbəyi.
  const legendary = r.tickets.filter((t) => prizeTierFor(t.valueAznCents, CFG.priceAznCents) === "LEGENDARY");
  assert.ok(legendary.length > 0, "ən azı bir əfsanəvi hədiyyə olmalıdır");
  assert.ok(r.economics.ok, `büdcə pozulmamalıdır: ${r.economics.violations.join("; ")}`);
});

test("paylanma: forma dəyişsə də büdcə heç vaxt aşılmır", () => {
  const catalog: CandidateGame[] = Array.from({ length: 200 }, (_, i) =>
    candidate(`q${i}`, 300 + Math.round((i * 600) / 199)),
  );
  // Qəsdən həddindən səxavətli forma — allokator büdcəyə görə geri çəkilməlidir.
  const greedy = { LEGENDARY: 50, RARE: 30, STANDARD: 15, COMMON: 5 };
  const r = allocateTickets(catalog, CFG, { maxSharePct: 40, maxTicketsPerGame: 1, shape: greedy });
  assert.ok(
    r.economics.totalCostCents <= r.economics.budgetCostCents,
    `maya büdcəni aşdı: ${r.economics.totalCostCents} > ${r.economics.budgetCostCents}`,
  );
  assert.ok(r.economics.marginPct >= CFG.targetMarginPct, `marja ${r.economics.marginPct} < hədəf`);
});

// ── Çeşid limiti: bir oyundan maksimum bilet ─────────────────────────────────
test("maxTicketsPerGame=1: hər bilet fərqli oyun olur", () => {
  /*
    Kataloq qəsdən büdcəyə rahat sığan qiymətlərdədir. Bahalı kataloqda 40
    FƏRQLİ bilet mümkün olmaya bilər: təkrar limiti 1 olanda allokator ən ucuz
    oyunu təkrarlaya bilmir və orta maya qalxır — bu, allokatorun düzgün
    davranışıdır (büdcə hər şeydən üstündür), amma bu testin mövzusu deyil.
  */
  const catalog: CandidateGame[] = Array.from({ length: 40 }, (_, i) => candidate(`v${i}`, 300 + i * 2));
  const cfg: LootBoxConfig = { ...CFG, poolSize: 40 };
  const r = allocateTickets(catalog, cfg, { maxSharePct: 40, maxTicketsPerGame: 1 });

  assert.equal(r.tickets.reduce((s, t) => s + t.ticketCount, 0), 40, "hovuz dolmalıdır");
  assert.equal(r.tickets.length, 40, "40 fərqli oyun olmalıdır");
  assert.ok(r.tickets.every((t) => t.ticketCount === 1), "heç bir oyun təkrarlanmamalıdır");
  assert.ok(r.economics.ok, `büdcə pozulmamalıdır: ${r.economics.violations.join("; ")}`);
});

test("maxTicketsPerGame: faiz limiti ilə birlikdə DAHA SƏRTİ tətbiq olunur", () => {
  const catalog: CandidateGame[] = Array.from({ length: 60 }, (_, i) => candidate(`w${i}`, 300 + i * 5));

  // Faiz 40% → 40 bilet; mütləq 3 → 3 qalib gəlir.
  const strictAbsolute = allocateTickets(catalog, CFG, { maxSharePct: 40, maxTicketsPerGame: 3 });
  assert.ok(
    strictAbsolute.tickets.every((t) => t.ticketCount <= 3),
    "mütləq limit faizdən sərt olanda o tətbiq olunmalıdır",
  );

  // Faiz 2% → 2 bilet; mütləq 50 daha boşdur, faiz qalib gəlməlidir.
  const strictPercent = allocateTickets(catalog, CFG, { maxSharePct: 2, maxTicketsPerGame: 50 });
  assert.ok(
    strictPercent.tickets.every((t) => t.ticketCount <= 2),
    "faiz limiti mütləqdən sərt olanda o tətbiq olunmalıdır",
  );

  // 0 = mütləq limit yoxdur, davranış dəyişməməlidir.
  assert.deepEqual(
    allocateTickets(catalog, CFG, { maxSharePct: 40, maxTicketsPerGame: 0 }).tickets,
    allocateTickets(catalog, CFG, { maxSharePct: 40 }).tickets,
    "0 köhnə davranışı saxlamalıdır",
  );
});

test("çeşid limiti marjaya zərər vermir", () => {
  // Çeşidi artırmaq büdcə zəmanətini pozmamalıdır — bu, əsas kommersiya şərtidir.
  const catalog: CandidateGame[] = Array.from({ length: 200 }, (_, i) => candidate(`x${i}`, 300 + i * 3));
  for (const maxTicketsPerGame of [0, 1, 2, 5, 10]) {
    const r = allocateTickets(catalog, CFG, { maxSharePct: 40, maxTicketsPerGame });
    assert.ok(
      r.economics.totalCostCents <= r.economics.budgetCostCents,
      `maxTicketsPerGame=${maxTicketsPerGame}: maya büdcəni aşdı`,
    );
    assert.ok(
      r.economics.marginPct >= CFG.targetMarginPct,
      `maxTicketsPerGame=${maxTicketsPerGame}: marja ${r.economics.marginPct} < ${CFG.targetMarginPct}`,
    );
  }
});

test("allokator: determinikdir (eyni giriş → eyni nəticə)", () => {
  const a = allocateTickets(CATALOG, CFG);
  const b = allocateTickets(CATALOG, CFG);
  assert.deepEqual(a.tickets, b.tickets);
});

// ── "Neçə bilet ala bilərəm?" hesabı ──────────────────────────────────────────
test("affordabilityFor: büdcənin neçə biletə çatdığını düzgün deyir", () => {
  // 5 AZN qutu, 100 bilet, 23% marja → büdcə 385 AZN.
  const tenAznCost = costOf(1000); // ~813 qəpik
  const a = affordabilityFor(tenAznCost, CFG);
  assert.equal(a.maxTickets, Math.floor(38_500 / tenAznCost));
  assert.equal(a.wholePoolAffordable, false); // 100 × 8.13 = 813 AZN > 385
  assert.equal(a.costIfWholePool, tenAznCost * 100);

  const threeAznCost = costOf(300); // ~244
  const b = affordabilityFor(threeAznCost, CFG);
  assert.equal(b.wholePoolAffordable, true); // 100 × 2.44 = 244 AZN ≤ 385
});
test("affordabilityFor: keçərsiz mayada 0 qaytarır", () => {
  assert.deepEqual(affordabilityFor(0, CFG), { maxTickets: 0, wholePoolAffordable: false, costIfWholePool: 0 });
  assert.deepEqual(affordabilityFor(-5, CFG), { maxTickets: 0, wholePoolAffordable: false, costIfWholePool: 0 });
});

// ── Nəticə ────────────────────────────────────────────────────────────────────
if (failures.length) {
  console.error(`\n${failures.join("\n\n")}\n`);
  console.error(`❌ ${failures.length} uğursuz, ${passed} keçdi`);
  process.exit(1);
} else {
  console.log(`✅ Bütün testlər keçdi (${passed})`);
}
