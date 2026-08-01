/**
 * Qutu açılışı — DB inteqrasiya / drenaj testi.
 * İşə salmaq: `LOOTBOX_DRAIN_CONFIRM=1 npm run lootbox:drain`
 *
 * Bu skript BAZAYA YAZIR. Ona görə:
 *   • `LOOTBOX_DRAIN_CONFIRM=1` olmadan işləmir;
 *   • bütün fikstürləri `__lootbox_drain_` prefiksi ilə ÖZÜ yaradır (kataloqdaki
 *     real oyunlara toxunmur), sonda `finally`-də hamısını silir;
 *   • real istifadəçilərə/sifarişlərə heç bir təsiri yoxdur.
 *
 * Yoxlanılanlar (saf riyaziyyat scripts/lootBox.test.ts-dədir):
 *   1. Büdcəni aşan resept üçün hovuz YARADILMIR.
 *   2. Hovuz tam boşaldılanda realizə olunmuş maya planla HƏRFƏN bərabərdir.
 *   3. Heç bir bilet iki dəfə çəkilmir; cüzdandan dəqiq N × qiymət tutulur.
 *   4. Balans çatmayanda açılış baş vermir və balans dəyişmir.
 *   5. Geri satma cüzdana düzgün kredit yazır.
 *   6. Biletlər bitəndə açılış təmiz xəta ilə dayanır.
 */
import "dotenv/config";
import assert from "node:assert/strict";

import { prisma } from "../lib/prisma";
import { getSettings, aznToTryCents, computeDisplayPrice } from "../lib/pricing";
import {
  generatePool,
  openLootBox,
  resolveOpeningChoice,
  resolveTemplateSpecs,
  computePoolEconomics,
  lootBoxConfigOf,
  sellBackAmountCents,
  LootBoxError,
} from "../lib/lootBoxes";

const PREFIX = "__lootbox_drain_";
const BOX_SLUG = `${PREFIX}box`;
const POOL_SIZE = 40;
const PRICE_CENTS = 500;
const TARGET_MARGIN = 23;

if (process.env.LOOTBOX_DRAIN_CONFIRM !== "1") {
  console.error(
    [
      "",
      "⚠️  Bu skript bazaya yazır (test fikstürləri yaradıb sonra silir).",
      "",
      "   İşə salmaq üçün:  LOOTBOX_DRAIN_CONFIRM=1 npm run lootbox:drain",
      "",
      `   Hədəf baza: ${(process.env.DATABASE_URL ?? "(təyin edilməyib)").replace(/:\/\/[^:]+:[^@]+@/, "://***:***@")}`,
      "",
    ].join("\n")
  );
  process.exit(1);
}

let passed = 0;
const failures: string[] = [];
function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures.push(`✗ ${name}\n   ${(err as Error).message}`);
    console.log(`  ✗ ${name}`);
  }
}

const createdGameIds: string[] = [];
let boxId: string | null = null;
let userId: string | null = null;

/** Verilmiş AZN dəyərinə yaxın görünən sintetik oyun yaradır. */
async function createPricedGame(targetAzn: number, index: number) {
  const settings = await getSettings();
  const priceTryCents = aznToTryCents(targetAzn, settings, "ceil");

  const game = await prisma.game.create({
    data: {
      productId: `${PREFIX}product_${index}_${Date.now()}`,
      title: `${PREFIX}game_${index}`,
      slug: `${PREFIX}game_${index}_${Date.now()}`,
      priceTryCents,
      discountTryCents: null,
      store: "PS",
      isActive: true,
    },
    select: { id: true, priceTryCents: true, discountTryCents: true, discountEndAt: true, store: true, priceUsdCents: true, discountUsdCents: true },
  });
  createdGameIds.push(game.id);

  const value = Math.round(computeDisplayPrice(game, settings).finalAzn * 100);
  return { id: game.id, valueAznCents: value };
}

