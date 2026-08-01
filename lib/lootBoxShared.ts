/**
 * Qutu açılışı (loot box) — client + server arasında paylaşılan saf riyaziyyat.
 *
 * Burada prisma/pg kimi server-only importlar OLMAMALIDIR: bu modul admin
 * client komponentinə də import olunur və prisma-ya çatan bir zəncir
 * `next build`-i sındırır (tsc keçsə də).
 *
 * ─── Sistemin özəyi ──────────────────────────────────────────────────────────
 * Qutunun mənfəəti təsadüfə buraxılmır. Hər hovuz (bilet dəsti) yaradılmadan
 * ƏVVƏL maya büdcəsinə görə yoxlanır:
 *
 *     Σ bilet.costAznCents  ≤  poolSize × priceAznCents × (1 − targetMarginPct/100)
 *
 * Büdcəni aşan hovuz ümumiyyətlə yaradıla bilmir — nə admin səhvi, nə valyuta
 * kursu dəyişməsi marjanı poza bilər. Hovuz tam bitəndə realizə olunmuş maya
 * planlaşdırılanla hərfən bərabər olur, yəni sıçrayış (variance) sıfırdır.
 *
 * DİQQƏT — marja tərifi: burada `targetMarginPct` GƏLİRƏ görə marjadır
 * (mənfəət / qutu qiyməti). Bu, `Settings.profitMarginGamesPct`-dan FƏRQLİDİR —
 * o, mayanın üstünə əlavə (markup) kimi tətbiq olunur (`lib/pricing.ts`).
 * Qarışıqlıq olmasın deyə burada bütün hesablar mütləq qəpik rəqəmləri ilədir.
 */

import { formatAzn } from "./giveawaysShared";

export { formatAzn };

/** Açılışın nəticəsi: hədiyyə seçimi gözlənir / oyun götürüldü / balansa satıldı. */
export const LOOT_BOX_OUTCOMES = ["PENDING_CHOICE", "CLAIMED_GAME", "SOLD_BACK"] as const;
export type LootBoxOutcome = (typeof LOOT_BOX_OUTCOMES)[number];

export const LOOT_BOX_OUTCOME_LABELS: Record<LootBoxOutcome, string> = {
  PENDING_CHOICE: "Seçim gözlənilir",
  CLAIMED_GAME: "Oyun götürüldü",
  SOLD_BACK: "Balansa satıldı",
};

/** Hovuz statusu. OPEN → biletləri çəkilə bilər; EXHAUSTED → bitib; RETIRED → admin dayandırdı. */
export const LOOT_BOX_POOL_STATUSES = ["OPEN", "EXHAUSTED", "RETIRED"] as const;
export type LootBoxPoolStatus = (typeof LOOT_BOX_POOL_STATUSES)[number];

export const LOOT_BOX_POOL_STATUS_LABELS: Record<LootBoxPoolStatus, string> = {
  OPEN: "Aktiv",
  EXHAUSTED: "Bitmiş",
  RETIRED: "Dayandırılmış",
};

/** Müştərinin hədiyyə ilə bağlı seçimi. */
export const LOOT_BOX_CHOICES = ["GAME", "SELL_BACK"] as const;
export type LootBoxChoice = (typeof LOOT_BOX_CHOICES)[number];

// ─── Konfiqurasiya limitləri ──────────────────────────────────────────────────

export const LOOT_BOX_LIMITS = {
  minPriceCents: 100, // 1 AZN
  maxPriceCents: 100_000, // 1000 AZN
  minPoolSize: 10,
  maxPoolSize: 2000,
  minTargetMarginPct: 0,
  maxTargetMarginPct: 90,
  maxSlugLength: 60,
} as const;

