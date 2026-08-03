import { randomBytes, randomInt } from "crypto";

import { prisma } from "./prisma";
import {
  getSettings,
  computeDisplayPrice,
  computeEpicDisplayPrice,
  tryCentsToCostAzn,
  aznToTryCents,
} from "./pricing";
import type { PricingSettings } from "./pricing";
import { getFlashDealOverrides, applyFlashDeal } from "./flashDeals";
import {
  allocateTickets,
  minPrizeCentsFor,
  maxPrizeCentsFor,
  buildOddsTable,
  toPublicOdds,
  sellBackAmountCents,
  prizeTierFor,
} from "./lootBoxShared";
import type {
  LootBoxConfig,
  LootBoxTicketSpec,
  PoolEconomics,
  OddsRow,
  PublicOddsRow,
  CandidateGame,
} from "./lootBoxShared";

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
  | "NO_NEW_PRIZES"
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
  maxSharePct: number;
  maxTicketsPerGame: number;
  discountGuardDays: number;
  candidateStore: string | null;
  uniquePrizePerUser: boolean;
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

export type CandidateRow = CandidateGame & {
  imageUrl: string | null;
  store: string | null;
  /** Endirim bitmə tarixi — "tezliklə bitir" xəbərdarlığı üçün. */
  discountEndAt: string | null;
  /** Adminin ulduz sətri varmı (yoxdursa default 1 ulduz sayılır). */
  starred: boolean;
};

export type RecipeSpec = LootBoxTicketSpec & {
  imageUrl: string | null;
  store: string | null;
  stars: number;
};

/**
 * Kataloqdan bu qutuya uyğun namizəd oyunları tapır.
 *
 * Filtrlər:
 *  • aktiv oyunlar, qiyməti qutunun icazəli aralığında
 *  • endirimi `discountGuardDays` içində bitənlər KƏNARDA qalır — hovuz hələ
 *    satılarkən kataloq qiyməti dəyişsə, biletdə vəd etdiyimiz dəyər köhnəlir
 *    və geri satmada real dəyərdən çox ödəyə bilərik
 *  • `candidateStore` verilibsə yalnız həmin storefront
 *
 * SQL tərəfdə TRY qiymətinə görə kobud süzgəc qoyulur (`aznToTryCents`), sonra
 * dəqiq AZN dəyəri hesablanıb yenidən yoxlanılır — kataloq böyükdür (14k+ oyun),
 * hamısını yaddaşa çəkmək olmaz.
 */
