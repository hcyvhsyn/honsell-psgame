import { randomBytes, randomInt } from "crypto";

import { prisma } from "./prisma";
import { getSettings, computeDisplayPrice, computeEpicDisplayPrice, tryCentsToCostAzn } from "./pricing";
import type { PricingSettings } from "./pricing";
import { getFlashDealOverrides, applyFlashDeal } from "./flashDeals";
import {
  computePoolEconomics,
  buildOddsTable,
  toPublicOdds,
  sellBackAmountCents,
  prizeTierFor,
} from "./lootBoxShared";
import type { LootBoxConfig, LootBoxTicketSpec, PoolEconomics, OddsRow, PublicOddsRow } from "./lootBoxShared";

export * from "./lootBoxShared";

/**
 * Qutu açılışı (loot box) — server məntiqi.
 *
 * Zəmanətin qorunma nöqtələri:
 *  1. `generatePool` — hovuz yaradılmadan əvvəl `computePoolEconomics` ilə maya
 *     büdcəsi yoxlanır. Pozulursa hovuz YARADILMIR (admin UI-a etibar edilmir).
 *  2. Bilet dəyəri/mayası hovuz yaradılanda DONDURULUR — sonrakı kurs/endirim
 *     dəyişməsi artıq mövcud hovuzun marjasını poza bilməz.
 *  3. `drawTicket` — biletlər geri qoyulmadan çəkilir, ona görə hovuz bitəndə
 *     realizə olunmuş maya planla hərfən bərabər olur.
 *  4. Çəkiliş `crypto.randomInt` ilədir (lib/giveaways.ts `Math.random()`
 *     işlədir — pul söhbəti olanda bu qəbuledilməzdir).
 */

// ─── Xətalar ──────────────────────────────────────────────────────────────────

export type LootBoxErrorCode =
  | "BOX_NOT_FOUND"
  | "BOX_INACTIVE"
  | "BUDGET_VIOLATION"
  | "NO_TICKETS"
  | "TICKET_CONCURRENT_DRAW"
  | "INSUFFICIENT_BALANCE"
  | "DAILY_LIMIT"
  | "OPENING_NOT_FOUND"
  | "ALREADY_RESOLVED"
  | "NO_PSN_ACCOUNT"
  | "NO_EPIC_ACCOUNT";

export class LootBoxError extends Error {
  code: LootBoxErrorCode;
  violations: string[];

  constructor(code: LootBoxErrorCode, message: string, violations: string[] = []) {
    super(message);
    this.name = "LootBoxError";
    this.code = code;
    this.violations = violations;
  }
}

// ─── Qiymət / maya hesablanması ───────────────────────────────────────────────

/** `computeDisplayPrice`/`tryCentsToCostAzn` üçün lazım olan minimal oyun sətri. */
export type PricedGame = {
  id: string;
  title: string;
  imageUrl: string | null;
  store: string | null;
  priceTryCents: number;
  discountTryCents: number | null;
  discountEndAt: Date | null;
  priceUsdCents: number | null;
  discountUsdCents: number | null;
};

export const PRICED_GAME_SELECT = {
  id: true,
  title: true,
  imageUrl: true,
  store: true,
  priceTryCents: true,
  discountTryCents: true,
  discountEndAt: true,
  priceUsdCents: true,
  discountUsdCents: true,
} as const;

/**
 * Bir oyunun qutu üçün dəyər/maya cütünü qaytarır.
 *
 * `valueAznCents` — müştəriyə göstərilən qiymət (flash-deal override daxil,
 * vitrindəki qiymətlə eyni olsun deyə).
 * `costAznCents`  — bizim həqiqi mayamız. PS oyunlarında effektiv TRY qiymətinin
 * AZN qarşılığı (checkout ilə eyni formula), Epic-də isə pozisiya modelinin
 * hesabladığı `costAzn`.
 */
