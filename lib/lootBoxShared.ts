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

// ─── Avtomatik oyun seçimi (allokator) ───────────────────────────────────────
//
// Admin oyunları əl ilə seçmir: sistem kataloqdan qiymət aralığına uyğun
// oyunları özü tapır və bilet paylanmasını hesablayır. Adminin yeganə girişi
// ULDUZDUR (1–5) — ulduz nə qədər çoxdursa, oyun bir o qədər tez-tez çıxır.
//
// DİQQƏT: bu funksiya yalnız TƏKLİF verir. Son yoxlama həmişə
// `computePoolEconomics`-dədir — yəni allokatorda səhv olsa belə büdcəni aşan
// hovuz yaradıla bilməz.

/** Kataloqdan gələn namizəd oyun. */
export type CandidateGame = {
  gameId: string;
  title: string;
  valueAznCents: number;
  costAznCents: number;
  /** Adminin verdiyi ulduz: 1 = adi, 5 = ən tez-tez. */
  stars: number;
};

/** Bir oyunun hovuzda tuta biləcəyi maksimum pay (%) — biri hər şeyi udmasın. */
export const DEFAULT_MAX_SHARE_PCT = 40;

export type AllocationResult = {
  tickets: LootBoxTicketSpec[];
  economics: PoolEconomics;
  /** Namizədlərdən neçəsi hansı səbəbdən kənarda qaldı. */
  excluded: { outOfRange: number; noCost: number; lossMaking: number };
  /** Admin panelində göstərilən izah. */
  notes: string[];
};

/** Namizəd hovuza qoyula bilərmi (dəyər aralığı + maya sağlamlığı). */
function candidateIssue(
  c: CandidateGame,
  minPrizeCents: number,
  maxPrizeCents: number
): "outOfRange" | "noCost" | "lossMaking" | null {
  if (!Number.isFinite(c.costAznCents) || c.costAznCents <= 0) return "noCost";
  if (!Number.isFinite(c.valueAznCents) || c.valueAznCents <= 0) return "noCost";
  if (c.costAznCents >= c.valueAznCents) return "lossMaking";
  if (c.valueAznCents < minPrizeCents || c.valueAznCents > maxPrizeCents) return "outOfRange";
  return null;
}

/**
 * Hədiyyə pillələrinin hovuzdaki hədəf payı (%).
 *
 * Bu olmadan allokator bütün büdcəni eyni səviyyəyə xərcləyirdi: hovuzun ~90%-i
 * bir dəyərdə toplanırdı və müştəri ardıcıl 5 açılışda eyni qiymətli oyun alıb
 * "sistem saxtadır" qənaətinə gəlirdi. Pillələr eyni büdcə ilə DƏYİŞKƏNLİK
 * yaradır — çox vaxt adi, bəzən nadir, nadir hallarda qutu qiymətinin 2 misli.
 *
 * Cəm 100 olmalıdır. Sıralama vacibdir: bahalı pillə əvvəl doldurulur, çünki
 * ucuz pillələr həmişə büdcəyə sığır, əksi isə yox.
 */
export const DEFAULT_PRIZE_SHAPE: Record<PrizeTier, number> = {
  LEGENDARY: 4, // ≥ 1.6× qutu qiyməti — "vay!" anı
  RARE: 11, // 1.2×–1.6×
  STANDARD: 30, // 0.8×–1.2× — pulunu geri qaytaran zona
  COMMON: 55, // < 0.8×
};

/** Faiz payını tam bilet sayına çevirir (ən böyük qalıq üsulu — cəm dəqiq qalır). */
function shapeTargets(poolSize: number, shape: Record<PrizeTier, number>): Record<PrizeTier, number> {
  const order: PrizeTier[] = ["LEGENDARY", "RARE", "STANDARD", "COMMON"];
  const totalPct = order.reduce((s, t) => s + Math.max(0, shape[t]), 0) || 1;
  const raw = order.map((t) => (poolSize * Math.max(0, shape[t])) / totalPct);
  const counts = raw.map((r) => Math.floor(r));
  let left = poolSize - counts.reduce((s, c) => s + c, 0);

  // Qalan biletlər ən böyük kəsr hissəsi olan pillələrə verilir.
  const byRemainder = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of byRemainder) {
    if (left <= 0) break;
    counts[i] += 1;
    left -= 1;
  }

  return {
    LEGENDARY: counts[0],
    RARE: counts[1],
    STANDARD: counts[2],
    COMMON: counts[3],
  };
}

