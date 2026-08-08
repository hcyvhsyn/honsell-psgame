import { prisma } from "@/lib/prisma";

/**
 * Analitika saxlama müddəti.
 *
 * Xam event axını sürətlə böyüyür (təxminən 500 ziyarətçi/gün × 5 event ≈
 * 75k sətir/ay), amma ondan yalnız son bir neçə ay lazım olur — hesabatın əsl
 * mənbəyi `AnalyticsSession` və `OrderAttribution`-dır, onlar isə kiçikdir.
 *
 * `OrderAttribution` HEÇ VAXT silinmir: o, sifariş tarixçəsinin bir hissəsidir
 * və `Transaction` sətirləri ilə birlikdə qalmalıdır.
 */

export const EVENT_RETENTION_DAYS = 180;
export const SESSION_RETENTION_DAYS = 400;
/** Uzun lock olmasın deyə partiyalarla silinir. */
const BATCH_SIZE = 5000;
const MAX_BATCHES = 200;

function daysAgo(now: Date, days: number): Date {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return d;
}

async function pruneEvents(cutoff: Date): Promise<number> {
  let removed = 0;
  for (let i = 0; i < MAX_BATCHES; i++) {
    const batch = await prisma.analyticsEvent.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true },
      take: BATCH_SIZE,
    });
    if (batch.length === 0) break;
    const res = await prisma.analyticsEvent.deleteMany({
      where: { id: { in: batch.map((b) => b.id) } },
    });
    removed += res.count;
    if (batch.length < BATCH_SIZE) break;
  }
  return removed;
}

async function pruneSessions(cutoff: Date): Promise<number> {
  let removed = 0;
  for (let i = 0; i < MAX_BATCHES; i++) {
    const batch = await prisma.analyticsSession.findMany({
      where: { startedAt: { lt: cutoff } },
      select: { id: true },
      take: BATCH_SIZE,
    });
    if (batch.length === 0) break;
    const res = await prisma.analyticsSession.deleteMany({
      where: { id: { in: batch.map((b) => b.id) } },
    });
    removed += res.count;
    if (batch.length < BATCH_SIZE) break;
  }
  return removed;
}

export async function runAnalyticsPrune(now = new Date()) {
  const eventCutoff = daysAgo(now, EVENT_RETENTION_DAYS);
  const sessionCutoff = daysAgo(now, SESSION_RETENTION_DAYS);

  const events = await pruneEvents(eventCutoff);
  const sessions = await pruneSessions(sessionCutoff);

  return {
    events,
    sessions,
    eventCutoff: eventCutoff.toISOString(),
    sessionCutoff: sessionCutoff.toISOString(),
  };
}