/** Qutunun zəmanət parametrləri — hovuz yoxlaması bunlara görə aparılır. */
export type LootBoxConfig = {
  priceAznCents: number;
  poolSize: number;
  /** Gəlirə görə hədəf marja (mənfəət / qiymət), %. */
  targetMarginPct: number;
  /** Minimum hədiyyə dəyəri, qutu qiymətinin %-i ilə. */
  minPrizePct: number;
  /** Maksimum hədiyyə dəyəri, qutu qiymətinin %-i ilə. */
  maxPrizePct: number;
};

/**
 * Bir hədiyyə sətri. `valueAznCents` müştəriyə göstərilən dəyər,
 * `costAznCents` bizim həqiqi mayamız — ikisi də hovuz yaradılanda dondurulur.
 */
export type LootBoxTicketSpec = {
  gameId: string;
  title: string;
  ticketCount: number;
  valueAznCents: number;
  costAznCents: number;
};

export type PoolEconomics = {
  /** Əlavə edilmiş biletlərin ümumi sayı (poolSize-a bərabər olmalıdır). */
  ticketTotal: number;
  /** Müştəriyə göstərilən dəyərlərin cəmi. */
  totalValueCents: number;
  /** Həqiqi mayaların cəmi. */
  totalCostCents: number;
  /** İcazə verilən maksimum maya. */
  budgetCostCents: number;
  /** Büdcədə qalan boşluq (mənfi olarsa büdcə aşılıb). */
  headroomCents: number;
  /** Hovuz tam satılanda gəlir. */
  revenueCents: number;
  /** Bir açılışa düşən orta hədiyyə dəyəri (qəpik, yuvarlaqlaşdırılmış). */
  evValueCents: number;
  /** Orta hədiyyə dəyərinin qutu qiymətinə nisbəti, %. */
  evValuePctOfPrice: number;
  /** Proqnoz marja (gəlirə görə), %. */
  marginPct: number;
  /** İcazə verilən hədiyyə dəyəri aralığı. */
  minPrizeCents: number;
  maxPrizeCents: number;
  /** Faktiki ən aşağı/yuxarı hədiyyə. */
  lowestPrizeCents: number | null;
  highestPrizeCents: number | null;
  /** Hovuz yaradıla bilərmi. */
  ok: boolean;
  /** İstifadəçiyə göstərilən pozuntu mətnləri (Azərbaycan dilində). */
  violations: string[];
};

/** İcazə verilən minimum hədiyyə dəyəri (qəpik). */
export function minPrizeCentsFor(cfg: Pick<LootBoxConfig, "priceAznCents" | "minPrizePct">): number {
  return Math.round((cfg.priceAznCents * cfg.minPrizePct) / 100);
}

/** İcazə verilən maksimum hədiyyə dəyəri (qəpik). */
export function maxPrizeCentsFor(cfg: Pick<LootBoxConfig, "priceAznCents" | "maxPrizePct">): number {
  return Math.round((cfg.priceAznCents * cfg.maxPrizePct) / 100);
}

/**
 * Hovuzun maya büdcəsi: hovuz tam satılanda çəkə biləcəyimiz maksimum maya.
 *
 * `Math.floor` qəsdəndir — yuvarlaqlaşdırma həmişə bizim xeyrimizə olsun,
 * yəni bir qəpik də hədəf marjadan aşağı düşməyək.
 */
export function poolCostBudgetCents(cfg: Pick<LootBoxConfig, "priceAznCents" | "poolSize" | "targetMarginPct">): number {
  const revenue = cfg.poolSize * cfg.priceAznCents;
  return Math.floor((revenue * (100 - cfg.targetMarginPct)) / 100);
}

/**
 * Hovuzun iqtisadiyyatını hesablayır və zəmanətin pozulub-pozulmadığını qaytarır.
 *
 * Admin UI bunu hər dəyişiklikdə canlı çağırır, server isə hovuz yaradılmadan
 * əvvəl EYNİ funksiya ilə yenidən yoxlayır — UI-a etibar edilmir.
 */