/**
 * Namizədlərdən büdcəyə sığan bilet paylanması qurur.
 *
 * Alqoritm:
 *  1. Hovuz PİLLƏLƏRƏ görə doldurulur (əfsanəvi → adi). Hər pillə üçün hədəf
 *     bilet sayı `DEFAULT_PRIZE_SHAPE`-dən gəlir; pillə dolmasa qalıq növbəti
 *     (daha ucuz) pilləyə keçir.
 *  2. Pillə daxilində "ən ədalətli növbəti bilet" seçilir (Webster/Sainte-Laguë):
 *     `ulduz / (mövcud bilet + 1)` xalı ən yüksək olan oyun. Bərabərlikdə daha
 *     ucuz oyun seçilir ki, büdcə bahalı pillələrə çatsın.
 *  3. Seçim yalnız o halda edilir ki, QALAN biletləri ən ucuz oyunla doldurmaq
 *     hələ də büdcəyə sığsın. Yəni hər addımda hovuzun tamamlana bilməsi
 *     zəmanətlidir — sonda "büdcə çatmadı" vəziyyəti yaranmır.
 *  4. Sonda büdcədə boşluq qalıbsa, biletlər ÖZ PİLLƏSİ DAXİLİNDƏ bahalı
 *     oyunlara yüksəldilir — dəyər artır, amma paylanma forması pozulmur.
 */