async function main() {
  console.log("\n🎲 Qutu açılışı — drenaj testi\n");

  // ── Fikstürlər ─────────────────────────────────────────────────────────────
  // Qiymətlər qutu qiymətinin 60%–200% aralığında olmalıdır (3–10 AZN).
  const tiers = await Promise.all(
    [3, 4, 5, 6, 8, 10].map((azn, i) => createPricedGame(azn, i))
  );
  console.log(`  Sintetik oyunlar: ${tiers.map((t) => (t.valueAznCents / 100).toFixed(2)).join(", ")} AZN`);

  const box = await prisma.lootBox.create({
    data: {
      slug: BOX_SLUG,
      title: "Drenaj test qutusu",
      priceAznCents: PRICE_CENTS,
      targetMarginPct: TARGET_MARGIN,
      minPrizePct: 60,
      maxPrizePct: 200,
      poolSize: POOL_SIZE,
      sellBackPct: 70,
      refillAtRemaining: 0, // avtomatik doldurma söndürülüb — drenajı ölçə bilək
      isActive: true,
    },
  });
  boxId = box.id;

  // ── 1. Büdcəni aşan resept rədd edilir ─────────────────────────────────────
  // Bütün biletləri ən bahalı oyuna veririk — bu, büdcəni mütləq aşır.
  await prisma.lootBoxTemplate.create({
    data: { lootBoxId: box.id, gameId: tiers[tiers.length - 1].id, ticketCount: POOL_SIZE },
  });

  let refused = false;
  let refusalMessage = "";
  try {
    await generatePool({ lootBoxId: box.id });
  } catch (err) {
    refused = err instanceof LootBoxError && err.code === "BUDGET_VIOLATION";
    refusalMessage = (err as Error).message;
  }
  check("büdcəni aşan resept üçün hovuz YARADILMIR", () => {
    assert.equal(refused, true, `gözlənilən BUDGET_VIOLATION, alınan: ${refusalMessage}`);
  });
  const poolsAfterRefusal = await prisma.lootBoxPool.count({ where: { lootBoxId: box.id } });
  check("rədd ediləndən sonra hovuz sayı 0-dır", () => {
    assert.equal(poolsAfterRefusal, 0);
  });

  // ── Keçərli resept qururuq (ac gözlü allokator) ────────────────────────────
  // Bütün biletləri ən ucuz oyundan başlayırıq, sonra büdcə imkan verdikcə
  // biletləri daha bahalı pilləyə "yüksəldirik". Bu, canlı kurs/marja
  // parametrlərindən asılı olmadan həmişə keçərli hovuz verir.
  await prisma.lootBoxTemplate.deleteMany({ where: { lootBoxId: box.id } });

  const sorted = [...tiers].sort((a, b) => a.valueAznCents - b.valueAznCents);
  const counts = new Map<string, number>([[sorted[0].id, POOL_SIZE]]);
  const specsFor = async () => {
    await prisma.lootBoxTemplate.deleteMany({ where: { lootBoxId: box.id } });
    for (const [gameId, ticketCount] of counts) {
      if (ticketCount > 0) {
        await prisma.lootBoxTemplate.create({ data: { lootBoxId: box.id, gameId, ticketCount } });
      }
    }
    return resolveTemplateSpecs(box.id);
  };

  for (let tierIdx = sorted.length - 1; tierIdx >= 1; tierIdx--) {
    const target = sorted[tierIdx];
    const base = sorted[0];
    // Bu pillədən neçə bilet əlavə edə bilərik?
    for (let n = 0; n < POOL_SIZE; n++) {
      const trial = new Map(counts);
      trial.set(base.id, (trial.get(base.id) ?? 0) - 1);
      trial.set(target.id, (trial.get(target.id) ?? 0) + 1);
      if ((trial.get(base.id) ?? 0) < 0) break;

      const specs = [...trial.entries()]
        .filter(([, c]) => c > 0)
        .map(([gameId, ticketCount]) => {
          const t = tiers.find((x) => x.id === gameId)!;
          return { gameId, title: gameId, ticketCount, valueAznCents: t.valueAznCents, costAznCents: 1 };
        });
      // Real mayaları resolveTemplateSpecs verir; burada yalnız dəyər tarazlığı
      // üçün kobud yoxlama edirik, dəqiq yoxlama aşağıda computePoolEconomics-dədir.
      const totalValue = specs.reduce((s, x) => s + x.valueAznCents * x.ticketCount, 0);
      if (totalValue > POOL_SIZE * PRICE_CENTS * 0.9) break;
      counts.clear();
      for (const [k, v] of trial) counts.set(k, v);
    }
  }

  const specs = await specsFor();
  const economics = computePoolEconomics(specs, lootBoxConfigOf(box));
  console.log(
    `  Resept: ${economics.ticketTotal} bilet, dəyər ${(economics.totalValueCents / 100).toFixed(2)} AZN, ` +
      `maya ${(economics.totalCostCents / 100).toFixed(2)} AZN, büdcə ${(economics.budgetCostCents / 100).toFixed(2)} AZN, ` +
      `marja ${economics.marginPct.toFixed(2)}%`
  );
  check("qurulmuş resept büdcədən keçir", () => {
    assert.equal(economics.ok, true, economics.violations.join(" | "));
  });

  const { pool } = await generatePool({ lootBoxId: box.id });
  const ticketCount = await prisma.lootBoxTicket.count({ where: { poolId: pool.id } });
  check(`hovuz ${POOL_SIZE} biletlə yaradıldı`, () => {
    assert.equal(ticketCount, POOL_SIZE);
    assert.equal(pool.totalTickets, POOL_SIZE);
    assert.ok(pool.plannedCostCents <= pool.budgetCostCents);
  });

  // ── Test istifadəçisi ──────────────────────────────────────────────────────
  const user = await prisma.user.create({
    data: {
      email: `${PREFIX}${Date.now()}@example.invalid`,
      name: "Drenaj Test",
      passwordHash: "x",
      referralCode: `${PREFIX}${Date.now()}`.slice(0, 20),
      walletBalance: PRICE_CENTS * POOL_SIZE,
    },
  });
  userId = user.id;

  // ── 2. Tam drenaj ──────────────────────────────────────────────────────────
  const drawnTicketIds = new Set<string>();
  let realizedCost = 0;
  for (let i = 0; i < POOL_SIZE; i++) {
    const result = await openLootBox({ userId: user.id, box });
    const opening = await prisma.lootBoxOpening.findUnique({
      where: { id: result.openingId },
      select: { ticketId: true, costAznCents: true },
    });
    assert.ok(opening, "açılış qeydi yaradılmalıdır");
    drawnTicketIds.add(opening.ticketId);
    realizedCost += opening.costAznCents;
  }

  check("hər bilet DƏQİQ bir dəfə çəkildi", () => {
    assert.equal(drawnTicketIds.size, POOL_SIZE);
  });
  check("realizə olunmuş maya planla HƏRFƏN bərabərdir", () => {
    assert.equal(realizedCost, pool.plannedCostCents);
  });
  check("realizə olunmuş marja hədəfdən aşağı deyil", () => {
    const revenue = PRICE_CENTS * POOL_SIZE;
    const margin = ((revenue - realizedCost) / revenue) * 100;
    assert.ok(margin >= TARGET_MARGIN, `marja ${margin.toFixed(2)}% < ${TARGET_MARGIN}%`);
  });

  const afterDrain = await prisma.user.findUnique({ where: { id: user.id }, select: { walletBalance: true } });
  check("cüzdandan dəqiq N × qiymət tutuldu", () => {
    assert.equal(afterDrain?.walletBalance, 0);
  });

  // ── 3. Biletlər bitəndə təmiz xəta ─────────────────────────────────────────
  await prisma.user.update({ where: { id: user.id }, data: { walletBalance: PRICE_CENTS } });
  let noTickets = false;
  try {
    await openLootBox({ userId: user.id, box });
  } catch (err) {
    noTickets = err instanceof LootBoxError && err.code === "NO_TICKETS";
  }
  check("biletlər bitəndə NO_TICKETS xətası verilir", () => {
    assert.equal(noTickets, true);
  });
  const afterFailedOpen = await prisma.user.findUnique({ where: { id: user.id }, select: { walletBalance: true } });
  check("uğursuz açılışda balans GERİ QAYTARILIR (transaction rollback)", () => {
    assert.equal(afterFailedOpen?.walletBalance, PRICE_CENTS);
  });

  // ── 4. Balans çatmayanda ───────────────────────────────────────────────────
  await generatePool({ lootBoxId: box.id }); // yeni hovuz
  await prisma.user.update({ where: { id: user.id }, data: { walletBalance: PRICE_CENTS - 1 } });
  let insufficient = false;
  try {
    await openLootBox({ userId: user.id, box });
  } catch (err) {
    insufficient = err instanceof LootBoxError && err.code === "INSUFFICIENT_BALANCE";
  }
  const afterInsufficient = await prisma.user.findUnique({
    where: { id: user.id },
    select: { walletBalance: true },
  });
  check("balans çatmayanda INSUFFICIENT_BALANCE və balans dəyişmir", () => {
    assert.equal(insufficient, true);
    assert.equal(afterInsufficient?.walletBalance, PRICE_CENTS - 1);
  });

  // ── 5. Geri satma ──────────────────────────────────────────────────────────
  await prisma.user.update({ where: { id: user.id }, data: { walletBalance: PRICE_CENTS } });
  const opened = await openLootBox({ userId: user.id, box });
  const balanceBeforeSell =
    (await prisma.user.findUnique({ where: { id: user.id }, select: { walletBalance: true } }))?.walletBalance ?? 0;

  const sold = await resolveOpeningChoice({ openingId: opened.openingId, userId: user.id, choice: "SELL_BACK" });
  const expectedCredit = sellBackAmountCents(opened.prize.valueAznCents, box.sellBackPct);

  check("geri satma cüzdana düzgün kredit yazır", () => {
    assert.equal(sold.outcome, "SOLD_BACK");
    assert.equal(sold.sellBackCents, expectedCredit);
    assert.equal(sold.walletBalanceAfter, balanceBeforeSell + expectedCredit);
  });
  check("geri satma krediti oyunun mayasından ucuzdur (marja artır)", () => {
    assert.ok(
      expectedCredit < opened.prize.valueAznCents,
      "kredit hədiyyə dəyərindən kiçik olmalıdır"
    );
  });

  // ── 6. İkiqat seçim bloklanır ──────────────────────────────────────────────
  let alreadyResolved = false;
  try {
    await resolveOpeningChoice({ openingId: opened.openingId, userId: user.id, choice: "GAME" });
  } catch (err) {
    alreadyResolved = err instanceof LootBoxError && err.code === "ALREADY_RESOLVED";
  }
  check("eyni açılış üçün ikinci seçim bloklanır", () => {
    assert.equal(alreadyResolved, true);
  });
}

