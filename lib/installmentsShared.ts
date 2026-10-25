/**
 * Taksit (Epoint installment) — client-safe tiplər və riyaziyyat.
 * Server tərəfi (Epoint sorğusu + keş): lib/installments.ts.
 * Komissiya cədvəli: lib/installmentRates.ts.
 */

/** Epoint-in qaytardığı xam kart: hansı aylar açıqdır (faizsiz). */
export type EpointInstallmentCard = {
  /** Epoint `installment_card_id` — ödəniş sorğusuna olduğu kimi ötürülür. */
  id: string;
  /** "BirKart", "TamKart", "BolKart" … */
  name: string;
  /** Mövcud ay seçimləri, artan sırada. */
  months: number[];
};

export type InstallmentOption = {
  months: number;
  /** Epoint-in bu müddət üçün tutduğu komissiya (%) — müştəri qiymətinə yansıdılır. */
  feePct: number;
};

/** Müştəriyə göstərilən kart: yalnız faizi bilinən müddətlər. */
export type InstallmentCard = {
  id: string;
  name: string;
  options: InstallmentOption[];
};

export type InstallmentOffer = {
  /** Merchant səviyyəsində taksit açıqdırmı (env + Epoint açarları). */
  enabled: boolean;
  /** Bundan aşağı məbləğdə taksit göstərilmir. */
  minAzn: number;
  cards: InstallmentCard[];
};

export const INSTALLMENT_DISABLED: InstallmentOffer = { enabled: false, minAzn: 0, cards: [] };

// Bank loqoları (public/bank/) — açar kart adı kiçik hərflə. Loqosu olmayan
// kart (məs. yeni açılan) adı ilə mətn kimi göstərilir. BirKart Birbank-ındır.
const CARD_LOGOS: Record<string, string> = {
  birkart: "/bank/birbank.png",
  tamkart: "/bank/tamkart.png",
  bolkart: "/bank/bolkart.png",
};

export function installmentCardLogo(cardName: string): string | null {
  return CARD_LOGOS[cardName.trim().toLowerCase()] ?? null;
}

/**
 * Taksitlə tutulan məbləğ ("dəqiq örtük"): Epoint komissiyanı müştərinin
 * ödədiyi TAM məbləğdən tutur, ona görə qiymət `base / (1 − faiz)` olur —
 * komissiya çıxılandan sonra mağazaya düz `base` qalır. Sadə `base × (1 + faiz)`
 * 20%-də 4%, 26%-də ~7% itki verərdi. Qəpiyə YUXARI yuvarlaqlaşır.
 */
export function installmentChargeCents(baseCents: number, feePct: number): number {
  if (feePct <= 0) return baseCents;
  return Math.ceil(baseCents / (1 - feePct / 100));
}

/** Müştəri üçün qiymət artımı (%) — 20% komissiya → +25%. Bir onluq dəqiqliklə. */
export function installmentMarkupPct(feePct: number): number {
  if (feePct <= 0) return 0;
  return Math.round((100 / (1 - feePct / 100) - 100) * 10) / 10;
}

/**
 * Aylıq ödəniş — qəpiyə YUXARI yuvarlaqlaşdırılır: "ayda 9.40 ₼" yazıb bankın
 * 9.41 tutması müştəri üçün aldadıcıdır, tərsi isə zərərsizdir.
 */
export function monthlyAzn(totalAzn: number, months: number): number {
  if (months <= 0) return totalAzn;
  return Math.ceil(Math.round(totalAzn * 100) / months) / 100;
}

/** Ən aşağı aylıq ödəniş (komissiya daxil) — məhsul səhifəsindəki "ayda X ₼-dan". */
export function cheapestMonthly(
  baseAzn: number,
  cards: InstallmentCard[],
): { monthlyAzn: number; months: number } | null {
  const baseCents = Math.round(baseAzn * 100);
  let best: { monthlyAzn: number; months: number } | null = null;
  for (const card of cards) {
    for (const o of card.options) {
      const m = monthlyAzn(installmentChargeCents(baseCents, o.feePct) / 100, o.months);
      if (!best || m < best.monthlyAzn) best = { monthlyAzn: m, months: o.months };
    }
  }
  return best;
}

/** Bu məbləğ üçün taksit təklif olunurmu? */
export function installmentAvailable(offer: InstallmentOffer | null, totalAzn: number): boolean {
  return Boolean(offer?.enabled && offer.cards.length > 0 && totalAzn >= offer.minAzn);
}

/**
 * Epoint cavabını təhlükəsiz şəkildə kart siyahısına çevirir.
 *
 * ⚠️ Sənəd massiv göstərir, real API isə indekslə açarlanmış OBYEKT qaytarır:
 * `{"1": {name, installment_card_id: 1, installment_months: [...]}, "trace_id": "…"}`.
 * İkisi də qəbul olunur; kart olmayan dəyərlər (`trace_id`) atılır.
 */
export function parseInstallmentCards(raw: unknown): EpointInstallmentCard[] {
  const rows = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? Object.values(raw as Record<string, unknown>)
      : [];
  const cards: EpointInstallmentCard[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = r.installment_card_id;
    const name = r.name;
    if ((typeof id !== "string" && typeof id !== "number") || typeof name !== "string") continue;
    const months = (Array.isArray(r.installment_months) ? r.installment_months : [])
      .map((m) => Math.floor(Number(m)))
      .filter((m) => Number.isFinite(m) && m > 1);
    if (months.length === 0) continue;
    cards.push({
      id: String(id),
      name: name.trim(),
      months: Array.from(new Set(months)).sort((a, b) => a - b),
    });
  }
  return cards;
}

/**
 * Xam kartları komissiya cədvəli ilə birləşdirir. Faizi bilinməyən müddət
 * atılır (zərərinə satış olmasın); heç bir müddəti qalmayan kart da atılır.
 */
export function withInstallmentFees(
  cards: EpointInstallmentCard[],
  feePct: (cardName: string, months: number) => number | null,
): InstallmentCard[] {
  return cards
    .map((c) => ({
      id: c.id,
      name: c.name,
      options: c.months.flatMap((months) => {
        const pct = feePct(c.name, months);
        return pct == null ? [] : [{ months, feePct: pct }];
      }),
    }))
    .filter((c) => c.options.length > 0);
}