export function allocateTickets(
  candidates: CandidateGame[],
  cfg: LootBoxConfig,
  opts?: { maxSharePct?: number; maxTicketsPerGame?: number; shape?: Record<PrizeTier, number> }
): AllocationResult {
  const minPrizeCents = minPrizeCentsFor(cfg);
  const maxPrizeCents = maxPrizeCentsFor(cfg);
  const budget = poolCostBudgetCents(cfg);
  const maxSharePct = opts?.maxSharePct ?? DEFAULT_MAX_SHARE_PCT;
  /*
    Çeşid limiti iki mənbədən gəlir və HƏMİŞƏ daha sərti tətbiq olunur:
      • faiz — "bir oyun hovuzun 40%-dən çoxunu tutmasın" (nisbi qoruma);
      • mütləq — "bir oyundan ən çox N bilet" (birbaşa çeşid idarəsi).
    Faiz böyük hovuzlarda kobuddur: 300 biletin 1%-i hələ 3 biletdir, ona görə
    "hər hədiyyə fərqli oyun olsun" yalnız mütləq limitlə ifadə oluna bilir.
  */
  const absoluteCap = Math.floor(opts?.maxTicketsPerGame ?? 0);
  const percentCap = Math.max(1, Math.ceil((cfg.poolSize * maxSharePct) / 100));
  const maxPerGame =
    absoluteCap > 0 ? Math.max(1, Math.min(percentCap, absoluteCap)) : percentCap;

  const excluded = { outOfRange: 0, noCost: 0, lossMaking: 0 };
  const eligible: CandidateGame[] = [];
  for (const c of candidates) {
    const issue = candidateIssue(c, minPrizeCents, maxPrizeCents);
    if (issue) excluded[issue] += 1;
    else eligible.push({ ...c, stars: Math.max(1, Math.min(5, Math.floor(c.stars) || 1)) });
  }

  const notes: string[] = [];

  if (eligible.length === 0) {
    return {
      tickets: [],
      economics: computePoolEconomics([], cfg),
      excluded,
      notes: [
        `Uyğun oyun tapılmadı. Kataloqda ${formatAzn(minPrizeCents)} – ${formatAzn(
          maxPrizeCents
        )} aralığında oyun olmalıdır.`,
      ],
    };
  }

  // Hovuzun tamamlana bilməsi üçün lazım olan minimum bilet çeşidi.
  const minGamesNeeded = Math.ceil(cfg.poolSize / maxPerGame);
  if (eligible.length < minGamesNeeded) {
    notes.push(
      `Yalnız ${eligible.length} uyğun oyun var; bir oyundan ən çox ${maxPerGame} bilet ola bildiyi üçün ən azı ${minGamesNeeded} oyun lazımdır.`
    );
  }

  // Determinik sıra: ucuzdan bahaya, bərabərlikdə id ilə.
  const sorted = [...eligible].sort(
    (a, b) => a.costAznCents - b.costAznCents || a.gameId.localeCompare(b.gameId)
  );

  const counts = new Map<string, number>(sorted.map((c) => [c.gameId, 0]));
  let spent = 0;
  let placed = 0;

  /**
   * Qalan `need` bileti mümkün olan ƏN UCUZ şəkildə doldurmağın qiyməti.
   *
   * Sadəcə "ən ucuz oyun × qalan bilet" demək OLMAZ: hər oyunun pay limiti
   * (`maxPerGame`) var, ona görə ən ucuz oyun limitə çatanda növbəti ucuza
   * keçmək lazımdır. Bu nəzərə alınmasa proqnoz həddindən optimist olur,
   * allokator erkən çox xərcləyir və hovuzu tamamlaya bilmir.
   *
   * `extra` — bu anda təxmini götürülən biletin oyunu (onun tutumu 1 azalır).
   */
  const cheapestCompletion = (need: number, extra?: CandidateGame): number => {
    if (need <= 0) return 0;
    let left = need;
    let total = 0;
    for (const c of sorted) {
      const used = (counts.get(c.gameId) ?? 0) + (extra && extra.gameId === c.gameId ? 1 : 0);
      const capacity = maxPerGame - used;
      if (capacity <= 0) continue;
      const take = Math.min(capacity, left);
      total += take * c.costAznCents;
      left -= take;
      if (left === 0) return total;
    }
    return Number.POSITIVE_INFINITY; // tutum çatmır
  };

  const tierOf = new Map<string, PrizeTier>(
    sorted.map((c) => [c.gameId, prizeTierFor(c.valueAznCents, cfg.priceAznCents)])
  );

  /** Verilmiş pillədən bir bilet yerləşdirir; mümkün deyilsə `false`. */
  const placeOne = (tier: PrizeTier | null): boolean => {
    const remainingAfter = cfg.poolSize - placed - 1;
    let best: CandidateGame | null = null;
    let bestScore = -Infinity;

    for (const c of sorted) {
      if (tier != null && tierOf.get(c.gameId) !== tier) continue;
      const cur = counts.get(c.gameId) ?? 0;
      if (cur >= maxPerGame) continue;
      // Bu bileti götürsək qalanları ən ucuz yolla doldurmaq hələ mümkündürmü?
      if (spent + c.costAznCents + cheapestCompletion(remainingAfter, c) > budget) continue;

      const score = c.stars / (cur + 1);
      /*
        Bərabər xalda DAHA UCUZ oyun seçilir. Əvvəl daha dəyərlisi seçilirdi və
        bu, büdcəni erkən yeyib bahalı pillələri mümkünsüz edirdi. Dəyər artımı
        indi aşağıdaki "pillə daxilində yüksəltmə" mərhələsinin işidir.
      */
      if (
        score > bestScore ||
        (score === bestScore && best != null && c.costAznCents < best.costAznCents)
      ) {
        bestScore = score;
        best = c;
      }
    }

    if (!best) return false;

    counts.set(best.gameId, (counts.get(best.gameId) ?? 0) + 1);
    spent += best.costAznCents;
    placed += 1;
    return true;
  };

  // ── 1) Pillələr üzrə doldurma: bahalıdan ucuza ──────────────────────────────
  const tierOrder: PrizeTier[] = ["LEGENDARY", "RARE", "STANDARD", "COMMON"];
  const targets = shapeTargets(cfg.poolSize, opts?.shape ?? DEFAULT_PRIZE_SHAPE);
  let carry = 0;

  for (const tier of tierOrder) {
    const want = targets[tier] + carry;
    let filled = 0;
    while (filled < want && placed < cfg.poolSize && placeOne(tier)) filled += 1;
    // Bu pillədə namizəd və ya büdcə çatmadısa qalıq daha ucuz pilləyə keçir.
    carry = want - filled;
  }

  // ── 2) Forma tamamlanmadısa qalan biletləri istənilən pillədən doldur ───────
  while (placed < cfg.poolSize && placeOne(null)) {
    /* boş gövdə — placeOne özü sayğacları artırır */
  }

  if (placed < cfg.poolSize) {
    notes.push(
      `Büdcə ${cfg.poolSize} biletə çatmadı — yalnız ${placed} bilet yerləşdirildi. ` +
        `Daha ucuz oyunlar lazımdır və ya hədəf marjanı azaldın.`
    );
  }

  // ── Boşluğu dəyərə çevir: ucuz bileti bahalı oyuna yüksəlt ───────────────
  // Büdcədə pul qalıbsa müştəriyə göstərilən dəyəri artırırıq. Marja onsuz da
  // büdcə ilə qorunur, ona görə bu, riskə səbəb olmur.
  //
  // MÜHÜM: yüksəltmə yalnız EYNİ PİLLƏ daxilində olur. Sərbəst buraxılsaydı
  // bütün biletlər ən yüksək pilləyə dırmaşar və yuxarıda qurulan paylanma
  // dağılardı — yəni yenə hamı eyni dəyəri qazanardı.
  const byValueDesc = [...eligible].sort(
    (a, b) => b.valueAznCents - a.valueAznCents || a.gameId.localeCompare(b.gameId)
  );
  const byValueAsc = [...byValueDesc].reverse();

  let upgrades = 0;
  const maxUpgrades = cfg.poolSize * 20; // sonsuz dövr qoruması
  let improved = true;

  while (improved && upgrades < maxUpgrades) {
    improved = false;
    for (const receiver of byValueDesc) {
      const rCount = counts.get(receiver.gameId) ?? 0;
      if (rCount >= maxPerGame) continue;

      for (const donor of byValueAsc) {
        if (donor.gameId === receiver.gameId) continue;
        // Pillələr arası köçürmə paylanmanı dağıdır — qadağandır.
        if (tierOf.get(donor.gameId) !== tierOf.get(receiver.gameId)) continue;
        const dCount = counts.get(donor.gameId) ?? 0;
        if (dCount <= 0) continue;
        if (receiver.valueAznCents <= donor.valueAznCents) continue;

        const delta = receiver.costAznCents - donor.costAznCents;
        if (delta <= 0 || spent + delta > budget) continue;

        counts.set(donor.gameId, dCount - 1);
        counts.set(receiver.gameId, rCount + 1);
        spent += delta;
        upgrades += 1;
        improved = true;
        break;
      }
      if (improved) break;
    }
  }

  const tickets: LootBoxTicketSpec[] = sorted
    .map((c) => ({
      gameId: c.gameId,
      title: c.title,
      ticketCount: counts.get(c.gameId) ?? 0,
      valueAznCents: c.valueAznCents,
      costAznCents: c.costAznCents,
    }))
    .filter((t) => t.ticketCount > 0)
    .sort((a, b) => b.valueAznCents - a.valueAznCents);

  if (excluded.outOfRange > 0) {
    notes.push(
      `${excluded.outOfRange} oyun qiymət aralığından kənarda qaldı (${formatAzn(
        minPrizeCents
      )} – ${formatAzn(maxPrizeCents)}).`
    );
  }
  if (excluded.noCost > 0) {
    notes.push(`${excluded.noCost} oyun maya dəyəri hesablanmadığı üçün kənarda qaldı.`);
  }
  if (excluded.lossMaking > 0) {
    notes.push(`${excluded.lossMaking} oyun mayası satış qiymətindən yüksək olduğu üçün kənarda qaldı.`);
  }

  return { tickets, economics: computePoolEconomics(tickets, cfg), excluded, notes };
}

/**
 * "Bu qiymətə daha neçə bilet əlavə edə bilərəm?" sualının cavabı.
 *
 * Admin panelində oyun axtaranda hər nəticənin yanında göstərilir: bu oyundan
 * büdcə neçə biletə imkan verir və hovuzun hamısı bu oyundan olsa ziyan
 * ediləcəkmi.
 */
export function affordabilityFor(
  costAznCents: number,
  cfg: LootBoxConfig
): { maxTickets: number; wholePoolAffordable: boolean; costIfWholePool: number } {
  const budget = poolCostBudgetCents(cfg);
  if (!Number.isFinite(costAznCents) || costAznCents <= 0) {
    return { maxTickets: 0, wholePoolAffordable: false, costIfWholePool: 0 };
  }
  const costIfWholePool = costAznCents * cfg.poolSize;
  return {
    maxTickets: Math.floor(budget / costAznCents),
    wholePoolAffordable: costIfWholePool <= budget,
    costIfWholePool,
  };
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
