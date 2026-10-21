/**
 * Persistent Playwright sessiyası + səhifə vəziyyətinin aşkarlanması.
 *
 * Sessiya `.hbomax-profile/`-də qalır (git-ə düşmür). E-poçt/şifrə HEÇ VAXT
 * oxunmur və saxlanılmır — giriş `npm run hbomax:login`-də əl ilə olur.
 *
 * Default kanal sistemdəki Google Chrome-dur: HBO Max player-i Widevine CDM-siz
 * xəta ekranı göstərir və "Audio & Subtitles" düyməsinə çatmaq olmur. Playwright
 * default olaraq `--disable-component-update` verir, bu da Chrome-un öz CDM
 * komponentini söndürür — ona görə həmin arqument çıxarılır. Bu, brauzerin ADİ
 * davranışıdır; DRM/lisenziya sorğularına toxunulmur və onlar oxunmur.
 */
import { mkdirSync } from "node:fs";
import { chromium, type BrowserContext, type Page } from "playwright";
import { HBOMAX_CONFIG, isHboUrl } from "@/lib/scrapers/hbomaxCollector/config";
import { HboCollectorError } from "@/lib/scrapers/hbomaxCollector/errors";
import { hboLog } from "@/lib/scrapers/hbomaxCollector/log";
import { PAGE_STATE, PROFILE, profileButton, profileNameFromEditLabel } from "@/lib/scrapers/hbomaxCollector/selectors";
import { politeDelay, retryWithBackoff } from "@/lib/scrapers/hbomaxCollector/utils/pacing";

export interface HboSession {
  context: BrowserContext;
  page: Page;
  close(): Promise<void>;
}

export async function openSession(opts: { headless?: boolean } = {}): Promise<HboSession> {
  mkdirSync(HBOMAX_CONFIG.profileDir, { recursive: true });
  const headless = opts.headless ?? HBOMAX_CONFIG.headless;

  let context: BrowserContext;
  try {
    context = await chromium.launchPersistentContext(HBOMAX_CONFIG.profileDir, {
      channel: HBOMAX_CONFIG.channel === "chrome" ? "chrome" : undefined,
      headless,
      viewport: null,
      args: ["--mute-audio", "--start-maximized"],
      ignoreDefaultArgs: ["--disable-component-update"],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/ProcessSingleton|SingletonLock|profile.*in use/i.test(msg)) {
      throw new HboCollectorError("CONFIG", "The HBO Max profile is already open in another browser window — close it first.", { cause: err });
    }
    if (/Executable doesn't exist|chrome.*not found|distribution 'chrome' is not found/i.test(msg)) {
      throw new HboCollectorError(
        "CONFIG",
        `Browser for channel "${HBOMAX_CONFIG.channel}" not found. Install Google Chrome, or set HBOMAX_BROWSER_CHANNEL=chromium and run \`npx playwright install chromium\`.`,
        { cause: err }
      );
    }
    throw err;
  }

  // tsx (esbuild keepNames) brauzerə göndərilən funksiyaları `__name(...)` ilə
  // sarır; səhifədə bu helper yoxdur → "ReferenceError: __name is not defined".
  await context.addInitScript({ content: "globalThis.__name = globalThis.__name || ((fn) => fn);" });
  context.setDefaultNavigationTimeout(HBOMAX_CONFIG.navTimeoutMs);
  context.setDefaultTimeout(15_000);
  const page = context.pages()[0] ?? (await context.newPage());
  hboLog.info("Browser started", { channel: HBOMAX_CONFIG.channel, headless });

  return {
    context,
    page,
    async close() {
      await context.close().catch((err: unknown) => hboLog.warn(`Browser close failed: ${String(err)}`));
    },
  };
}

export type PageState = "ok" | "auth_required" | "profile_picker" | "geo_blocked" | "not_found" | "player_error" | "provider_error";

async function bodyText(page: Page): Promise<string> {
  // Yalnız görünən mətn — böyük DOM-da qısa saxlanılır.
  return (await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "")).slice(0, 20_000);
}