export async function findCandidates(box: LootBoxRow, opts?: { search?: string; take?: number }): Promise<CandidateRow[]> {
  const settings = await getSettings();
  const cfg = lootBoxConfigOf(box);
  const minCents = minPrizeCentsFor(cfg);
  const maxCents = maxPrizeCentsFor(cfg);

  const guardUntil = new Date(Date.now() + Math.max(0, box.discountGuardDays) * 24 * 60 * 60 * 1000);
  const search = opts?.search?.trim();
  /*
    Namizəd sayı hovuz ölçüsü ilə birlikdə böyüməlidir. Sabit 360-da qalsaydı,
    300 biletlik hovuzda "hər bilet fərqli oyun" mümkün olmazdı — seçim çatmazdı.

    4× götürülür, 2× yox: büdcə biletlərin böyük hissəsini aralığın ALT
    yarısından almağa məcbur edir, ona görə ucuz namizədlərin sayı təkbaşına
    hovuz ölçüsündən çox olmalıdır. 2× ilə 200 biletlik 25 AZN qutusu heç
    qurula bilmirdi (ölçüldü: 0 bilet).
  */
  const cap = opts?.take ?? Math.min(2000, Math.max(360, box.poolSize * 4));

  const baseWhere = {
    isActive: true,
    // Qutuya YALNIZ PlayStation Store oyunları düşür. Epic ayrı çatdırılma
    // axını (Epic hesabı) tələb edir və qutu hədiyyəsi kimi satılmır.
    // `candidateStore` yalnız texniki override-dır (drenaj testi öz sintetik
    // oyunlarını kataloqdan təcrid etmək üçün istifadə edir).
    store: box.candidateStore ?? "PS",
    // DLC / addon / valyuta paketi hədiyyə kimi verilmir — müştəri "oyun
    // qazandım" gözləyir, əlində isə əsas oyun olmadan işləməyən DLC qalır.
    productType: "GAME",
    ...(search ? { title: { contains: search, mode: "insensitive" as const } } : {}),
    /**
     * ENDİRİMLİ oyun hovuza yalnız bitmə tarixi MƏLUM və qoruma pəncərəsindən
     * uzaq olduqda düşür. Endirimsiz oyunlar həmişə qəbul olunur.
     *
     * Niyə `discountEndAt = null` qəbul edilmir:
     * PS Store endirimin bitmə tarixini çox vaxt vermir, ona görə skreyper belə
     * sətirləri `discountEndAt = null` ilə yazır (app/api/scrape-ps-store).
     * Orada təmizləmə mərhələsi var — hər geniş skreypdən sonra o skreyplə
     * təsdiqlənməyən endirimlər silinir — yəni TƏZƏ skreypdən sonra belə
     * endirim canlıdır. LAKİN bilet mayası hovuz yaradılanda DONDURULUR və
     * hovuz həftələr yaşayır: bitmə tarixi bilinmirsə endirimin sabah
     * bitməyəcəyinə zəmanət yoxdur. Endirim bitəndən sonra oyunu kataloq
     * qiymətinə alırıq, maya isə aşağı dondurulmuş qalır → marja səssizcə
     * pozulur.
     *
     * Qərar: təhlükəsiz tərəf seçilir. Bu, kataloqun ~11%-ini (endirimli
     * oyunları) hovuzdan kənarda saxlayır; qalan minlərlə oyun kifayət edir.
     * Kommersiya baxımından endirimli oyunları da daxil etmək istəsəniz, bu
     * şərti `{ discountTryCents: null }` → `{}` etmək kifayətdir, amma yuxarıdaki
     * risk qəbul edilmiş olur.
     */
    OR: [{ discountTryCents: null }, { discountEndAt: { gt: guardUntil } }],
  };

  /** AZN həddini TRY-kuruş həddinə çevirir (sərhədlər inklüziv qalsın deyə). */
  const tryBound = (cents: number, mode: "floor" | "ceil") =>
    Math.max(0, aznToTryCents(cents / 100, settings, mode));

  const select = { ...PRICED_GAME_SELECT, title: true } as const;

  /**
   * Namizədləri qiymət ZOLAQLARINA bölüb hər zolaqdan ayrıca götürürük.
   *
   * Niyə: tək sorğuda `orderBy: priceTryCents asc` + `take` yalnız ƏN UCUZ
   * oyunları qaytarır. Kataloqda minlərlə uyğun oyun olanda bahalı pillələr
   * heç vaxt seçimə düşmür — nəticədə ya "uyğun oyun tapılmadı" xətası çıxır
   * (bütün nümunə minimum həddin altında qalanda), ya da hovuz yalnız ən ucuz
   * hədiyyələrdən qurulur. Zolaqlı seçim bütün qiymət spektrini təmsil edir.
   */
  const BANDS = 6;
  const perBand = Math.max(10, Math.ceil(cap / BANDS));
  const bandStep = (maxCents - minCents) / BANDS;

  const collected = new Map<string, PricedGame>();

  if (search || bandStep <= 0) {
    // Axtarış rejimində zolaqlamanın mənası yoxdur — admin konkret oyun axtarır.
    const rows = await prisma.game.findMany({
      where: { ...baseWhere, priceTryCents: { gte: tryBound(minCents, "floor"), lte: tryBound(maxCents, "ceil") } },
      select,
      take: cap,
    });
    for (const r of rows) collected.set(r.id, r);
  } else {
    /*
      Zolaq daxilində HƏM ucuzdan, HƏM bahadan götürürük.
      Əvvəl yalnız `desc` idi — hər zolaq öz yuxarı kənarına yığılırdı, yəni
      faktiki namizəd qiyməti bir zolaq boyu yuxarı sürüşürdü. Nəticədə büdcənin
      tələb etdiyi ucuz oyunlar seçimə düşmürdü və böyük hovuzlar qurula
      bilmirdi. İki istiqamət zolağın hər iki ucunu təmsil edir.
    */
    const half = Math.max(5, Math.ceil(perBand / 2));
    const bands = await Promise.all(
      Array.from({ length: BANDS }, (_, i) => {
        const lo = minCents + bandStep * i;
        const hi = i === BANDS - 1 ? maxCents : minCents + bandStep * (i + 1);
        const where = {
          ...baseWhere,
          priceTryCents: { gte: tryBound(lo, "floor"), lte: tryBound(hi, "ceil") },
        };
        return Promise.all([
          prisma.game.findMany({ where, select, orderBy: { priceTryCents: "asc" as const }, take: half }),
          prisma.game.findMany({ where, select, orderBy: { priceTryCents: "desc" as const }, take: half }),
        ]);
      })
    );
    for (const pair of bands) for (const rows of pair) for (const r of rows) collected.set(r.id, r);
  }

  const games = Array.from(collected.values());

  if (games.length === 0) return [];

  const ids = games.map((g) => g.id);
  const [flash, stars] = await Promise.all([
    getFlashDealOverrides(ids),
    prisma.lootBoxTemplate.findMany({
      where: { lootBoxId: box.id, gameId: { in: ids }, isActive: true },
      select: { gameId: true, stars: true },
    }),
  ]);
  const starsByGame = new Map(stars.map((s) => [s.gameId, s.stars]));

  return games
    .map((g) => {
      const econ = resolveTicketEconomics(g as PricedGame, settings, flash.get(g.id));
      return {
        gameId: g.id,
        title: g.title,
        imageUrl: g.imageUrl,
        store: g.store,
        discountEndAt: g.discountEndAt ? g.discountEndAt.toISOString() : null,
        valueAznCents: econ.valueAznCents,
        costAznCents: econ.costAznCents,
        stars: starsByGame.get(g.id) ?? 1,
        starred: starsByGame.has(g.id),
      };
    })
    // QEYD: 0 ulduzlu (qadağan) oyunlar BURADA süzülmür — admin namizəd
    // siyahısında onları görüb qadağanı geri götürə bilməlidir. Hovuza
    // düşməmələri `buildAutoRecipe`-də təmin olunur.
    .filter((c) => c.valueAznCents >= minCents && c.valueAznCents <= maxCents && c.costAznCents > 0);
}