export function computePoolEconomics(tickets: LootBoxTicketSpec[], cfg: LootBoxConfig): PoolEconomics {
  const violations: string[] = [];

  const minPrizeCents = minPrizeCentsFor(cfg);
  const maxPrizeCents = maxPrizeCentsFor(cfg);
  const budgetCostCents = poolCostBudgetCents(cfg);
  const revenueCents = cfg.poolSize * cfg.priceAznCents;

  let ticketTotal = 0;
  let totalValueCents = 0;
  let totalCostCents = 0;
  let lowestPrizeCents: number | null = null;
  let highestPrizeCents: number | null = null;

  const seenGameIds = new Set<string>();
  const tooCheap: string[] = [];
  const tooRich: string[] = [];
  const unknownCost: string[] = [];
  const lossMaking: string[] = [];

  for (const t of tickets) {
    const count = Math.floor(t.ticketCount);
    if (!Number.isFinite(count) || count < 1) {
      violations.push(`"${t.title}" üçün bilet sayı ən azı 1 olmalıdır.`);
      continue;
    }
    if (seenGameIds.has(t.gameId)) {
      violations.push(`"${t.title}" iki dəfə əlavə edilib — hər oyun yalnız bir sətir ola bilər.`);
      continue;
    }
    seenGameIds.add(t.gameId);

    // Maya bilinmirsə hovuz YARADILMAMALIDIR: maya 0 sayılsa hər şey büdcədən
    // keçər və zəmanət mənasız olar. Bu, ən vacib qorunma qaydasıdır.
    if (!Number.isFinite(t.costAznCents) || t.costAznCents <= 0) {
      unknownCost.push(t.title);
      continue;
    }
    if (!Number.isFinite(t.valueAznCents) || t.valueAznCents <= 0) {
      violations.push(`"${t.title}" üçün satış dəyəri hesablana bilmir.`);
      continue;
    }
    // Mayası satış qiymətindən yuxarı olan oyun hovuzda itki mənbəyidir.
    if (t.costAznCents >= t.valueAznCents) {
      lossMaking.push(t.title);
    }

    if (t.valueAznCents < minPrizeCents) tooCheap.push(t.title);
    if (t.valueAznCents > maxPrizeCents) tooRich.push(t.title);

    ticketTotal += count;
    totalValueCents += t.valueAznCents * count;
    totalCostCents += t.costAznCents * count;
    lowestPrizeCents = lowestPrizeCents == null ? t.valueAznCents : Math.min(lowestPrizeCents, t.valueAznCents);
    highestPrizeCents = highestPrizeCents == null ? t.valueAznCents : Math.max(highestPrizeCents, t.valueAznCents);
  }

  if (unknownCost.length > 0) {
    violations.push(
      `Maya dəyəri hesablana bilməyən oyun(lar): ${unknownCost.join(", ")}. Bunlar hovuza qoyula bilməz.`
    );
  }
  if (lossMaking.length > 0) {
    violations.push(`Mayası satış qiymətindən yüksək oyun(lar): ${lossMaking.join(", ")}.`);
  }
  if (tooCheap.length > 0) {
    violations.push(
      `Minimum hədiyyə həddindən (${formatAzn(minPrizeCents)}) aşağı oyun(lar): ${tooCheap.join(", ")}.`
    );
  }
  if (tooRich.length > 0) {
    violations.push(
      `Maksimum hədiyyə həddindən (${formatAzn(maxPrizeCents)}) yuxarı oyun(lar): ${tooRich.join(", ")}.`
    );
  }

  if (ticketTotal === 0) {
    violations.push("Heç bir hədiyyə əlavə edilməyib.");
  } else if (ticketTotal !== cfg.poolSize) {
    violations.push(
      `Bilet sayı ${ticketTotal}-dir, hovuz ölçüsü ${cfg.poolSize} olmalıdır (fərq: ${
        ticketTotal > cfg.poolSize ? "+" : ""
      }${ticketTotal - cfg.poolSize}).`
    );
  }

  const marginPct = revenueCents > 0 ? ((revenueCents - totalCostCents) / revenueCents) * 100 : 0;

  if (ticketTotal > 0 && totalCostCents > budgetCostCents) {
    violations.push(
      `Maya büdcəsi aşılır: ${formatAzn(totalCostCents)} / icazə ${formatAzn(budgetCostCents)}. ` +
        `Proqnoz marja ${marginPct.toFixed(2)}%, hədəf ${cfg.targetMarginPct}%.`
    );
  }

  const evValueCents = ticketTotal > 0 ? Math.round(totalValueCents / ticketTotal) : 0;

  return {
    ticketTotal,
    totalValueCents,
    totalCostCents,
    budgetCostCents,
    headroomCents: budgetCostCents - totalCostCents,
    revenueCents,
    evValueCents,
    evValuePctOfPrice: cfg.priceAznCents > 0 ? (evValueCents / cfg.priceAznCents) * 100 : 0,
    marginPct,
    minPrizeCents,
    maxPrizeCents,
    lowestPrizeCents,
    highestPrizeCents,
    ok: violations.length === 0,
    violations,
  };
}

