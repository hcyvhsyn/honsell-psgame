/**
 * `/api/t` üçün yaddaşdaxili sürət limiti.
 *
 * NİYƏ `lib/rateLimit.ts` İŞLƏDİLMİR:
 * O modul hər cəhddə DB-yə bir `RateLimitEvent` sətri yazır. Analitika beacon-u
 * saytdakı ƏN TEZ-TEZ çağırılan endpoint-dir — yəni limiti DB ilə saxlamaq
 * analitikanın öz yazma həcmini İKİQAT edərdi. Absurd nəticə: ölçmə sistemi
 * ölçdüyü şeydən çox yük yaradar.
 *
 * `lib/rateLimit.ts`-in şərhi yaddaşdaxili limitin işləmədiyini deyir, çünki
 * "Vercel serverless funksiyaları vəziyyəti paylaşmır" — amma bu tətbiq
 * Vercel-də DEYİL, öz serverində tək uzunömürlü `next start` prosesidir
 * (bax: docs/). Ona görə burada `Map` həm düzgün, həm pulsuzdur.
 *
 * Bu, təhlükəsizlik sərhədi deyil — sadəcə zibil trafikin DB-ni doldurmasının
 * qarşısını alır. Real qoruma `isLikelyBot` + same-site yoxlamasıdır.
 */

const WINDOW_MS = 5 * 60 * 1000; // 5 dəqiqə
const MAX_REQUESTS = 60;
const MAX_EVENTS = 300;
/** Map sonsuz böyüməsin — bu həddi keçəndə vaxtı bitmiş açarlar süpürülür. */
const SWEEP_THRESHOLD = 5000;

type Bucket = { requests: number; events: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Limitə düşürmü. `false` qaytarsa çağıran tərəf sətirləri sadəcə atır və yenə
 * 204 qaytarır — client-ə xəta göstərmək mənasızdır, o onsuz da cavabı oxumur.
 */
export function allowTrackRequest(ip: string, eventCount: number): boolean {
  const now = Date.now();

  if (buckets.size > SWEEP_THRESHOLD) sweep(now);

  const existing = buckets.get(ip);
  if (!existing || existing.resetAt <= now) {
    buckets.set(ip, {
      requests: 1,
      events: eventCount,
      resetAt: now + WINDOW_MS,
    });
    return true;
  }

  if (existing.requests >= MAX_REQUESTS) return false;
  if (existing.events + eventCount > MAX_EVENTS) return false;

  existing.requests += 1;
  existing.events += eventCount;
  return true;
}

/** Testlər üçün — vəziyyəti sıfırlayır. */
export function resetTrackRateLimit() {
  buckets.clear();
}
