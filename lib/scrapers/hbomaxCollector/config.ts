/**
 * HBO Max kollektor konfiqurasiyası — hamısı `.env`-dən (dotenv/config, digər
 * `scripts/*.ts` kimi). URL-lər hardcode olunmur.
 *
 * Region `SCRAPER_CONFIG.country`-dən gəlir — "AZ" heç bir yerdə ayrıca yazılmır.
 * Kollektor istifadəçinin Azərbaycandakı lokal maşınında işləyir, yəni gördüyü
 * kataloq AZ kataloqudur; region parametri yalnız çıxışa damğa vurur.
 */
import path from "node:path";
import { SCRAPER_CONFIG } from "@/lib/scrapers/config";
import { HboCollectorError } from "@/lib/scrapers/hbomaxCollector/errors";

export const HBOMAX_REGION = SCRAPER_CONFIG.country;

/** HBO Max hostları — URL validasiyası və şəbəkə süzgəci üçün. */
export const HBOMAX_HOST_SUFFIXES = ["hbomax.com", "max.com"] as const;

export type BrowserChannel = "chrome" | "chromium";

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    throw new HboCollectorError("CONFIG", `${name} must be a non-negative number, got "${raw}"`);
  }
  return n;
}

function channelEnv(): BrowserChannel {
  const raw = (process.env.HBOMAX_BROWSER_CHANNEL || "chrome").toLowerCase();
  if (raw !== "chrome" && raw !== "chromium") {
    throw new HboCollectorError("CONFIG", `HBOMAX_BROWSER_CHANNEL must be "chrome" or "chromium", got "${raw}"`);
  }
  return raw;
}

const root = process.cwd();

export const HBOMAX_CONFIG = {
  homeUrl: process.env.HBOMAX_HOME_URL || "https://play.hbomax.com/",
  /** Persistent brauzer profili — sessiya burada qalır, git-ə düşmür. */
  profileDir: path.resolve(root, process.env.HBOMAX_PROFILE_DIR || ".hbomax-profile"),
  debugDir: path.resolve(root, "debug-responses"),
  outputDir: path.resolve(root, "output"),
  /** "chrome" — sistemdəki Google Chrome (Widevine daxil, player UI normal açılır).
   *  "chromium" — Playwright-in öz build-i (`npx playwright install chromium` lazımdır). */
  channel: channelEnv(),
  headless: process.env.HBOMAX_HEADLESS === "1",
  /** "Who's watching?" ekranında seçiləcək profil adı (boşdursa xəta atılır). */
  profileName: process.env.HBOMAX_PROFILE_NAME?.trim() || undefined,
  navTimeoutMs: intEnv("HBOMAX_NAV_TIMEOUT_MS", 45_000),
  /** Səhifələr/klikləmələr arası nəzakət fasiləsi. */
  pageDelayMs: intEnv("HBOMAX_PAGE_DELAY_MS", 2_500),
  /** CMS metadata sorğuları arası fasilə (brauzer daxili fetch). */
  cmsDelayMs: intEnv("HBOMAX_CMS_DELAY_MS", 1_200),
  retry: {
    attempts: SCRAPER_CONFIG.retry.attempts,
    baseDelayMs: 2_000,
    maxDelayMs: 15_000,
  },
  /** Paralellik — hazırda yalnız 1 dəstəklənir (bir persistent brauzer, bir epizod). */
  maxConcurrency: intEnv("HBOMAX_MAX_CONCURRENCY", 1),
  /** Stage 2 (AZ player validasiyası) — dəqiqlik sürətdən vacibdir. */
  validation: {
    delayMs: intEnv("HBOMAX_VALIDATE_DELAY_MS", 8_000),
    /** Bir epizod üçün maksimum cəhd; sonra terminal FAILED (metadata dəyişəndə yenidən). */
    maxAttempts: intEnv("HBOMAX_VALIDATE_RETRIES", 3),
    /** Backoff bazası: 1 saat → 6 saat → 24 saat (tavan). */
    backoffBaseMs: intEnv("HBOMAX_VALIDATE_BACKOFF_MS", 3_600_000),
    /** Sürüşən 24 saatlıq pəncərədə maksimum cəhd. */
    dailyLimit: intEnv("HBOMAX_DAILY_VALIDATION_LIMIT", 300),
    revalidateAfterDays: intEnv("HBOMAX_REVALIDATE_AFTER_DAYS", 30),
  },
} as const;

function isHboHost(hostname: string): boolean {
  return HBOMAX_HOST_SUFFIXES.some((s) => hostname === s || hostname.endsWith(`.${s}`));
}

export function isHboUrl(raw: string): boolean {
  try {
    return isHboHost(new URL(raw).hostname);
  } catch {
    return false;
  }
}

/** `HBOMAX_SERIES_URL` / `HBOMAX_EPISODE_URL` oxuyur və HBO Max URL-i olduğunu yoxlayır. */
export function requireHboUrlEnv(name: "HBOMAX_SERIES_URL" | "HBOMAX_EPISODE_URL"): string {
  const raw = process.env[name]?.trim();
  if (!raw) {
    throw new HboCollectorError("CONFIG", `${name} is not set in .env`);
  }
  if (!isHboUrl(raw)) {
    throw new HboCollectorError("CONFIG", `${name} is not an HBO Max URL: ${raw}`);
  }
  return raw;
}