/**
 * Bu qutu üçün avtomatik resept qurur: namizədləri tapır və `allocateTickets`
 * ilə büdcəyə sığan bilet paylanmasını hesablayır.
 */
export async function buildAutoRecipe(box: LootBoxRow): Promise<{
  specs: RecipeSpec[];
  economics: PoolEconomics;
  candidateCount: number;
  notes: string[];
}> {
  const all = await findCandidates(box);
  // 0 ulduz = admin qadağan edib. Kataloqda avtomatik ayırd edilə bilməyən
  // keyfiyyətsiz başlıqlar var; bu, onları hovuzdan kənarda saxlayan süzgəcdir.
  const candidates = all.filter((c) => c.stars > 0);
  const allocation = allocateTickets(candidates, lootBoxConfigOf(box), {
    maxSharePct: box.maxSharePct,
    maxTicketsPerGame: box.maxTicketsPerGame,
  });

  const meta = new Map(candidates.map((c) => [c.gameId, c]));
  const specs: RecipeSpec[] = allocation.tickets.map((t) => {
    const c = meta.get(t.gameId);
    return {
      ...t,
      imageUrl: c?.imageUrl ?? null,
      store: c?.store ?? null,
      stars: c?.stars ?? 1,
    };
  });

  return {
    specs,
    economics: allocation.economics,
    candidateCount: candidates.length,
    notes:
      all.length > candidates.length
        ? [...allocation.notes, `${all.length - candidates.length} oyun admin tərəfindən qadağan edilib (🚫).`]
        : allocation.notes,
  };
}

/** Admin panelindəki canlı kalkulyator üçün proqnoz. */
export async function previewPoolEconomics(box: LootBoxRow) {
  return buildAutoRecipe(box);
}

