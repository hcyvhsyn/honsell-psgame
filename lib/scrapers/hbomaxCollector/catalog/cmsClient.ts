/**
 * HBO Max CMS metadata client — autentifikasiyalı brauzer konteksti daxilindən `fetch`.
 *
 * Niyə brauzer daxilində? CMS cookie ilə autentifikasiya olunur və tətbiqin öz
 * müştəri başlıqlarını tələb edir (`x-disco-client`, `x-disco-params` — yoxdursa
 * `400 invalid.headers`). Sorğu səhifənin öz kontekstindən göndərilir, cookie-lər
 * brauzerdə qalır, Node tərəfinə heç vaxt keçmir.
 *
 * Başlıqlar tətbiqin İLK real CMS sorğusundan götürülür və yalnız ALLOWLIST-dəki
 * adlar saxlanılır (yaddaşda; log/fayla yazılmır). Auth/token başlıqları köçürülmür.
 *
 * YALNIZ `/cms/` metadata yolları icazəlidir — playback/DRM endpoint-ləri bu client
 * ilə çağırıla bilməz (`assertCmsPath`).
 */
import type { Page, Request } from "playwright";
import { HBOMAX_CONFIG } from "@/lib/scrapers/hbomaxCollector/config";
import { HboCollectorError } from "@/lib/scrapers/hbomaxCollector/errors";
import { hboLog } from "@/lib/scrapers/hbomaxCollector/log";
import { gotoHbo } from "@/lib/scrapers/hbomaxCollector/browser/session";
import { politeDelay, retryWithBackoff } from "@/lib/scrapers/hbomaxCollector/utils/pacing";

/** Tətbiqin müştəri identifikasiyası — sirr deyil, amma yenə də yalnız yaddaşda. */
const HEADER_ALLOWLIST = ["x-disco-client", "x-disco-params", "x-device-info", "x-wbd-preferred-language", "x-wbd-time-zone", "content-type"];

const CMS_PATH_RE = /^\/cms\/(routes|collections)\//;

function assertCmsPath(pathAndQuery: string): void {
  if (!CMS_PATH_RE.test(pathAndQuery)) {
    throw new HboCollectorError("CONFIG", `CMS client only allows /cms/routes|collections paths, got ${pathAndQuery.split("?")[0]}`);
  }
}

class HttpStatusError extends Error {
  constructor(public readonly status: number, detail: string) {
    super(`HTTP ${status}: ${detail}`);
  }
}

export interface CmsClient {
  /** API origin, məs. https://default.any-emea.prd.api.hbomax.com */
  readonly origin: string;
  get<T = unknown>(pathAndQuery: string): Promise<T>;
  readonly requestCount: number;
}

/**
 * Səhifədə tətbiqin ilk CMS sorğusunu gözləyir (çağırandan ƏVVƏL qoşulmalıdır,
 * sonra səhifə açılır). Qaytarılan funksiya client-i yaradır.
 */
interface CmsContext {
  origin: string;
  headers: Record<string, string>;
}

/** Tətbiqin ilk CMS sorğusundan origin + allowlist başlıqlarını götürür (səhifə açılmazdan ƏVVƏL qoşulur). */
function captureCmsHeaders(page: Page): () => Promise<CmsContext> {
  let captured: CmsContext | null = null;
  const onRequest = (r: Request) => {
    if (captured) return;
    const u = new URL(r.url());
    if (!CMS_PATH_RE.test(u.pathname)) return;
    const all = r.headers();
    const headers: Record<string, string> = {};
    for (const k of HEADER_ALLOWLIST) if (all[k]) headers[k] = all[k];
    if (headers["x-disco-client"] && headers["x-disco-params"]) captured = { origin: u.origin, headers };
  };
  page.on("request", onRequest);

  return async () => {
    const deadline = Date.now() + HBOMAX_CONFIG.navTimeoutMs;
    while (!captured && Date.now() < deadline) await page.waitForTimeout(250);
    page.off("request", onRequest);
    if (!captured) throw new HboCollectorError("SELECTOR_MISSING", "No HBO CMS request observed — cannot derive API origin/client headers");
    return captured;
  };
}

export function captureCmsContext(page: Page): () => Promise<CmsClient> {
  const capture = captureCmsHeaders(page);
  return async () => buildClient(page, await capture());
}

