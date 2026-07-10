/**
 * Çəkiliş (Giveaway) — client + server arasında paylaşılan saf sabitlər/köməkçilər.
 * Burada prisma/pg kimi server-only importlar OLMAMALIDIR ki, client bundle-a
 * (məs. admin komponenti) təhlükəsiz import oluna bilsin.
 */

/** Qoşulma şərtləri. */
export const ENTRY_CONDITIONS = ["REGISTER_ONLY", "PURCHASE_ANY", "PURCHASE_PRODUCT"] as const;
export type EntryCondition = (typeof ENTRY_CONDITIONS)[number];

export const ENTRY_CONDITION_LABELS: Record<EntryCondition, string> = {
  REGISTER_ONLY: "Sadəcə qeydiyyat",
  PURCHASE_ANY: "Ən azı bir alış",
  PURCHASE_PRODUCT: "Müəyyən məhsul alışı",
};

/** Çəkiliş statusları. */
export const GIVEAWAY_STATUSES = ["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"] as const;
export type GiveawayStatus = (typeof GIVEAWAY_STATUSES)[number];

/**
 * Göstərilən iştirakçı sayı = real qoşulanlar + admin təyin etdiyi boost.
 * Boost yalnız sosial sübut üçündür və qalib çəkilişinə təsir etmir.
 */
export function displayParticipantCount(realCount: number, boost: number): number {
  return Math.max(0, realCount) + Math.max(0, boost);
}

/**
 * Qalib adını ictimai göstəriş üçün maskalayır: "Hüseyn H." → "Hüs****".
 * Ad yoxdursa anonim "İştirakçı".
 */
export function maskWinnerName(name: string | null | undefined): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "İştirakçı";
  const first = trimmed.split(/\s+/)[0];
  if (first.length <= 2) return `${first}***`;
  return `${first.slice(0, 3)}${"*".repeat(Math.min(4, first.length - 3))}`;
}
