import { SCRAPER_CONFIG } from "@/lib/scrapers/config";

export interface FetchRetryOptions extends RequestInit {
  /** Override default retry count. */
  retries?: number;
  /** Override default base delay. */
  baseDelayMs?: number;
  /** Bu HTTP statuslarda retry olunur — qalanlarda dərhal throw. */
  retryStatuses?: number[];
  /** Hər istəkdən sonra gözləmə (rate-limit pacing). */
  pacingMs?: number;
}

const DEFAULT_RETRY_STATUSES = [408, 425, 429, 500, 502, 503, 504];

export class FetchError extends Error {
  constructor(
    public status: number,
    public url: string,
    public bodySnippet: string
  ) {
    super(`HTTP ${status} for ${url}: ${bodySnippet.slice(0, 200)}`);
    this.name = "FetchError";
  }
}

function jitter(ms: number) {
  return ms + Math.floor(Math.random() * ms * 0.3);
}

/**
 * fetch wrapper with exponential backoff. Retries on network errors and on
 * configured HTTP status codes (default: 408/425/429/5xx). On 429 honors the
 * `Retry-After` header if present.
 */
export async function fetchWithRetry(
  url: string,
  init: FetchRetryOptions = {}
): Promise<Response> {
  const retries = init.retries ?? SCRAPER_CONFIG.retry.attempts;
  const baseDelay = init.baseDelayMs ?? SCRAPER_CONFIG.retry.baseDelayMs;
  const maxDelay = SCRAPER_CONFIG.retry.maxDelayMs;
  const retryStatuses = init.retryStatuses ?? DEFAULT_RETRY_STATUSES;

  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) {
        if (init.pacingMs) await sleep(init.pacingMs);
        return res;
      }
      if (!retryStatuses.includes(res.status) || attempt === retries) {
        const body = await safeText(res);
        throw new FetchError(res.status, url, body);
      }
      const retryAfterMs = parseRetryAfter(res.headers.get("retry-after"));
      const delay = retryAfterMs ?? jitter(Math.min(baseDelay * 2 ** (attempt - 1), maxDelay));
      await sleep(delay);
    } catch (err) {
      lastError = err;
      if (err instanceof FetchError) throw err;
      if (attempt === retries) break;
      const delay = jitter(Math.min(baseDelay * 2 ** (attempt - 1), maxDelay));
      await sleep(delay);
    }
  }
  throw lastError ?? new Error(`fetchWithRetry exhausted retries for ${url}`);
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const date = Date.parse(header);
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  return null;
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

export function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