/** Qutu konfiqurasiyasının özünü yoxlayır (hovuzdan asılı olmayan qaydalar). */
export function validateLootBoxConfig(cfg: {
  slug?: string;
  title?: string;
  priceAznCents?: number;
  poolSize?: number;
  targetMarginPct?: number;
  minPrizePct?: number;
  maxPrizePct?: number;
  sellBackPct?: number;
  refillAtRemaining?: number;
}): string[] {
  const errors: string[] = [];
  const L = LOOT_BOX_LIMITS;

  if (!cfg.title || !cfg.title.trim()) errors.push("Başlıq boş ola bilməz.");
  if (!cfg.slug || !/^[a-z0-9-]+$/.test(cfg.slug)) {
    errors.push("Slug yalnız kiçik hərf, rəqəm və tire (-) ola bilər.");
  } else if (cfg.slug.length > L.maxSlugLength) {
    errors.push(`Slug ${L.maxSlugLength} simvoldan uzun ola bilməz.`);
  }

  const price = cfg.priceAznCents ?? 0;
  if (price < L.minPriceCents || price > L.maxPriceCents) {
    errors.push(`Qiymət ${formatAzn(L.minPriceCents)} – ${formatAzn(L.maxPriceCents)} aralığında olmalıdır.`);
  }

  const pool = cfg.poolSize ?? 0;
  if (pool < L.minPoolSize || pool > L.maxPoolSize) {
    errors.push(`Hovuz ölçüsü ${L.minPoolSize} – ${L.maxPoolSize} arasında olmalıdır.`);
  }

  const margin = cfg.targetMarginPct ?? 0;
  if (!Number.isFinite(margin) || margin < L.minTargetMarginPct || margin > L.maxTargetMarginPct) {
    errors.push(`Hədəf marja ${L.minTargetMarginPct}% – ${L.maxTargetMarginPct}% arasında olmalıdır.`);
  }

  const minPct = cfg.minPrizePct ?? 0;
  const maxPct = cfg.maxPrizePct ?? 0;
  if (minPct < 1 || minPct > 100) errors.push("Minimum hədiyyə faizi 1% – 100% arasında olmalıdır.");
  if (maxPct < 100 || maxPct > 1000) errors.push("Maksimum hədiyyə faizi 100% – 1000% arasında olmalıdır.");
  if (minPct > maxPct) errors.push("Minimum hədiyyə faizi maksimumdan böyük ola bilməz.");

  const sellBack = cfg.sellBackPct ?? 0;
  if (sellBack < 1 || sellBack > 100) errors.push("Geri satma faizi 1% – 100% arasında olmalıdır.");

  const refill = cfg.refillAtRemaining ?? 0;
  if (refill < 0 || refill >= pool) {
    errors.push("Yeni hovuz həddi 0-dan böyük və hovuz ölçüsündən kiçik olmalıdır.");
  }

  return errors;
}

