/**
 * HBO Max — əl ilə giriş (persistent profil).
 *
 *   npm run hbomax:login
 *
 * Görünən Chrome pəncərəsi `.hbomax-profile/` profili ilə açılır. Orada əl ilə
 * daxil ol (və profil seç), sonra terminalda Enter bas — sessiya profildə qalır
 * və `hbomax:inspect-*` scriptləri onu işlədir. E-poçt/şifrə bu script tərəfindən
 * oxunmur və heç yerə yazılmır. `.hbomax-profile/` git-ə düşmür (.gitignore).
 */
import "dotenv/config";
import readline from "node:readline/promises";
import { HBOMAX_CONFIG } from "@/lib/scrapers/hbomaxCollector/config";
import { runCli } from "@/lib/scrapers/hbomaxCollector/cli";
import { hboLog } from "@/lib/scrapers/hbomaxCollector/log";
import { detectPageState, openSession, safeUrl } from "@/lib/scrapers/hbomaxCollector/browser/session";

runCli(async () => {
  const session = await openSession({ headless: false });
  try {
    await session.page.goto(HBOMAX_CONFIG.homeUrl, { waitUntil: "domcontentloaded" });
    hboLog.info(`Opened ${safeUrl(HBOMAX_CONFIG.homeUrl)}`);
    hboLog.info("Sign in manually in the browser window (and pick a profile).");

    const closed = new Promise<"closed">((resolve) => session.context.on("close", () => resolve("closed")));
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answered = rl.question("[HBO] Press Enter here when you see the HBO Max home screen… ").then(() => "enter" as const);
    const outcome = await Promise.race([answered, closed]);
    rl.close();

    if (outcome === "closed") {
      hboLog.warn("Browser was closed before confirmation — session state saved as-is, run an inspect script to verify.");
      return;
    }

    await session.page.goto(HBOMAX_CONFIG.homeUrl, { waitUntil: "domcontentloaded" });
    await session.page.waitForTimeout(3_000);
    const state = await detectPageState(session.page);
    if (state === "ok" || state === "profile_picker") {
      hboLog.info("Authenticated session saved", { profileDir: HBOMAX_CONFIG.profileDir.replace(process.cwd() + "/", "") });
      if (state === "profile_picker") {
        hboLog.warn("HBO Max shows the profile picker on start — set HBOMAX_PROFILE_NAME in .env so collectors can choose it.");
      }
    } else {
      hboLog.warn(`Login could not be confirmed (page state: ${state}). Run this script again if collectors report AUTH_REQUIRED.`);
    }
  } finally {
    await session.close();
  }
});