async function cleanup() {
  console.log("\n🧹 Təmizlik...");
  try {
    if (boxId) {
      const openings = await prisma.lootBoxOpening.findMany({
        where: { lootBoxId: boxId },
        select: { paymentTransactionId: true, sellBackTransactionId: true, fulfillmentTransactionId: true },
      });
      const txIds = openings
        .flatMap((o) => [o.paymentTransactionId, o.sellBackTransactionId, o.fulfillmentTransactionId])
        .filter((x): x is string => Boolean(x));

      await prisma.lootBoxOpening.deleteMany({ where: { lootBoxId: boxId } });
      if (txIds.length > 0) await prisma.transaction.deleteMany({ where: { id: { in: txIds } } });
      await prisma.lootBoxTemplate.deleteMany({ where: { lootBoxId: boxId } });
      await prisma.lootBoxPool.deleteMany({ where: { lootBoxId: boxId } }); // biletlər CASCADE
      await prisma.lootBox.delete({ where: { id: boxId } });
    }
    if (userId) {
      await prisma.transaction.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
    }
    if (createdGameIds.length > 0) {
      await prisma.game.deleteMany({ where: { id: { in: createdGameIds } } });
    }
    console.log("  ✓ bütün test fikstürləri silindi");
  } catch (err) {
    console.error("  ⚠️  təmizlik tam alınmadı:", (err as Error).message);
    console.error(`     Əl ilə yoxlayın: "${PREFIX}" prefiksli sətirlər.`);
  }
}

main()
  .catch((err) => {
    failures.push(`✗ skript dayandı\n   ${(err as Error).stack ?? (err as Error).message}`);
  })
  .finally(async () => {
    await cleanup();
    if (failures.length) {
      console.error(`\n${failures.join("\n\n")}\n`);
      console.error(`❌ ${failures.length} uğursuz, ${passed} keçdi`);
      process.exit(1);
    }
    console.log(`\n✅ Bütün drenaj testləri keçdi (${passed})`);
    process.exit(0);
  });
