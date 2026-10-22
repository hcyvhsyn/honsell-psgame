/**
 * Kollektor xətaları — hər birinin `code`-u var ki, script istifadəçiyə
 * konkret növbəti addımı desin (məs. AUTH_REQUIRED → `npm run hbomax:login`).
 * Heç bir xəta səssiz udulmur: ya bunlardan biri atılır, ya da xəbərdarlıq log olunur.
 */

export type HboErrorCode =
  | "CONFIG"
  | "AUTH_REQUIRED"
  | "PROFILE_SELECTION"
  | "GEO_RESTRICTED"
  | "NOT_FOUND"
  | "SELECTOR_MISSING"
  | "PLAYER_ERROR"
  | "TIMEOUT";

const HINTS: Record<HboErrorCode, string> = {
  CONFIG: "Check HBOMAX_* variables in .env (see .env.example).",
  AUTH_REQUIRED: "Session expired or missing — run `npm run hbomax:login` and sign in again.",
  PROFILE_SELECTION:
    "Collector profile not active/selected — set HBOMAX_PROFILE_NAME in .env to the dedicated profile and switch to it in `npm run hbomax:login`. Validation never picks a profile itself.",
  GEO_RESTRICTED: "HBO Max reports the title/service is not available in this region.",
  NOT_FOUND: "The URL does not resolve to a title — check the URL in .env.",
  SELECTOR_MISSING:
    "The HBO Max UI changed or the element is absent — see the selector dump in debug-responses/ and update lib/scrapers/hbomaxCollector/selectors.ts.",
  PLAYER_ERROR:
    "The player showed an error. Use HBOMAX_BROWSER_CHANNEL=chrome (bundled Chromium cannot render protected playback UI).",
  TIMEOUT: "Network/page timeout — retry later or raise HBOMAX_NAV_TIMEOUT_MS.",
};

export class HboCollectorError extends Error {
  constructor(
    public readonly code: HboErrorCode,
    message: string,
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = "HboCollectorError";
  }

  get hint(): string {
    return HINTS[this.code];
  }
}

export function isHboError(err: unknown, code?: HboErrorCode): err is HboCollectorError {
  return err instanceof HboCollectorError && (code === undefined || err.code === code);
}

/**
 * Brauzer / səhifə bağlanıb (pəncərə əl ilə bağlanıb, Chrome çöküb, proses dayandırılıb).
 * Bundan sonra hər sorğu eyni xətanı verir — run DAYANMALIDIR, qalan başlıqlar/epizodlar
 * "uğursuz" sayılmamalıdır (2026-10-21: 611 başlıq belə keçildi).
 */
export function isBrowserClosed(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /Target page, context or browser has been closed|Browser has been closed|browserContext\.\w+: Target closed/i.test(msg);
}

/** Kollektor DB modulu yüklənməyibsə (scriptdən kənar çağırış) dayan — `.env` Supabase-ə yazılmasın. */
export function assertCollectorDbSelected(): void {
  if (process.env.HBOMAX_DB_SELECTED !== "1") {
    throw new HboCollectorError("CONFIG", 'Collector DB not selected — import "@/lib/scrapers/hbomaxCollector/db/collectorDb" before lib/prisma');
  }
}
