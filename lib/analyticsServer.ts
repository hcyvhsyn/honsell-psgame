/**
 * Analitikanın YALNIZ server tərəfdə lazım olan hissəsi.
 *
 * Bot aşkarlaması üçün yeni npm paketi (isbot və s.) qəsdən əlavə edilmir —
 * bundle səthini böyüdür və bu siyahı ildə bir dəfə yenilənsə kifayətdir.
 * Bot trafiki SİLİNMİR, `isBot: true` ilə yazılır: filtrin real ziyarətçi
 * yediyini sonradan yoxlaya bilmək üçün.
 */

import { normalizeHost } from "@/lib/analyticsShared";

const BOT_PATTERN =
  /bot|crawl|spider|slurp|curl|wget|python-requests|axios|okhttp|headless|phantomjs|puppeteer|playwright|selenium|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|facebookexternalhit|whatsapp|telegrambot|twitterbot|linkedinbot|discordbot|preview|scraper|fetch|http-client|go-http|java\/|perl|ruby|semrush|ahrefs|mj12|dotbot|petalbot|bytespider|yandexbot|googlebot|bingbot|applebot|duckduckbot|baiduspider/i;

/** User-Agent bot kimi görünürmü. Boş UA da bot sayılır (real brauzer həmişə göndərir). */
export function isLikelyBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true;
  const ua = userAgent.trim();
  if (ua.length < 10) return true;
  return BOT_PATTERN.test(ua);
}

/**
 * Beacon-un öz saytımızdan gəldiyini yoxlayır. Kənar mənbədən göndərilən
 * saxta event-lər hesabatı zibilləyə bilər; bu, ucuz birinci baryerdir.
 *
 * `null` origin (məs. bəzi `sendBeacon` halları) rədd edilmir — brauzerlər
 * həmişə Origin göndərmir. Yalnız AÇIQ-AŞKAR yad host bloklanır.
 */
export function isSameSiteRequest(req: Request): boolean {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const candidate = origin ?? referer;
  if (!candidate) return true;

  const candidateHost = normalizeHost(candidate);
  if (!candidateHost) return true;

  const selfHost = normalizeHost(req.headers.get("host"));
  if (!selfHost) return true;

  return candidateHost === selfHost;
}

/**
 * Reverse proxy arxasında real IP. Cloudflare → nginx → next start zənciri
 * olduğu üçün `cf-connecting-ip` birinci sırada yoxlanılır.
 */
export function clientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