export function resolveTicketEconomics(
  game: PricedGame,
  settings: PricingSettings,
  flashOverride?: Parameters<typeof applyFlashDeal>[1]
): { valueAznCents: number; costAznCents: number } {
  const price = applyFlashDeal(computeDisplayPrice(game, settings), flashOverride);
  const valueAznCents = Math.round(price.finalAzn * 100);

  let costAzn: number;
  if (game.store === "EPIC") {
    costAzn = computeEpicDisplayPrice(game, settings).costAzn;
  } else {
    // Checkout ilə eyni: endirim yalnız kataloq qiymətindən aşağı olduqda sayılır.
    const tryForCost =
      game.discountTryCents != null && game.discountTryCents < game.priceTryCents
        ? game.discountTryCents
        : game.priceTryCents;
    costAzn = tryCentsToCostAzn(tryForCost, settings);
  }

  return { valueAznCents, costAznCents: Math.round(costAzn * 100) };
}

// ─── Konfiqurasiya ────────────────────────────────────────────────────────────

export type LootBoxRow = {
  id: string;
  slug: string;
  title: string;
  priceAznCents: number;
  targetMarginPct: number;
  minPrizePct: number;
  maxPrizePct: number;
  poolSize: number;
  sellBackPct: number;
  refillAtRemaining: number;
  dailyLimitPerUser: number;
  isActive: boolean;
};

export function lootBoxConfigOf(box: LootBoxRow): LootBoxConfig {
  return {
    priceAznCents: box.priceAznCents,
    poolSize: box.poolSize,
    targetMarginPct: box.targetMarginPct,
    minPrizePct: box.minPrizePct,
    maxPrizePct: box.maxPrizePct,
  };
}

// ─── Resept (template) → canlı bilet spesifikasiyaları ────────────────────────

export type TemplateSpec = LootBoxTicketSpec & {
  templateId: string;
  imageUrl: string | null;
  store: string | null;
  /** Oyun kataloqdan silinib/deaktiv olubsa doldurulur. */
  missing?: boolean;
};

/**
 * Qutunun aktiv reseptini CANLI qiymətlərlə oxuyur. Admin UI proqnoz üçün,
 * `generatePool` isə hovuz yaratmaq üçün bunu çağırır.
 */