export async function detectPageState(page: Page): Promise<PageState> {
  const url = page.url();
  if (PAGE_STATE.authUrl.test(url) || (!isHboUrl(url) && url !== "about:blank")) return "auth_required";
  if (isHboUrl(url) && !PAGE_STATE.appHost.test(new URL(url).hostname)) return "auth_required";
  if (PAGE_STATE.errorUrl.test(url)) return "provider_error";

  const text = await bodyText(page);
  if (PAGE_STATE.geoBlockedText.test(text)) return "geo_blocked";
  if (PAGE_STATE.profilePickerText.test(text)) return "profile_picker";
  if (PAGE_STATE.notFoundText.test(text)) return "not_found";
  if (PAGE_STATE.playerErrorText.test(text)) return "player_error";

  // Açıq "Sign in" düyməsi + başqa heç nə → sessiya yoxdur.
  const signIn = page.getByRole("button", { name: PAGE_STATE.signInText }).or(page.getByRole("link", { name: PAGE_STATE.signInText }));
  if (await signIn.first().isVisible().catch(() => false)) return "auth_required";

  return "ok";
}

export interface PageUsableOptions {
  /** Validasiya rejimi: profil seçimi tələb olunursa SEÇMƏ, dayan — başqa profilin
   *  baxış tarixçəsinə toxunmamaq üçün. Profil `hbomax:login`-də əl ilə seçilir. */
  strictProfile?: boolean;
}

/** Vəziyyət `ok` deyilsə uyğun `HboCollectorError` atır; (strict deyilsə) profil seçimini həll etməyə çalışır. */
export async function assertPageUsable(page: Page, what: string, opts: PageUsableOptions = {}): Promise<void> {
  let state = await detectPageState(page);

  if (state === "profile_picker" && opts.strictProfile) {
    throw new HboCollectorError("PROFILE_SELECTION", `Profile selection required while opening ${what} — validation stopped (strict profile mode)`);
  }
  if (state === "profile_picker") {
    if (!HBOMAX_CONFIG.profileName) {
      throw new HboCollectorError("PROFILE_SELECTION", `Profile picker shown while opening ${what}`);
    }
    const btn = profileButton(page, HBOMAX_CONFIG.profileName).first();
    if (!(await btn.isVisible().catch(() => false))) {
      throw new HboCollectorError("PROFILE_SELECTION", `Profile "${HBOMAX_CONFIG.profileName}" not found on the picker`);
    }
    await btn.click();
    hboLog.info("Profile selected", { profile: HBOMAX_CONFIG.profileName });
    await page.waitForLoadState("domcontentloaded");
    await politeDelay(HBOMAX_CONFIG.pageDelayMs);
    state = await detectPageState(page);
  }

  switch (state) {
    case "ok":
      return;
    case "auth_required":
      throw new HboCollectorError("AUTH_REQUIRED", `Not signed in while opening ${what} (landed on ${safeUrl(page.url())})`);
    case "geo_blocked":
      throw new HboCollectorError("GEO_RESTRICTED", `${what} is geo-restricted`);
    case "not_found":
      throw new HboCollectorError("NOT_FOUND", `${what} not found`);
    case "player_error":
      throw new HboCollectorError("PLAYER_ERROR", `Player error while opening ${what}`);
    case "provider_error":
      throw new HboCollectorError("NOT_FOUND", `HBO redirected ${what} to its error page (${safeUrl(page.url())})`);
    case "profile_picker":
      throw new HboCollectorError("PROFILE_SELECTION", `Still on the profile picker after selecting a profile`);
  }
}

function isRetryableNavError(err: unknown): boolean {
  if (err instanceof HboCollectorError) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return /Timeout|net::ERR_|ECONNRESET|ENOTFOUND|NS_ERROR/i.test(msg);
}