/**
 * Aktiv hovuzdaki biletlərin DONDURULMUŞ dəyəri ilə kataloqun CARİ qiyməti
 * arasındakı fərqi tapır.
 *
 * Mövcud hovuzun marjası təhlükədə deyil (maya da dondurulub), amma:
 *  • kataloqda ucuzlaşan oyun üçün biletdə vəd etdiyimiz dəyər şişik qalır və
 *    geri satmada real dəyərdən çox ödəyirik;
 *  • bahalaşan oyun növbəti hovuzun büdcədən keçməməsinə səbəb ola bilər.
 * Hər ikisi admin panelində xəbərdarlıq kimi göstərilir.
 */
export async function detectPriceDrift(box: LootBoxRow, thresholdPct = 10) {
  const tickets = await prisma.lootBoxTicket.groupBy({
    by: ["gameId", "titleSnap", "valueAznCents", "costAznCents"],
    where: { status: "AVAILABLE", pool: { lootBoxId: box.id, status: "OPEN" } },
    _count: { _all: true },
  });
  if (tickets.length === 0) return [];

  const ids = tickets.map((t) => t.gameId);
  const [settings, games, flash] = await Promise.all([
    getSettings(),
    prisma.game.findMany({ where: { id: { in: ids } }, select: PRICED_GAME_SELECT }),
    getFlashDealOverrides(ids),
  ]);
  const byId = new Map(games.map((g) => [g.id, g as PricedGame]));

  const drifted: Array<{
    gameId: string;
    title: string;
    remainingTickets: number;
    snapValueCents: number;
    liveValueCents: number | null;
    snapCostCents: number;
    liveCostCents: number | null;
    driftPct: number | null;
    missing: boolean;
  }> = [];

  for (const t of tickets) {
    const game = byId.get(t.gameId);
    if (!game) {
      drifted.push({
        gameId: t.gameId,
        title: t.titleSnap,
        remainingTickets: t._count._all,
        snapValueCents: t.valueAznCents,
        liveValueCents: null,
        snapCostCents: t.costAznCents,
        liveCostCents: null,
        driftPct: null,
        missing: true,
      });
      continue;
    }
    const live = resolveTicketEconomics(game, settings, flash.get(game.id));
    const driftPct =
      t.valueAznCents > 0 ? ((live.valueAznCents - t.valueAznCents) / t.valueAznCents) * 100 : 0;
    if (Math.abs(driftPct) >= thresholdPct) {
      drifted.push({
        gameId: t.gameId,
        title: t.titleSnap,
        remainingTickets: t._count._all,
        snapValueCents: t.valueAznCents,
        liveValueCents: live.valueAznCents,
        snapCostCents: t.costAznCents,
        liveCostCents: live.costAznCents,
        driftPct,
        missing: false,
      });
    }
  }

  return drifted.sort((a, b) => Math.abs(b.driftPct ?? 999) - Math.abs(a.driftPct ?? 999));
}

// ─── Hovuz yaratma ────────────────────────────────────────────────────────────

/**
 * Yeni bilet hovuzu yaradır. Maya büdcəsi pozulubsa `LootBoxError`
 * ("BUDGET_VIOLATION") atır və HEÇ NƏ yaratmır — bu, sistemin əsas qorunmasıdır.
 */
