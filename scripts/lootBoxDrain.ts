/**
 * Qutu açılışı — DB inteqrasiya / drenaj testi.
 * İşə salmaq: `LOOTBOX_DRAIN_CONFIRM=1 npm run lootbox:drain`
 *
 * Bu skript BAZAYA YAZIR. Ona görə:
 *   • `LOOTBOX_DRAIN_CONFIRM=1` olmadan işləmir;
 *   • bütün fikstürləri `__lootbox_drain_` prefiksi ilə ÖZÜ yaradır və sintetik
 *     oyunlara xüsusi `store` dəyəri verib qutunu yalnız onlara bağlayır —
 *     yəni kataloqdaki real oyunlar seçimə heç vaxt qarışmır;
 *   • sonda `finally`-də hər şeyi silir.
 *
 * Yoxlananlar (saf riyaziyyat scripts/lootBox.test.ts-dədir):
 *   1. Büdcəyə sığmayan konfiqurasiyada hovuz YARADILMIR.
 *   2. Sistem oyunları özü seçir və hovuz tam qurulur.
 *   3. Hovuz tam boşaldılanda realizə olunmuş maya planla HƏRFƏN bərabərdir.
 *   4. Heç bir bilet iki dəfə çəkilmir; cüzdandan dəqiq N × qiymət tutulur.
 *   5. Balans çatmayanda açılış baş vermir və balans dəyişmir.
 *   6. Geri satma cüzdana düzgün kredit yazır, ikinci seçim bloklanır.
 *   7. Endirimi tezliklə bitən oyun yeni hovuza salınmır.
 *   8. Eyni müştəri eyni oyunu iki dəfə qazanmır; uyğun oyun bitəndə
 *      NO_NEW_PRIZES verilir və pul tutulmur.
 */
import "dotenv/config";
import assert from "node:assert/strict";

import { prisma } from "../lib/prisma";
import { getSettings, aznToTryCents, computeDisplayPrice } from "../lib/pricing";
import {
  generatePool,
  openLootBox,
  resolveOpeningChoice,
  buildAutoRecipe,
  findCandidates,
  sellBackAmountCents,
  LootBoxError,
} from "../lib/lootBoxes";

const PREFIX = "__lootbox_drain_";
const BOX_SLUG = `${PREFIX}box`;
/** Sintetik oyunları kataloqdan təcrid etmək üçün saxta storefront. */
const TEST_STORE = `${PREFIX}store`;
const POOL_SIZE = 40;
const PRICE_CENTS = 500;
const TARGET_MARGIN = 26;

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
let soloUserId: string | null = null;

/** Verilmiş AZN dəyərinə yaxın sintetik oyun yaradır. */
async function createPricedGame(targetAzn: number, index: number, discountEndAt?: Date) {
  const settings = await getSettings();
  const priceTryCents = aznToTryCents(targetAzn, settings, "ceil");
  const stamp = `${Date.now()}_${index}`;

  const game = await prisma.game.create({
    data: {
      productId: `${PREFIX}product_${stamp}`,
      title: `${PREFIX}game_${index}`,
      slug: `${PREFIX}game_${stamp}`,
      priceTryCents,
      discountTryCents: discountEndAt ? Math.round(priceTryCents * 0.8) : null,
      discountEndAt: discountEndAt ?? null,
      store: TEST_STORE,
      // Qutu yalnız productType="GAME" seçir (DLC/valyuta paketi düşmür).
      productType: "GAME",
      isActive: true,
    },
    select: {
      id: true,
      priceTryCents: true,
      discountTryCents: true,
      discountEndAt: true,
      store: true,
      priceUsdCents: true,
      discountUsdCents: true,
    },
  });
  createdGameIds.push(game.id);

  return { id: game.id, valueAznCents: Math.round(computeDisplayPrice(game, settings).finalAzn * 100) };
}