/** Naviqasiya + retry/backoff + vəziyyət yoxlaması. */
export async function gotoHbo(page: Page, url: string, what: string, opts: PageUsableOptions = {}): Promise<void> {
  try {
    await retryWithBackoff(
      async () => {
        await page.goto(url, { waitUntil: "domcontentloaded" });
        // SPA — əsas JSON sorğuları DOM-dan sonra gəlir. networkidle HBO-da heç vaxt
        // gəlməyə bilər (canlı telemetriya), ona görə qısa limitlə gözlənilir.
        await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
      },
      {
        ...HBOMAX_CONFIG.retry,
        isRetryable: isRetryableNavError,
        onRetry: (err, attempt, delay) =>
          hboLog.warn(`Navigation to ${what} failed, retrying`, { attempt, delayMs: delay, error: err instanceof Error ? err.message.split("\n")[0] : String(err) }),
      }
    );
  } catch (err) {
    if (isRetryableNavError(err)) {
      throw new HboCollectorError("TIMEOUT", `Could not load ${what}: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`, { cause: err });
    }
    throw err;
  }
  await politeDelay(HBOMAX_CONFIG.pageDelayMs);
  await assertPageUsable(page, what, opts);
}

/** Log/hesabat üçün URL — query (token ola bilər) atılır. */
export function safeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.origin}${u.pathname}`;
  } catch {
    return raw;
  }
}

const clean = (s: string) => s.replace(/[\u2066-\u2069]/g, "").trim().toLowerCase();

/**
 * Aktiv profilin `HBOMAX_PROFILE_NAME` olduğunu sübut edir; edə bilmirsə DAYANIR
 * (validasiya başqa profilin baxış tarixçəsinə düşməsin).
 *
 * HBO aktiv profilin adını göstərmir, ona görə iki faktdan çıxarılır:
 *   1. "Manage Profiles"-da gözlənilən ad VAR (bütün profillər);
 *   2. header dropdown-unda (DİGƏR profillər) gözlənilən ad YOXDUR və
 *      say = hamısı − 1  →  aktiv profil odur.
 * Yoxlamadan sonra ana səhifəyə qayıdılır (strict rejimdə).
 */
export async function assertDedicatedProfile(page: Page): Promise<void> {
  const expected = HBOMAX_CONFIG.profileName;
  if (!expected) throw new HboCollectorError("CONFIG", "HBOMAX_PROFILE_NAME is not set");
  const toggle = page.locator(PROFILE.toggle).first();
  if (!(await toggle.isVisible().catch(() => false))) {
    throw new HboCollectorError("SELECTOR_MISSING", "Profile menu button not found — cannot verify the active profile");
  }

  await toggle.click();
  await page.locator(PROFILE.manageButton).first().waitFor({ state: "visible", timeout: 10_000 });
  const others = (await page.locator(PROFILE.switchItem).evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? ""))).map(clean).filter(Boolean);

  await page.locator(PROFILE.manageButton).first().click();
  await page.locator(PROFILE.editAvatarButton).first().waitFor({ state: "visible", timeout: 15_000 });
  const all = (await page.locator(PROFILE.editAvatarButton).evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? "")))
    .map((l) => profileNameFromEditLabel(l))
    .filter((n): n is string => !!n)
    .map(clean);

  const want = clean(expected);
  const exists = all.includes(want);
  const isOther = others.includes(want);
  const consistent = all.length === others.length + 1 && others.every((o) => all.includes(o));
  if (!exists || isOther || !consistent) {
    throw new HboCollectorError(
      "PROFILE_SELECTION",
      !exists
        ? `Profile "${expected}" does not exist on this account`
        : isOther
          ? `Active profile is not "${expected}" — switch to it in \`npm run hbomax:login\``
          : `Could not prove the active profile (profiles: ${all.length}, switch targets: ${others.length})`
    );
  }
  hboLog.info("Dedicated profile verified", { profile: expected });
  await gotoHbo(page, HBOMAX_CONFIG.homeUrl, "home", { strictProfile: true });
}