export async function generatePool(opts: { lootBoxId: string; adminId?: string | null }) {
  const box = await prisma.lootBox.findUnique({ where: { id: opts.lootBoxId } });
  if (!box) throw new LootBoxError("BOX_NOT_FOUND", "Qutu tapılmadı.");

  const { specs, economics, notes } = await buildAutoRecipe(box);
  void notes;
  // Allokator yalnız təklif verir — son söz burada. Alqoritmdə səhv olsa belə
  // büdcəni aşan hovuz yaradıla bilməz.
  if (!economics.ok) {
    const reasons = [...economics.violations, ...notes];
    throw new LootBoxError(
      "BUDGET_VIOLATION",
      reasons.join(" ") || "Hovuz yaradıla bilməz.",
      reasons
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
    // Uğurlu doldurmadan sonra köhnə xəbərdarlıq təmizlənir.
    await prisma.lootBox
      .update({ where: { id: box.id }, data: { lastRefillError: null, lastRefillErrorAt: null } })
      .catch(() => null);
    return true;
  } catch (err) {
    // Kataloqda uyğun oyun qalmayıbsa (məs. endirimlər bitib mayalar qalxıb)
    // avtomatik doldurma alınmır. Açılışı bloklamırıq — mövcud biletlər bitənə
    // qədər işləyir — amma səbəbi YAZIRIQ ki, qutu səssizcə boşalmasın.
    const reason = err instanceof LootBoxError ? err.message : (err as Error).message;
    console.error("loot box auto-refill failed", box.slug, err);
    await prisma.lootBox
      .update({
        where: { id: box.id },
        data: { lastRefillError: reason.slice(0, 1000), lastRefillErrorAt: new Date() },
      })
      .catch(() => null);
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
export async function drawTicket(
  tx: TxClient,
  lootBoxId: string,
  /** Müştərinin əvvəl qazandığı oyunlar — təkrar hədiyyə verilmir. */
  excludeGameIds: string[] = []
): Promise<DrawnTicket> {
  const where = {
    status: "AVAILABLE",
    pool: { lootBoxId, status: "OPEN" },
    ...(excludeGameIds.length > 0 ? { gameId: { notIn: excludeGameIds } } : {}),
  };

  const available = await tx.lootBoxTicket.count({ where });
  if (available === 0) {
    // Bilet ümumiyyətlə yoxdur, yoxsa yalnız BU müştəri üçün yeni oyun qalmayıb?
    // İki hal fərqli mesaj tələb edir — müştəri nə baş verdiyini anlamalıdır.
    if (excludeGameIds.length > 0) {
      const anyLeft = await tx.lootBoxTicket.count({
        where: { status: "AVAILABLE", pool: { lootBoxId, status: "OPEN" } },
      });
      if (anyLeft > 0) {
        throw new LootBoxError(
          "NO_NEW_PRIZES",
          "Bu qutudaki bütün oyunları artıq qazanmısınız — sizin üçün yeni hədiyyə qalmayıb."
        );
      }
    }
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

  /**
   * Müştərinin bu qutuda əvvəl qazandığı oyunlar — təkrar hədiyyə verilmir.
   *
   * Bütün nəticələr sayılır (seçim gözləyən, oyunu götürən, balansa satan):
   * müştəri o oyunu artıq görmüşdür və təkrarı həyəcan yaratmır.
   */
  let excludeGameIds: string[] = [];
  if (box.uniquePrizePerUser) {
    const won = await prisma.lootBoxOpening.findMany({
      where: { userId, lootBoxId: box.id },
      select: { gameId: true },
      distinct: ["gameId"],
    });
    excludeGameIds = won.map((w) => w.gameId);

    // Balansı tutmadan ƏVVƏL yoxlayırıq: müştəri pul verib "sizin üçün yeni
    // hədiyyə yoxdur" xətası almasın. (Transaction onsuz da geri qaytarardı,
    // amma bu, təmiz mesaj və gərəksiz əməliyyat olmaması deməkdir.)
    if (excludeGameIds.length > 0) {
      const eligible = await prisma.lootBoxTicket.count({
        where: {
          status: "AVAILABLE",
          pool: { lootBoxId: box.id, status: "OPEN" },
          gameId: { notIn: excludeGameIds },
        },
      });
      if (eligible === 0) {
        throw new LootBoxError(
          "NO_NEW_PRIZES",
          "Bu qutudaki bütün oyunları artıq qazanmısınız — sizin üçün yeni hədiyyə qalmayıb."
        );
      }
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

    const ticket = await drawTicket(tx, box.id, excludeGameIds);

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
  /** PSN hesabı yox idi — operator müştəridən məlumatı soruşacaq. */
  needsAccountInfo?: boolean;
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

  /**
   * Çatdırılma hesabı: VARSA bağlanır, yoxdursa açılış BLOKLANMIR.
   *
   * Müştəri qutunu artıq ödəyib — hesabı olmadığı üçün hədiyyəni ala bilməmək
   * qəbuledilməzdir. Oyun sifarişi onsuz da manual çatdırılır (operator
   * `NEW → CONTACTED → ACCOUNT_ACCESS` mərhələləri ilə əlaqə saxlayır), ona
   * görə hesab məlumatını sonra almaq tam mümkündür. Bu halda sifariş
   * metadata-sına `needsAccountInfo` işarəsi qoyulur.
   */
  let psnAccountId: string | null = null;
  let epicAccountId: string | null = null;
  let needsAccountInfo = false;

  if (choice === "GAME") {
    // Qutuya yalnız PS oyunları düşür; EPIC yolu köhnə (dondurulmuş) biletlər
    // üçün ehtiyat kimi saxlanılır.
    if (opening.store === "EPIC") {
      const accounts = await prisma.epicAccount.findMany({ where: { userId } });
      const chosen =
        (params.epicAccountId && accounts.find((a) => a.id === params.epicAccountId)) ||
        accounts.find((a) => a.isDefault) ||
        accounts[0];
      epicAccountId = chosen?.id ?? null;
      needsAccountInfo = chosen == null;
    } else {
      const accounts = await prisma.psnAccount.findMany({ where: { userId } });
      const chosen =
        (params.psnAccountId && accounts.find((a) => a.id === params.psnAccountId)) ||
        accounts.find((a) => a.isDefault) ||
        accounts[0];
      psnAccountId = chosen?.id ?? null;
      needsAccountInfo = chosen == null;
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
            // Operator bunu görüb müştəridən hesab məlumatını istəyir.
            ...(needsAccountInfo ? { needsAccountInfo: true } : {}),
          }),
        },
      });

      await tx.lootBoxOpening.update({
        where: { id: opening.id },
        data: { fulfillmentTransactionId: fulfillment.id },
      });

      return {
        outcome: "CLAIMED_GAME" as const,
        fulfillmentTransactionId: fulfillment.id,
        needsAccountInfo,
      };
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

  // Hələ hovuz yaradılmayıbsa avtomatik reseptin nəzərdə tutduğu paylanmanı
  // göstəririk (yalnız proqnoz — real çəkiliş həmişə hovuzdan gedir).
  const box = await prisma.lootBox.findUnique({ where: { id: lootBoxId } });
  if (!box) return [];
  const { specs } = await buildAutoRecipe(box);
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

export type ShowcasePrize = {
  gameId: string;
  title: string;
  imageUrl: string | null;
  valueAznCents: number;
};

/**
 * Rulet lentini dolduran real nümunə hədiyyələr.
 *
 * Əvvəl lent qutunun öz adı və şəkli ilə doldurulurdu — nəticədə eyni "100 azn
 * qutu" kartı təkrarlanır, şəkillər boş görünürdü. Lentdə real oyunlar olmalıdır.
 *
 * `status` filtri QƏSDƏN yoxdur: yalnız `AVAILABLE` biletlərə baxsaydıq, vitrin
 * hovuz boşaldıqca daralar və müştəri hansı hədiyyələrin qaldığını hesablaya
 * bilərdi. `distinct` yalnız unikal oyun qaytarır — bilet sayı sızmır.
 */
export async function getPrizeShowcase(lootBoxId: string, take = 24): Promise<ShowcasePrize[]> {
  const rows = await prisma.lootBoxTicket.findMany({
    where: { pool: { lootBoxId, status: "OPEN" } },
    distinct: ["gameId"],
    orderBy: { valueAznCents: "desc" },
    take: 150,
    select: { gameId: true, titleSnap: true, imageSnap: true, valueAznCents: true },
  });

  if (rows.length === 0) return [];

  // Bütün dəyər diapazonu təmsil olunsun: sadəcə ilk N-i götürsək lentdə yalnız
  // ən bahalı oyunlar görünər və müştəridə real olmayan gözlənti yaranar.
  const step = Math.max(1, Math.floor(rows.length / take));
  const picked: ShowcasePrize[] = [];
  for (let i = 0; i < rows.length && picked.length < take; i += step) {
    const row = rows[i];
    picked.push({
      gameId: row.gameId,
      title: row.titleSnap,
      imageUrl: row.imageSnap,
      valueAznCents: row.valueAznCents,
    });
  }
  return picked;
}

/**
 * Hovuzdaki BÜTÜN fərqli oyunlar — "nə qazana bilərəm?" siyahısı.
 *
 * Bilet sayı qaytarılmır (o, qalan tərkibi açıqlayardı), yalnız oyunun özü və
 * dəyəri. Ehtimallar onsuz da ayrıca cədvəldə açıq göstərilir, ona görə bu,
 * gizli məlumat açmır — əksinə, müştərinin əsas sualına cavab verir.
 */
export async function getPrizeCatalog(lootBoxId: string): Promise<ShowcasePrize[]> {
  const rows = await prisma.lootBoxTicket.findMany({
    where: { pool: { lootBoxId, status: "OPEN" } },
    distinct: ["gameId"],
    orderBy: { valueAznCents: "desc" },
    select: { gameId: true, titleSnap: true, imageSnap: true, valueAznCents: true },
  });

  return rows.map((r) => ({
    gameId: r.gameId,
    title: r.titleSnap,
    imageUrl: r.imageSnap,
    valueAznCents: r.valueAznCents,
  }));
}

// ─── Admin: kim nə qazandı ────────────────────────────────────────────────────

export type AdminOpeningRow = {
  id: string;
  orderCode: string;
  createdAt: string;
  chosenAt: string | null;
  user: { id: string; name: string | null; email: string; phone: string | null };
  title: string;
  imageUrl: string | null;
  store: string | null;
  pricePaidCents: number;
  valueAznCents: number;
  costAznCents: number;
  outcome: string;
  sellBackCents: number | null;
  /** Bu açılışda bizim faktiki mənfəətimiz (qəpik). */
  profitCents: number;
  fulfillmentTransactionId: string | null;
};

/**
 * Açılışların admin siyahısı: hansı müştəri hansı oyunu, hansı dəyərə qazandı.
 *
 * Sətir başına mənfəət də hesablanır: geri satılan hədiyyə TAM nominalla maya
 * sayılır (konservativ — `getLootBoxStats` ilə eyni qayda), oyun götürüləndə isə
 * biletin dondurulmuş mayası.
 */
export async function getAdminOpenings(params: {
  lootBoxId: string;
  outcome?: string;
  search?: string;
  take?: number;
  skip?: number;
}): Promise<{ rows: AdminOpeningRow[]; total: number }> {
  const search = params.search?.trim();
  const where = {
    lootBoxId: params.lootBoxId,
    ...(params.outcome ? { outcome: params.outcome } : {}),
    ...(search
      ? {
          OR: [
            { titleSnap: { contains: search, mode: "insensitive" as const } },
            { orderCode: { contains: search.toUpperCase() } },
            { user: { name: { contains: search, mode: "insensitive" as const } } },
            { user: { email: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [total, openings] = await Promise.all([
    prisma.lootBoxOpening.count({ where }),
    prisma.lootBoxOpening.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(200, params.take ?? 50),
      skip: params.skip ?? 0,
      select: {
        id: true,
        orderCode: true,
        createdAt: true,
        chosenAt: true,
        titleSnap: true,
        imageSnap: true,
        store: true,
        pricePaidCents: true,
        valueAznCents: true,
        costAznCents: true,
        outcome: true,
        sellBackCents: true,
        fulfillmentTransactionId: true,
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    }),
  ]);

  return {
    total,
    rows: openings.map((o) => {
      const realizedCost = o.outcome === "SOLD_BACK" ? o.sellBackCents ?? 0 : o.costAznCents;
      return {
        id: o.id,
        orderCode: o.orderCode,
        createdAt: o.createdAt.toISOString(),
        chosenAt: o.chosenAt?.toISOString() ?? null,
        user: o.user,
        title: o.titleSnap,
        imageUrl: o.imageSnap,
        store: o.store,
        pricePaidCents: o.pricePaidCents,
        valueAznCents: o.valueAznCents,
        costAznCents: o.costAznCents,
        outcome: o.outcome,
        sellBackCents: o.sellBackCents,
        profitCents: o.pricePaidCents - realizedCost,
        fulfillmentTransactionId: o.fulfillmentTransactionId,
      };
    }),
  };
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