async function main() {
  console.log("\n🎲 Qutu açılışı — drenaj testi\n");

  // ── Fikstürlər: 3–10 AZN aralığında sintetik oyunlar ───────────────────────
  const tiers = await Promise.all([3, 3.5, 4, 4.5, 5, 6, 7, 8, 9, 10].map((azn, i) => createPricedGame(azn, i)));
  console.log(`  Sintetik oyunlar: ${tiers.map((t) => (t.valueAznCents / 100).toFixed(2)).join(", ")} AZN`);

  // Endirimi 2 gün sonra bitən oyun — qoruma pəncərəsinə (7 gün) düşür.
  const soonExpiring = await createPricedGame(6, 99, new Date(Date.now() + 2 * 24 * 60 * 60 * 1000));

  // ── 1. Büdcəyə sığmayan konfiqurasiyada hovuz yaradılmır ───────────────────
  // Hədəf marja 90% → büdcə gəlirin cəmi 10%-i; heç bir oyun bu qədər ucuz deyil.
  const box = await prisma.lootBox.create({
    data: {
      slug: BOX_SLUG,
      title: "Drenaj test qutusu",
      priceAznCents: PRICE_CENTS,
      targetMarginPct: 90,
      minPrizePct: 60,
      maxPrizePct: 200,
      poolSize: POOL_SIZE,
      sellBackPct: 70,
      refillAtRemaining: 0, // avtomatik doldurma söndürülüb — drenajı ölçə bilək
      candidateStore: TEST_STORE, // yalnız sintetik oyunlar seçilsin
      discountGuardDays: 7,
      // Drenaj testi TƏK istifadəçi ilə bütün hovuzu boşaldır; təkrar hədiyyə
      // qadağası bunu mümkünsüz edərdi (10 fərqli oyundan sonra dayanardı).
      // Qadağanın özü aşağıda ayrıca ssenaridə yoxlanılır.
      uniquePrizePerUser: false,
      isActive: true,
    },
  });
  boxId = box.id;

  let refused = false;
  let refusalMessage = "";
  try {
    await generatePool({ lootBoxId: box.id });
  } catch (err) {
    refused = err instanceof LootBoxError && err.code === "BUDGET_VIOLATION";
    refusalMessage = (err as Error).message;
  }
  check("büdcəyə sığmayan konfiqurasiyada hovuz YARADILMIR", () => {
    assert.equal(refused, true, `gözlənilən BUDGET_VIOLATION, alınan: ${refusalMessage}`);
  });
  const poolsAfterRefusal = await prisma.lootBoxPool.count({ where: { lootBoxId: box.id } });
  check("rədd ediləndən sonra hovuz sətri qalmır", () => {
    assert.equal(poolsAfterRefusal, 0);
  });

  // ── 2. Realistik marja ilə sistem oyunları özü seçir ───────────────────────
  const workingBox = await prisma.lootBox.update({
    where: { id: box.id },
    data: { targetMarginPct: TARGET_MARGIN },
  });

  const candidates = await findCandidates(workingBox);
  check("endirimi tezliklə bitən oyun namizədlərə DÜŞMÜR", () => {
    assert.equal(
      candidates.some((c) => c.gameId === soonExpiring.id),
      false,
      "endirimi 2 gün sonra bitən oyun 7 günlük qoruma pəncərəsində kənarda qalmalıydı"
    );
  });
  check("namizədlər yalnız sintetik oyunlardır (kataloq qarışmır)", () => {
    assert.ok(candidates.length > 0, "namizəd tapılmadı");
    const known = new Set(createdGameIds);
    assert.ok(candidates.every((c) => known.has(c.gameId)), "kənar oyun namizədlərə düşüb");
  });

  const recipe = await buildAutoRecipe(workingBox);
  console.log(
    `  Avtomatik resept: ${recipe.specs.length} oyun, ${recipe.economics.ticketTotal} bilet, ` +
      `maya ${(recipe.economics.totalCostCents / 100).toFixed(2)} / büdcə ${(recipe.economics.budgetCostCents / 100).toFixed(2)} AZN, ` +
      `marja ${recipe.economics.marginPct.toFixed(2)}%`
  );
  check("sistem büdcəyə sığan tam resept qurur", () => {
    assert.equal(recipe.economics.ok, true, [...recipe.economics.violations, ...recipe.notes].join(" | "));
    assert.equal(recipe.economics.ticketTotal, POOL_SIZE);
    assert.ok(recipe.economics.marginPct >= TARGET_MARGIN);
  });

  const { pool } = await generatePool({ lootBoxId: box.id });
  const ticketCount = await prisma.lootBoxTicket.count({ where: { poolId: pool.id } });
  check(`hovuz ${POOL_SIZE} biletlə yaradıldı`, () => {
    assert.equal(ticketCount, POOL_SIZE);
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

  // ── 3. Tam drenaj ──────────────────────────────────────────────────────────
  const drawnTicketIds = new Set<string>();
  let realizedCost = 0;
  for (let i = 0; i < POOL_SIZE; i++) {
    const result = await openLootBox({ userId: user.id, box: workingBox });
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

  // ── 4. Biletlər bitəndə təmiz xəta + balans qorunur ────────────────────────
  await prisma.user.update({ where: { id: user.id }, data: { walletBalance: PRICE_CENTS } });
  let noTickets = false;
  try {
    await openLootBox({ userId: user.id, box: workingBox });
  } catch (err) {
    noTickets = err instanceof LootBoxError && err.code === "NO_TICKETS";
  }
  const afterFailedOpen = await prisma.user.findUnique({ where: { id: user.id }, select: { walletBalance: true } });
  check("biletlər bitəndə NO_TICKETS və balans geri qaytarılır", () => {
    assert.equal(noTickets, true);
    assert.equal(afterFailedOpen?.walletBalance, PRICE_CENTS);
  });

  // ── 5. Balans çatmayanda ───────────────────────────────────────────────────
  await generatePool({ lootBoxId: box.id });
  await prisma.user.update({ where: { id: user.id }, data: { walletBalance: PRICE_CENTS - 1 } });
  let insufficient = false;
  try {
    await openLootBox({ userId: user.id, box: workingBox });
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

  // ── 6. Geri satma + ikiqat seçim qorunması ─────────────────────────────────
  await prisma.user.update({ where: { id: user.id }, data: { walletBalance: PRICE_CENTS } });
  const opened = await openLootBox({ userId: user.id, box: workingBox });
  const balanceBeforeSell =
    (await prisma.user.findUnique({ where: { id: user.id }, select: { walletBalance: true } }))?.walletBalance ?? 0;

  const sold = await resolveOpeningChoice({ openingId: opened.openingId, userId: user.id, choice: "SELL_BACK" });
  const expectedCredit = sellBackAmountCents(opened.prize.valueAznCents, workingBox.sellBackPct);

  check("geri satma cüzdana düzgün kredit yazır", () => {
    assert.equal(sold.outcome, "SOLD_BACK");
    assert.equal(sold.sellBackCents, expectedCredit);
    assert.equal(sold.walletBalanceAfter, balanceBeforeSell + expectedCredit);
  });

  let alreadyResolved = false;
  try {
    await resolveOpeningChoice({ openingId: opened.openingId, userId: user.id, choice: "GAME" });
  } catch (err) {
    alreadyResolved = err instanceof LootBoxError && err.code === "ALREADY_RESOLVED";
  }
  check("eyni açılış üçün ikinci seçim bloklanır", () => {
    assert.equal(alreadyResolved, true);
  });

  // ── 7. Təkrar hədiyyə qadağası ─────────────────────────────────────────────
  // Qadağanı açıb yeni istifadəçi ilə hovuzu boşaldırıq: hər açılış FƏRQLİ
  // oyun verməli, uyğun oyun bitəndə isə NO_NEW_PRIZES gəlməlidir.
  const uniqueBox = await prisma.lootBox.update({
    where: { id: box.id },
    data: { uniquePrizePerUser: true },
  });
  await generatePool({ lootBoxId: box.id });

  const distinctGames = await prisma.lootBoxTicket.findMany({
    where: { status: "AVAILABLE", pool: { lootBoxId: box.id, status: "OPEN" } },
    select: { gameId: true },
    distinct: ["gameId"],
  });

  const solo = await prisma.user.create({
    data: {
      email: `${PREFIX}solo_${Date.now()}@example.invalid`,
      name: "Təkrarsız Test",
      passwordHash: "x",
      referralCode: `${PREFIX}s${Date.now()}`.slice(0, 20),
      walletBalance: PRICE_CENTS * (distinctGames.length + 2),
    },
  });
  soloUserId = solo.id;

  const soloWins: string[] = [];
  let noNewPrizes = false;
  for (let i = 0; i < distinctGames.length + 1; i++) {
    try {
      const r = await openLootBox({ userId: solo.id, box: uniqueBox });
      soloWins.push(r.prize.gameId);
    } catch (err) {
      noNewPrizes = err instanceof LootBoxError && err.code === "NO_NEW_PRIZES";
      break;
    }
  }

  check("eyni müştəri eyni oyunu İKİ dəfə qazanmır", () => {
    assert.equal(new Set(soloWins).size, soloWins.length, `təkrar oyun çıxdı: ${soloWins.join(", ")}`);
  });
  check("uyğun oyun bitəndə NO_NEW_PRIZES verilir (bilet hələ qalsa da)", () => {
    assert.equal(soloWins.length, distinctGames.length, `${soloWins.length} / ${distinctGames.length} fərqli oyun`);
    assert.equal(noNewPrizes, true);
  });
  const soloBalance = await prisma.user.findUnique({
    where: { id: solo.id },
    select: { walletBalance: true },
  });
  check("NO_NEW_PRIZES halında pul TUTULMUR", () => {
    // Yalnız uğurlu açılışların pulu getməlidir, uğursuz cəhdin yox.
    assert.equal(
      soloBalance?.walletBalance,
      PRICE_CENTS * (distinctGames.length + 2) - PRICE_CENTS * soloWins.length
    );
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
    for (const uid of [userId, soloUserId].filter((x): x is string => Boolean(x))) {
      await prisma.transaction.deleteMany({ where: { userId: uid } });
      await prisma.user.delete({ where: { id: uid } });
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