// ─── Ehtimal cədvəli ─────────────────────────────────────────────────────────

export type OddsRow = {
  valueAznCents: number;
  count: number;
  pct: number;
};

/** Публик ehtimal cədvəli — bilet SAYI göstərilmir ki, "bilet sayma" mümkün olmasın. */
export type PublicOddsRow = {
  valueAznCents: number;
  pct: number;
};

/**
 * Biletləri hədiyyə dəyərinə görə qruplaşdırıb ehtimal cədvəli qurur.
 * Ən bahalı hədiyyə birinci — müştəri əvvəlcə cekpotu görsün.
 */
export function buildOddsTable(tickets: Array<{ valueAznCents: number; ticketCount: number }>): OddsRow[] {
  const byValue = new Map<number, number>();
  let total = 0;
  for (const t of tickets) {
    const count = Math.floor(t.ticketCount);
    if (!Number.isFinite(count) || count < 1) continue;
    byValue.set(t.valueAznCents, (byValue.get(t.valueAznCents) ?? 0) + count);
    total += count;
  }
  if (total === 0) return [];

  return Array.from(byValue.entries())
    .map(([valueAznCents, count]) => ({ valueAznCents, count, pct: (count / total) * 100 }))
    .sort((a, b) => b.valueAznCents - a.valueAznCents);
}

/** Ehtimal cədvəlindən bilet saylarını çıxarır (публик API üçün). */
export function toPublicOdds(rows: OddsRow[]): PublicOddsRow[] {
  return rows.map(({ valueAznCents, pct }) => ({ valueAznCents, pct }));
}

// ─── Hədiyyə səviyyələri (UI rəngləri üçün) ──────────────────────────────────

export const PRIZE_TIERS = ["COMMON", "STANDARD", "RARE", "LEGENDARY"] as const;
export type PrizeTier = (typeof PRIZE_TIERS)[number];

export const PRIZE_TIER_LABELS: Record<PrizeTier, string> = {
  COMMON: "Adi",
  STANDARD: "Yaxşı",
  RARE: "Nadir",
  LEGENDARY: "Əfsanəvi",
};

/**
 * Hədiyyənin "nadirlik" səviyyəsi — dəyərin qutu qiymətinə nisbətindən çıxarılır.
 * Yalnız vizual effekt üçündür, çəkiliş məntiqinə təsir etmir.
 */
export function prizeTierFor(valueAznCents: number, priceAznCents: number): PrizeTier {
  if (priceAznCents <= 0) return "STANDARD";
  const ratio = valueAznCents / priceAznCents;
  if (ratio < 0.8) return "COMMON";
  if (ratio < 1.2) return "STANDARD";
  if (ratio < 1.6) return "RARE";
  return "LEGENDARY";
}

// ─── Geri satma ──────────────────────────────────────────────────────────────

/**
 * İstənməyən hədiyyənin balansa satış məbləği.
 *
 * Qeyd: geri satma marjaya HƏMİŞƏ xeyirlidir. Oyunu təhvil vermək bizə
 * dəyərin ~81%-inə başa gəlir; 70% kredit vermək isə 70% — yəni müştəri geri
 * satdıqca marja artır və admin əl işi azalır.
 */
export function sellBackAmountCents(valueAznCents: number, sellBackPct: number): number {
  if (valueAznCents <= 0 || sellBackPct <= 0) return 0;
  return Math.round((valueAznCents * sellBackPct) / 100);
}

/** Sifariş kodu formatı: "BOX-A1B2C3". */
export function isLootBoxOrderCode(code: string): boolean {
  return /^BOX-[0-9A-F]{6}$/.test(code);
}
