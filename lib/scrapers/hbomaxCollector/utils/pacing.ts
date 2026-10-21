/**
 * Nəzakətli tempin alətləri: jitter-li fasilə, backoff ilə retry, məhdud paralellik.
 *
 * `lib/scrapers/fetchWithRetry.ts` yalnız `fetch` üçündür; burada istənilən async
 * əməliyyat (Playwright naviqasiyası, klik) üçün ümumi variant var. `sleep` oradan
 * götürülür — təkrarlanmır.
 *
 * Phase 1 yalnız `politeDelay` və `retryWithBackoff` işlədir; `createLimiter`
 * gələcək kataloq crawler-i üçün hazırdır (HBOMAX_MAX_CONCURRENCY).
 */
import { sleep } from "@/lib/scrapers/fetchWithRetry";

export { sleep };

/** `baseMs` + 0–30% təsadüfi əlavə — sabit ritm göndərməmək üçün. */
export function politeDelay(baseMs: number): Promise<void> {
  return sleep(baseMs + Math.floor(Math.random() * baseMs * 0.3));
}

export interface RetryOptions {
  attempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  /** false qaytarsa dərhal atılır (məs. AUTH_REQUIRED retry ilə düzəlmir). */
  isRetryable?: (err: unknown) => boolean;
  onRetry?: (err: unknown, attempt: number, delayMs: number) => void;
}

export async function retryWithBackoff<T>(fn: (attempt: number) => Promise<T>, opts: RetryOptions): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= opts.attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (attempt === opts.attempts || (opts.isRetryable && !opts.isRetryable(err))) throw err;
      const delay = Math.min(opts.baseDelayMs * 2 ** (attempt - 1), opts.maxDelayMs);
      opts.onRetry?.(err, attempt, delay);
      await politeDelay(delay);
    }
  }
  throw lastError;
}

/** p-limit tərzi: eyni anda ən çox `concurrency` tapşırıq işləyir. */
export function createLimiter(concurrency: number) {
  const limit = Math.max(1, Math.floor(concurrency));
  let active = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    if (active >= limit) return;
    const run = queue.shift();
    if (run) {
      active++;
      run();
    }
  };

  return function schedule<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        task()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          });
      });
      next();
    });
  };
}
