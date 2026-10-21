/**
 * Player "Audio & Subtitles" panelinin oxunması — Phase 1 kollektoru və Phase 2
 * validasiya işçisi eyni kodu işlədir.
 *
 * Player YALNIZ kontrollara çatmaq üçün açılır; oxunduqdan dərhal sonra video pauza
 * edilir və səhifə `about:blank`-a keçir. Media/manifest/DRM sorğularına toxunulmur,
 * ekran görüntüsü çəkilmir (selektor sınanda yalnız düymə adları yazılır).
 */
import path from "node:path";
import type { Page } from "playwright";
import { HBOMAX_CONFIG } from "@/lib/scrapers/hbomaxCollector/config";
import { HboCollectorError } from "@/lib/scrapers/hbomaxCollector/errors";
import { hboLog } from "@/lib/scrapers/hbomaxCollector/log";
import { writeJson } from "@/lib/scrapers/hbomaxCollector/output";
import { detectPageState } from "@/lib/scrapers/hbomaxCollector/browser/session";
import { dumpButtons, readTrackPanel, type PanelOption } from "@/lib/scrapers/hbomaxCollector/parsers/dom";
import { EPISODE_CODE_RE, PLAYER, firstVisible } from "@/lib/scrapers/hbomaxCollector/selectors";
import { politeDelay } from "@/lib/scrapers/hbomaxCollector/utils/pacing";

export async function dumpSelectorDiagnostics(page: Page, runDir: string, reason: string): Promise<string> {
  const file = writeJson(path.join(runDir, "_selector-dump.json"), {
    reason,
    url: page.url().split("?")[0],
    buttons: await dumpButtons(page).catch(() => []),
  });
  return file;
}

async function revealControls(page: Page): Promise<void> {
  const vp = page.viewportSize() ?? (await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight })));
  await page.mouse.move(vp.width / 2, vp.height / 2, { steps: 4 });
  await page.mouse.move(vp.width / 2 + 40, vp.height / 2 + 20, { steps: 4 });
}

export async function ensurePlayer(page: Page, runDir: string): Promise<void> {
  const video = page.locator("video").first();
  const hasVideo = await video.waitFor({ state: "attached", timeout: 6_000 }).then(() => true, () => false);
  if (!hasVideo) {
    const play = await firstVisible(page, PLAYER.playButton, 5_000);
    if (!play) {
      const dump = await dumpSelectorDiagnostics(page, runDir, "play button not found");
      throw new HboCollectorError("SELECTOR_MISSING", `Neither a player nor a Play button was found (dump: ${dump})`);
    }
    hboLog.info("Opening player");
    await play.click();
    await video.waitFor({ state: "attached", timeout: HBOMAX_CONFIG.navTimeoutMs }).catch(() => undefined);
  }
  await politeDelay(3_000);
  if ((await detectPageState(page)) === "player_error") {
    throw new HboCollectorError("PLAYER_ERROR", "Player displayed an error before controls became available");
  }
  if (!(await video.count())) {
    const dump = await dumpSelectorDiagnostics(page, runDir, "player did not start");
    throw new HboCollectorError("SELECTOR_MISSING", `Player did not appear (dump: ${dump})`);
  }
  hboLog.info("Player opened");
}

export async function openTrackPanel(page: Page, runDir: string) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    await revealControls(page);
    const btn = await firstVisible(page, PLAYER.audioSubtitlesButton, 2_500);
    if (btn) {
      await btn.click();
      await page.waitForTimeout(1_200);
      return firstVisible(page, PLAYER.panel, 2_500);
    }
  }
  const dump = await dumpSelectorDiagnostics(page, runDir, "audio & subtitles button not found");
  throw new HboCollectorError("SELECTOR_MISSING", `"Audio & Subtitles" button not found (dump: ${dump})`);
}

export async function stopPlayback(page: Page): Promise<void> {
  await page.keyboard.press("Escape").catch(() => undefined);
  await page
    .evaluate(() => {
      for (const v of Array.from(document.querySelectorAll("video"))) v.pause();
    })
    .catch(() => undefined);
  await page.goto("about:blank").catch(() => undefined);
}

/** JSON-da S/E yoxdursa player başlığından ("S1 E3") götürülür. */
export async function episodeCodeFromDom(page: Page): Promise<{ season?: number; episode?: number }> {
  const text = await page.locator("body").innerText({ timeout: 3_000 }).catch(() => "");
  const m = text.match(EPISODE_CODE_RE);
  return m ? { season: Number(m[1] ?? m[3]), episode: Number(m[2] ?? m[4]) } : {};
}

export interface PlayerTrackRead {
  options: PanelOption[];
  audioLabels: string[];
  subtitleLabels: string[];
  ungroupedLabels: string[];
  durationMs: number;
}

/**
 * Artıq açılmış epizod səhifəsində: player → panel → seçimlər. Çağıran sonra
 * `stopPlayback` etməlidir (finally-də). Boş/qruplaşmayan panel XƏTADIR — səssiz
 * "0 trek" yazılmır.
 */
export async function readPlayerTracks(page: Page, diagDir: string): Promise<PlayerTrackRead> {
  const started = Date.now();
  await ensurePlayer(page, diagDir);
  const panel = await openTrackPanel(page, diagDir);
  // Player audio siyahısını manifest yükləndikcə doldurur: ilk oxunuş natamam ola bilər
  // (real hal: S01E01 ilk oxunuşda 1 audio, sonra 10). İki ardıcıl oxunuş eyni olana
  // qədər (maks. 5) təkrar oxunur; sabitləşməsə XƏTA — natamam siyahı yazılmır.
  const signature = (opts: PanelOption[]) => opts.map((o) => `${o.group}:${o.label}`).join("|");
  let options = await readTrackPanel(page, panel);
  let stable = false;
  for (let i = 0; i < 5 && !stable; i++) {
    await page.waitForTimeout(1_500);
    const again = await readTrackPanel(page, panel);
    stable = signature(again) === signature(options);
    options = again;
  }
  if (!stable) {
    throw new HboCollectorError("SELECTOR_MISSING", "Audio & Subtitles options did not stabilise after 5 reads — not saving a possibly partial list");
  }
  if (!options.length) {
    const dump = await dumpSelectorDiagnostics(page, diagDir, "panel opened but no options read");
    throw new HboCollectorError("SELECTOR_MISSING", `Audio & Subtitles panel has no readable options (dump: ${dump})`);
  }
  if (options.every((o) => o.group === "unknown")) {
    const dump = await dumpSelectorDiagnostics(page, diagDir, "options found but not grouped");
    throw new HboCollectorError("SELECTOR_MISSING", `Read ${options.length} options but could not tell audio from subtitles (dump: ${dump})`);
  }
  return {
    options,
    audioLabels: options.filter((o) => o.group === "audio").map((o) => o.label),
    subtitleLabels: options.filter((o) => o.group === "subtitles").map((o) => o.label),
    ungroupedLabels: options.filter((o) => o.group === "unknown").map((o) => o.label),
    durationMs: Date.now() - started,
  };
}
