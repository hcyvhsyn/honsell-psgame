/**
 * Validasiya növbəsinin qaydaları — SAF (DB-siz), `npm run test:hbomax-queue`.
 *
 * Status: PENDING | VALIDATING | VERIFIED | FAILED | STALE.
 * Növbədən götürülənlər: PENDING, STALE, və vaxtı çatmış təkrar cəhd edilə bilən FAILED.
 *
 * Prioritet (kiçik = təcili):
 *   P0 — vitrinə bağlı başlıq (StreamingTitle) — HƏR səbəbdən, TTL daxil: vitrin
 *        datası təzə qalmalıdır, yoxsa 30 günlük TTL aylarla P4 backlog-un arxasında qalardı
 *   P1 — artıq məlum başlığa yeni gələn epizod
 *   P2 — edit.id / qlobal trek hash-i dəyişdiyi üçün STALE
 *   P3 — təkrar cəhd edilə bilən FAILED
 *   P4 — bağlanmamış başlığın ilkin validasiyası (ilk kəşf backlog-u)
 *   P5 — rutin TTL yenidən validasiyası
 */

export type ValidationStatus = "PENDING" | "VALIDATING" | "VERIFIED" | "FAILED" | "STALE";

export const PRIORITY = {
  LINKED: 0,
  NEW_EPISODE: 1,
  CHANGED: 2,
  RETRY: 3,
  INITIAL_BACKLOG: 4,
  TTL: 5,
} as const;

export type QueueReason = "NEW_EPISODE" | "INITIAL_BACKLOG" | "CHANGED" | "RETRY" | "TTL";

export function priorityFor(reason: QueueReason, titleLinked: boolean): number {
  return titleLinked ? PRIORITY.LINKED : PRIORITY[reason];
}

export interface RegionStateSnapshot {
  status: ValidationStatus;
  validatedEditId: string | null;
  validatedGlobalHash: string | null;
  verifiedAt: Date | null;
  attempts: number;
}

export interface EpisodeFingerprint {
  editId: string | null;
  globalHash: string | null;
}

export interface QueueContext {
  now: Date;
  revalidateAfterDays: number;
  titleLinked: boolean;
  /** Başlıq bu sync-də İLK dəfə kəşf olunub (ilkin backlog, P4). */
  titleIsNew: boolean;
}

export type QueueDecision =
  | { action: "create"; status: "PENDING"; priority: number; reason: QueueReason }
  | { action: "update"; status: "STALE"; priority: number; reason: QueueReason }
  | { action: "keep" };

/** Validasiya olunmuş barmaq izi hazırkı metadata ilə eynidirmi? */
export function fingerprintMatches(state: Pick<RegionStateSnapshot, "validatedEditId" | "validatedGlobalHash">, fp: EpisodeFingerprint): boolean {
  return state.validatedEditId === fp.editId && state.validatedGlobalHash === fp.globalHash;
}

export function isTtlExpired(verifiedAt: Date | null, now: Date, days: number): boolean {
  return !!verifiedAt && now.getTime() - verifiedAt.getTime() >= days * 86_400_000;
}

/**
 * catalog-sync hər epizod üçün çağırır. VALIDATING-ə toxunmur (işçi prosesin işidir).
 * FAILED-in təkrar cəhd vaxtı `nextAttemptAt` ilə idarə olunur; burada yalnız
 * barmaq izi dəyişibsə STALE-ə keçir (yeni metadata = yeni şans).
 */
export function decideQueueAction(state: RegionStateSnapshot | null, fp: EpisodeFingerprint, ctx: QueueContext): QueueDecision {
  if (!state) {
    const reason: QueueReason = ctx.titleIsNew ? "INITIAL_BACKLOG" : "NEW_EPISODE";
    return { action: "create", status: "PENDING", priority: priorityFor(reason, ctx.titleLinked), reason };
  }
  if (state.status === "VALIDATING" || state.status === "PENDING" || state.status === "STALE") return { action: "keep" };

  const verifiedBefore = state.validatedEditId !== null || state.validatedGlobalHash !== null;
  if (verifiedBefore && !fingerprintMatches(state, fp)) {
    return { action: "update", status: "STALE", priority: priorityFor("CHANGED", ctx.titleLinked), reason: "CHANGED" };
  }
  if (state.status === "VERIFIED" && isTtlExpired(state.verifiedAt, ctx.now, ctx.revalidateAfterDays)) {
    return { action: "update", status: "STALE", priority: priorityFor("TTL", ctx.titleLinked), reason: "TTL" };
  }
  return { action: "keep" };
}

/** Uğursuz cəhddən sonra: təkrar vaxtı və ya terminal FAILED. Backoff: base × 6^(n-1), 24 saat tavan. */
export function nextAttemptAfterFailure(attempts: number, maxAttempts: number, now: Date, baseMs: number): Date | null {
  if (attempts >= maxAttempts) return null;
  const delay = Math.min(baseMs * 6 ** Math.max(0, attempts - 1), 24 * 3_600_000);
  return new Date(now.getTime() + delay);
}