/** Brauzerin `fetch` şəbəkə xətası ("Failed to fetch"). CORS başlıqsız 429 da belə görünür. */
class NetworkError extends Error {}

const NETWORK_RETRY = { attempts: 4, baseDelayMs: 15_000, maxDelayMs: 120_000 };

function buildClient(page: Page, initial: CmsContext): CmsClient {
  let ctx = initial;
  let requestCount = 0;

  const fetchOnce = async (pathAndQuery: string): Promise<unknown> => {
    let res: { status: number; text: string };
    try {
      res = await page.evaluate(
        async ({ url, hdrs }) => {
          const r = await fetch(url, { credentials: "include", headers: hdrs });
          const text = await r.text();
          return { status: r.status, text };
        },
        { url: `${ctx.origin}${pathAndQuery}`, hdrs: ctx.headers }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/Failed to fetch|NetworkError|net::ERR_|Execution context was destroyed/i.test(msg)) throw new NetworkError(msg.split("\n")[0]);
      throw err;
    }
    requestCount++;
    if (res.status === 401 || res.status === 403) {
      throw new HboCollectorError("AUTH_REQUIRED", `CMS returned ${res.status} for ${pathAndQuery.split("?")[0]}`);
    }
    if (res.status < 200 || res.status >= 300) {
      // Xəta gövdəsindən yalnız kod/detal — başqa heç nə.
      let detail = res.text.slice(0, 160);
      try {
        const j = JSON.parse(res.text) as { errors?: Array<{ code?: string; detail?: string }> };
        detail = (j.errors ?? []).map((e) => `${e.code}: ${e.detail}`).join("; ") || detail;
      } catch {
        /* JSON deyil */
      }
      throw new HttpStatusError(res.status, detail);
    }
    return JSON.parse(res.text);
  };

  const withRetry = (pathAndQuery: string) =>
    retryWithBackoff(() => fetchOnce(pathAndQuery), {
      ...NETWORK_RETRY,
      isRetryable: (err) => err instanceof NetworkError || (err instanceof HttpStatusError && (err.status === 429 || err.status >= 500)),
      onRetry: (err, attempt, delayMs) => hboLog.warn(`CMS retry ${pathAndQuery.split("?")[0]}`, { attempt, delayMs, error: String(err) }),
    });

  /** Sessiyanı təzələ: /series yenidən açılır, başlıqlar yenidən götürülür. */
  const refresh = async () => {
    hboLog.warn("CMS unreachable — refreshing the browser session once");
    const capture = captureCmsHeaders(page);
    await gotoHbo(page, new URL("/series", HBOMAX_CONFIG.homeUrl).toString(), "series page (session refresh)");
    ctx = await capture();
  };

  return {
    get origin() {
      return ctx.origin;
    },
    get requestCount() {
      return requestCount;
    },
    async get<T>(pathAndQuery: string): Promise<T> {
      assertCmsPath(pathAndQuery);
      let body: unknown;
      try {
        body = await withRetry(pathAndQuery);
      } catch (err) {
        if (!(err instanceof NetworkError)) throw err;
        // Uzun backoff-dan sonra da şəbəkə xətası: bir dəfə sessiyanı təzələ, yenə alınmasa
        // kəşfi DAYANDIR — yüzlərlə kolleksiyanı səssizcə "uğursuz" yazmaq olmaz.
        await refresh();
        try {
          body = await withRetry(pathAndQuery);
        } catch (err2) {
          if (err2 instanceof NetworkError) {
            throw new HboCollectorError("TIMEOUT", `CMS unreachable after retries and a session refresh (${err2.message})`, { cause: err2 });
          }
          throw err2;
        }
      }
      await politeDelay(HBOMAX_CONFIG.cmsDelayMs);
      return body as T;
    },
  };
}

/** Sessiyanı CMS üçün hazırlayır: /series açılır, tətbiqin ilk CMS sorğusundan client qurulur. */
export async function openCmsClient(page: Page): Promise<CmsClient> {
  const make = captureCmsContext(page);
  await gotoHbo(page, new URL("/series", HBOMAX_CONFIG.homeUrl).toString(), "series page");
  return make();
}

export { HttpStatusError };