export async function resolveTemplateSpecs(lootBoxId: string): Promise<TemplateSpec[]> {
  const templates = await prisma.lootBoxTemplate.findMany({
    where: { lootBoxId, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (templates.length === 0) return [];

  const gameIds = templates.map((t) => t.gameId);
  const [settings, games, flash] = await Promise.all([
    getSettings(),
    prisma.game.findMany({ where: { id: { in: gameIds } }, select: PRICED_GAME_SELECT }),
    getFlashDealOverrides(gameIds),
  ]);

  const byId = new Map(games.map((g) => [g.id, g as PricedGame]));

  return templates.map((t) => {
    const game = byId.get(t.gameId);
    if (!game) {
      return {
        templateId: t.id,
        gameId: t.gameId,
        title: "(silinmiş oyun)",
        imageUrl: null,
        store: null,
        ticketCount: t.ticketCount,
        valueAznCents: 0,
        costAznCents: 0,
        missing: true,
      };
    }
    const econ = resolveTicketEconomics(game, settings, flash.get(game.id));
    return {
      templateId: t.id,
      gameId: game.id,
      title: game.title,
      imageUrl: game.imageUrl,
      store: game.store,
      ticketCount: t.ticketCount,
      valueAznCents: econ.valueAznCents,
      costAznCents: econ.costAznCents,
    };
  });
}

/** Reseptin cari iqtisadiyyatı — admin panelindəki canlı kalkulyator üçün. */
export async function previewPoolEconomics(
  box: LootBoxRow
): Promise<{ specs: TemplateSpec[]; economics: PoolEconomics }> {
  const specs = await resolveTemplateSpecs(box.id);
  return { specs, economics: computePoolEconomics(specs, lootBoxConfigOf(box)) };
}

// ─── Hovuz yaratma ────────────────────────────────────────────────────────────

/**
 * Yeni bilet hovuzu yaradır. Maya büdcəsi pozulubsa `LootBoxError`
 * ("BUDGET_VIOLATION") atır və HEÇ NƏ yaratmır — bu, sistemin əsas qorunmasıdır.
 */
export async function generatePool(opts: { lootBoxId: string; adminId?: string | null }) {
  const box = await prisma.lootBox.findUnique({ where: { id: opts.lootBoxId } });
  if (!box) throw new LootBoxError("BOX_NOT_FOUND", "Qutu tapılmadı.");

  const specs = await resolveTemplateSpecs(box.id);
  const economics = computePoolEconomics(specs, lootBoxConfigOf(box));
  if (!economics.ok) {
    throw new LootBoxError(
      "BUDGET_VIOLATION",
      economics.violations.join(" ") || "Hovuz yaradıla bilməz.",
      economics.violations
    );
  }

  // Biletləri düz sıra ilə yaradırıq — qarışdırmağa ehtiyac yoxdur, çünki
  // çəkiliş vaxtı təsadüfi bilet seçilir (drawTicket).
  const ticketRows: Array<{
    slot: number;
    gameId: string;
    titleSnap: string;
    imageSnap: string | null;
    store: string | null;
    valueAznCents: number;
    costAznCents: number;
  }> = [];
  let slot = 0;
  for (const s of specs) {
    for (let i = 0; i < s.ticketCount; i++) {
      ticketRows.push({
        slot: slot++,
        gameId: s.gameId,
        titleSnap: s.title,
        imageSnap: s.imageUrl,
        store: s.store,
        valueAznCents: s.valueAznCents,
        costAznCents: s.costAznCents,
      });
    }
  }

  return prisma.$transaction(async (tx) => {
    const last = await tx.lootBoxPool.findFirst({
      where: { lootBoxId: box.id },
      orderBy: { seq: "desc" },
      select: { seq: true },
    });
    const pool = await tx.lootBoxPool.create({
      data: {
        lootBoxId: box.id,
        seq: (last?.seq ?? 0) + 1,
        status: "OPEN",
        totalTickets: economics.ticketTotal,
        plannedCostCents: economics.totalCostCents,
        plannedValueCents: economics.totalValueCents,
        budgetCostCents: economics.budgetCostCents,
        createdById: opts.adminId ?? null,
      },
    });
    await tx.lootBoxTicket.createMany({
      data: ticketRows.map((t) => ({ ...t, poolId: pool.id })),
    });
    return { pool, economics };
  });
}

/** Qalan bilet sayı həddin altına düşübsə avtomatik yeni hovuz yaradır. */
export async function maybeRefillPool(box: LootBoxRow): Promise<boolean> {
  if (box.refillAtRemaining <= 0) return false;

  const remaining = await prisma.lootBoxTicket.count({
    where: { status: "AVAILABLE", pool: { lootBoxId: box.id, status: "OPEN" } },
  });
  if (remaining > box.refillAtRemaining) return false;

  try {
    await generatePool({ lootBoxId: box.id, adminId: null });
    return true;
  } catch (err) {
    // Resept büdcəni pozursa avtomatik doldurma dayanır — açılışı bloklamırıq,
    // mövcud biletlər bitənə qədər işləyir, admin panelində xəbərdarlıq görünür.
    console.error("loot box auto-refill failed", box.slug, err);
    return false;
  }
}

/** Biletləri bitmiş OPEN hovuzları EXHAUSTED-a keçirir. */
export async function markExhaustedPools(lootBoxId: string): Promise<void> {
  const openPools = await prisma.lootBoxPool.findMany({
    where: { lootBoxId, status: "OPEN" },
    select: { id: true },
  });
  if (openPools.length === 0) return;

  const withAvailable = await prisma.lootBoxTicket.groupBy({
    by: ["poolId"],
    where: { poolId: { in: openPools.map((p) => p.id) }, status: "AVAILABLE" },
    _count: { _all: true },
  });
  const stillOpen = new Set(withAvailable.map((r) => r.poolId));
  const exhausted = openPools.filter((p) => !stillOpen.has(p.id)).map((p) => p.id);

  if (exhausted.length > 0) {
    await prisma.lootBoxPool.updateMany({
      where: { id: { in: exhausted } },
      data: { status: "EXHAUSTED" },
    });
  }
}

// ─── Çəkiliş ──────────────────────────────────────────────────────────────────

type DrawnTicket = {
  id: string;
  poolId: string;
  gameId: string;
  titleSnap: string;
  imageSnap: string | null;
  store: string | null;
  valueAznCents: number;
  costAznCents: number;
};

/** Prisma transaction client-inin bu modul üçün lazım olan hissəsi. */
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Bütün AKTİV hovuzların birləşməsindən təsadüfi bir bilet çəkir və onu
 * DRAWN statusuna keçirir.
 *
 * Niyə birləşmə: bir hovuzu sıra ilə boşaltsaydıq, sonda qalan biletlər
 * proqnozlaşdırıla bilərdi. Bütün açıq hovuzlardan təsadüfi seçəndə hovuzun
 * "sonu" heç vaxt müşahidə edilə bilmir — "bilet sayma" mümkünsüz olur.
 */
export async function drawTicket(tx: TxClient, lootBoxId: string): Promise<DrawnTicket> {
  const where = { status: "AVAILABLE", pool: { lootBoxId, status: "OPEN" } } as const;

  const available = await tx.lootBoxTicket.count({ where });
  if (available === 0) {
    throw new LootBoxError("NO_TICKETS", "Bu qutuda hazırda bilet qalmayıb. Bir az sonra yenidən yoxlayın.");
  }

  const [candidate] = await tx.lootBoxTicket.findMany({
    where,
    orderBy: { id: "asc" },
    skip: randomInt(available),
    take: 1,
    select: {
      id: true,
      poolId: true,
      gameId: true,
      titleSnap: true,
      imageSnap: true,
      store: true,
      valueAznCents: true,
      costAznCents: true,
    },
  });
  if (!candidate) {
    throw new LootBoxError("NO_TICKETS", "Bu qutuda hazırda bilet qalmayıb.");
  }

  // Yarış (race) qoruması: yalnız hələ AVAILABLE olan bileti tuta bilirik.
  const claim = await tx.lootBoxTicket.updateMany({
    where: { id: candidate.id, status: "AVAILABLE" },
    data: { status: "DRAWN" },
  });
  if (claim.count !== 1) {
    throw new LootBoxError("TICKET_CONCURRENT_DRAW", "Bilet eyni anda başqa açılışa düşdü, yenidən cəhd edin.");
  }

  return candidate;
}

// ─── Qutunun açılması ─────────────────────────────────────────────────────────

export type OpenResult = {
  openingId: string;
  orderCode: string;
  pricePaidCents: number;
  prize: {
    gameId: string;
    title: string;
    imageUrl: string | null;
    store: string | null;
    valueAznCents: number;
    tier: ReturnType<typeof prizeTierFor>;
  };
  sellBackCents: number;
  walletBalanceAfter: number;
};

/**
 * Qutunu açır: balansı tutur, bilet çəkir, açılış qeydi yaradır.
 *
 * Cashback QƏSDƏN verilmir — qutuda cashback marjanı yeyir.
 */
export async function openLootBox(params: { userId: string; box: LootBoxRow }): Promise<OpenResult> {
  const { userId, box } = params;

  if (!box.isActive) {
    throw new LootBoxError("BOX_INACTIVE", "Bu qutu hazırda satışda deyil.");
  }

  if (box.dailyLimitPerUser > 0) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const todayCount = await prisma.lootBoxOpening.count({
      where: { userId, lootBoxId: box.id, createdAt: { gte: since } },
    });
    if (todayCount >= box.dailyLimitPerUser) {
      throw new LootBoxError(
        "DAILY_LIMIT",
        `Bu qutu üçün günlük limit ${box.dailyLimitPerUser} açılışdır. Sabah yenidən cəhd edin.`
      );
    }
  }

  // Sifariş kodu transaction-dan KƏNARDA hazırlanır (unikallıq yoxlaması öz
  // sorğusunu tələb edir; checkout da belə edir).
  const orderCode = `BOX-${randomBytes(3).toString("hex").toUpperCase()}`;

  const result = await prisma.$transaction(async (tx) => {
    // Şərtli debet: balans yetərli olmasa heç nə dəyişmir. Bu, oxu-sonra-yaz
    // yanaşmasından fərqli olaraq iki dəfə klikləməni də bloklayır.
    const paid = await tx.user.updateMany({
      where: { id: userId, walletBalance: { gte: box.priceAznCents } },
      data: { walletBalance: { decrement: box.priceAznCents } },
    });
    if (paid.count !== 1) {
      throw new LootBoxError("INSUFFICIENT_BALANCE", "Balansınız kifayət etmir.");
    }

    const ticket = await drawTicket(tx, box.id);

    const payment = await tx.transaction.create({
      data: {
        userId,
        type: "LOOT_BOX",
        status: "SUCCESS",
        amountAznCents: -box.priceAznCents,
        savingsAznCents: 0,
        costAznCents: ticket.costAznCents,
        gameId: null,
        metadata: JSON.stringify({
          kind: "LOOT_BOX_OPEN",
          orderCode,
          lootBoxId: box.id,
          lootBoxSlug: box.slug,
          ticketId: ticket.id,
          prizeGameId: ticket.gameId,
          prizeTitle: ticket.titleSnap,
          prizeValueCents: ticket.valueAznCents,
          paymentSource: "wallet",
        }),
      },
    });

    const opening = await tx.lootBoxOpening.create({
      data: {
        lootBoxId: box.id,
        userId,
        poolId: ticket.poolId,
        ticketId: ticket.id,
        orderCode,
        pricePaidCents: box.priceAznCents,
        gameId: ticket.gameId,
        titleSnap: ticket.titleSnap,
        imageSnap: ticket.imageSnap,
        store: ticket.store,
        valueAznCents: ticket.valueAznCents,
        costAznCents: ticket.costAznCents,
        outcome: "PENDING_CHOICE",
        paymentTransactionId: payment.id,
      },
    });

    const wallet = await tx.user.findUnique({ where: { id: userId }, select: { walletBalance: true } });

    return { opening, ticket, walletBalance: wallet?.walletBalance ?? 0 };
  });

  // Hovuz təmizliyi + avtomatik doldurma açılışdan sonra, transaction-dan
  // kənarda edilir ki, açılış sürətli qalsın. Uğursuzluq açılışı pozmur.
  void markExhaustedPools(box.id)
    .then(() => maybeRefillPool(box))
    .catch((err) => console.error("loot box pool maintenance failed", box.slug, err));

  return {
    openingId: result.opening.id,
    orderCode,
    pricePaidCents: box.priceAznCents,
    prize: {
      gameId: result.ticket.gameId,
      title: result.ticket.titleSnap,
      imageUrl: result.ticket.imageSnap,
      store: result.ticket.store,
      valueAznCents: result.ticket.valueAznCents,
      tier: prizeTierFor(result.ticket.valueAznCents, box.priceAznCents),
    },
    sellBackCents: sellBackAmountCents(result.ticket.valueAznCents, box.sellBackPct),
    walletBalanceAfter: result.walletBalance,
  };
}

// ─── Hədiyyə seçimi ───────────────────────────────────────────────────────────

export type ChoiceResult = {
  outcome: "CLAIMED_GAME" | "SOLD_BACK";
  sellBackCents?: number;
  walletBalanceAfter?: number;
  fulfillmentTransactionId?: string;
};

/**
 * Müştərinin hədiyyə seçimini icra edir:
 *   GAME      → adi oyun sifarişi kimi PENDING fulfillment sətri (admin çatdırır)
 *   SELL_BACK → dəyərin `sellBackPct` faizi cüzdana kredit
 */
export async function resolveOpeningChoice(params: {
  openingId: string;
  userId: string;
  choice: "GAME" | "SELL_BACK";
  psnAccountId?: string | null;
  epicAccountId?: string | null;
}): Promise<ChoiceResult> {
  const { openingId, userId, choice } = params;

  const opening = await prisma.lootBoxOpening.findFirst({
    where: { id: openingId, userId },
    include: { lootBox: { select: { sellBackPct: true, slug: true } } },
  });
  if (!opening) {
    throw new LootBoxError("OPENING_NOT_FOUND", "Açılış tapılmadı.");
  }
  if (opening.outcome !== "PENDING_CHOICE") {
    throw new LootBoxError("ALREADY_RESOLVED", "Bu hədiyyə üçün seçim artıq edilib.");
  }

  // Oyun götürülürsə çatdırılma hesabı lazımdır (hədiyyə açma axını ilə eyni).
  let psnAccountId: string | null = null;
  let epicAccountId: string | null = null;

  if (choice === "GAME") {
    if (opening.store === "EPIC") {
      const accounts = await prisma.epicAccount.findMany({ where: { userId } });
      if (accounts.length === 0) {
        throw new LootBoxError("NO_EPIC_ACCOUNT", "Oyunu götürmək üçün Epic hesabı əlavə etməlisiniz.");
      }
      const chosen =
        (params.epicAccountId && accounts.find((a) => a.id === params.epicAccountId)) ||
        accounts.find((a) => a.isDefault) ||
        accounts[0];
      epicAccountId = chosen.id;
    } else {
      const accounts = await prisma.psnAccount.findMany({ where: { userId } });
      if (accounts.length === 0) {
        throw new LootBoxError("NO_PSN_ACCOUNT", "Oyunu götürmək üçün PSN hesabı əlavə etməlisiniz.");
      }
      const chosen =
        (params.psnAccountId && accounts.find((a) => a.id === params.psnAccountId)) ||
        accounts.find((a) => a.isDefault) ||
        accounts[0];
      psnAccountId = chosen.id;
    }
  }

  return prisma.$transaction(async (tx) => {
    // Yarış qoruması: yalnız hələ seçim gözləyən açılışı tuta bilirik.
    const lock = await tx.lootBoxOpening.updateMany({
      where: { id: opening.id, userId, outcome: "PENDING_CHOICE" },
      data: { outcome: choice === "GAME" ? "CLAIMED_GAME" : "SOLD_BACK", chosenAt: new Date() },
    });
    if (lock.count !== 1) {
      throw new LootBoxError("ALREADY_RESOLVED", "Bu hədiyyə üçün seçim artıq edilib.");
    }

    if (choice === "GAME") {
      // Məbləğ 0 və maya 0 — gəlir/maya artıq qutu ödənişində qeyd olunub,
      // burada ikinci dəfə saymaq mənfəət hesabatını pozardı.
      const fulfillment = await tx.transaction.create({
        data: {
          userId,
          type: "PURCHASE",
          status: "PENDING",
          amountAznCents: 0,
          savingsAznCents: 0,
          costAznCents: 0,
          gameId: opening.gameId,
          psnAccountId,
          epicAccountId,
          metadata: JSON.stringify({
            paymentSource: "LOOT_BOX",
            fromCart: false,
            manualDelivery: true,
            fulfillmentStage: "NEW",
            orderCode: opening.orderCode,
            store: opening.store ?? undefined,
            lootBoxOpeningId: opening.id,
            lootBoxSlug: opening.lootBox.slug,
            prizeValueCents: opening.valueAznCents,
          }),
        },
      });

      await tx.lootBoxOpening.update({
        where: { id: opening.id },
        data: { fulfillmentTransactionId: fulfillment.id },
      });

      return { outcome: "CLAIMED_GAME" as const, fulfillmentTransactionId: fulfillment.id };
    }

    const credit = sellBackAmountCents(opening.valueAznCents, opening.lootBox.sellBackPct);
    const user = await tx.user.update({
      where: { id: userId },
      data: { walletBalance: { increment: credit } },
      select: { walletBalance: true },
    });

    const creditTx = await tx.transaction.create({
      data: {
        userId,
        type: "DEPOSIT",
        status: "SUCCESS",
        amountAznCents: credit,
        savingsAznCents: 0,
        costAznCents: 0,
        metadata: JSON.stringify({
          kind: "LOOT_BOX_SELL_BACK",
          orderCode: opening.orderCode,
          lootBoxOpeningId: opening.id,
          lootBoxSlug: opening.lootBox.slug,
          prizeGameId: opening.gameId,
          prizeTitle: opening.titleSnap,
          prizeValueCents: opening.valueAznCents,
          sellBackPct: opening.lootBox.sellBackPct,
        }),
      },
    });

    await tx.lootBoxOpening.update({
      where: { id: opening.id },
      data: { sellBackCents: credit, sellBackTransactionId: creditTx.id },
    });

    return {
      outcome: "SOLD_BACK" as const,
      sellBackCents: credit,
      walletBalanceAfter: user.walletBalance,
    };
  });
}

// ─── Публик məlumat ───────────────────────────────────────────────────────────

/**
 * Ehtimal cədvəli — AKTİV hovuzların TAM tərkibindən (çəkilmiş biletlər daxil).
 *
 * Qəsdən "qalan biletlər" deyil: qalan tərkib açıqlansa müştəri hansı
 * hədiyyələrin hələ hovuzda olduğunu hesablaya bilər. Tam tərkib isə sabitdir
 * və elə həqiqətən çəkiliş apardığımız paylanmadır.
 */
export async function getOdds(lootBoxId: string): Promise<OddsRow[]> {
  const rows = await prisma.lootBoxTicket.groupBy({
    by: ["valueAznCents"],
    where: { pool: { lootBoxId, status: "OPEN" } },
    _count: { _all: true },
  });

  if (rows.length > 0) {
    return buildOddsTable(rows.map((r) => ({ valueAznCents: r.valueAznCents, ticketCount: r._count._all })));
  }

  // Hələ hovuz yaradılmayıbsa reseptin nəzərdə tutduğu paylanmanı göstəririk.
  const specs = await resolveTemplateSpecs(lootBoxId);
  return buildOddsTable(specs);
}

export async function getPublicOdds(lootBoxId: string): Promise<PublicOddsRow[]> {
  return toPublicOdds(await getOdds(lootBoxId));
}

/** Son qazananlar lenti — test hesabları çıxarılır, adlar maskalanır route qatında. */
export async function getRecentWinners(lootBoxId: string, take = 12) {
  const { getTestAccountEmails } = await import("./testAccounts");
  const testEmails = getTestAccountEmails();

  return prisma.lootBoxOpening.findMany({
    where: {
      lootBoxId,
      ...(testEmails.length > 0 ? { user: { email: { notIn: testEmails } } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      titleSnap: true,
      imageSnap: true,
      valueAznCents: true,
      createdAt: true,
      user: { select: { name: true } },
    },
  });
}

// ─── Admin statistikası ───────────────────────────────────────────────────────

export type LootBoxStats = {
  openings: number;
  revenueCents: number;
  /**
   * Realizə olunmuş maya. Geri satılan hədiyyələr TAM nominalla sayılır
   * (konservativ): kredit dəyərin 70%-idir, oyun təhvil vermək ~81% olardı,
   * yəni geri satma marjaya həmişə xeyirlidir.
   */
  realizedCostCents: number;
  profitCents: number;
  marginPct: number;
  awardedValueCents: number;
  pendingChoice: number;
  claimedGame: number;
  soldBack: number;
  remainingTickets: number;
};

export async function getLootBoxStats(lootBoxId: string): Promise<LootBoxStats> {
  const [all, notSold, sold, byOutcome, remainingTickets] = await Promise.all([
    prisma.lootBoxOpening.aggregate({
      where: { lootBoxId },
      _count: { _all: true },
      _sum: { pricePaidCents: true, valueAznCents: true },
    }),
    prisma.lootBoxOpening.aggregate({
      where: { lootBoxId, outcome: { not: "SOLD_BACK" } },
      _sum: { costAznCents: true },
    }),
    prisma.lootBoxOpening.aggregate({
      where: { lootBoxId, outcome: "SOLD_BACK" },
      _sum: { sellBackCents: true },
    }),
    prisma.lootBoxOpening.groupBy({
      by: ["outcome"],
      where: { lootBoxId },
      _count: { _all: true },
    }),
    prisma.lootBoxTicket.count({
      where: { status: "AVAILABLE", pool: { lootBoxId, status: "OPEN" } },
    }),
  ]);

  const revenueCents = all._sum.pricePaidCents ?? 0;
  const realizedCostCents = (notSold._sum.costAznCents ?? 0) + (sold._sum.sellBackCents ?? 0);
  const countFor = (outcome: string) => byOutcome.find((r) => r.outcome === outcome)?._count._all ?? 0;

  return {
    openings: all._count._all,
    revenueCents,
    realizedCostCents,
    profitCents: revenueCents - realizedCostCents,
    marginPct: revenueCents > 0 ? ((revenueCents - realizedCostCents) / revenueCents) * 100 : 0,
    awardedValueCents: all._sum.valueAznCents ?? 0,
    pendingChoice: countFor("PENDING_CHOICE"),
    claimedGame: countFor("CLAIMED_GAME"),
    soldBack: countFor("SOLD_BACK"),
    remainingTickets,
  };
}
