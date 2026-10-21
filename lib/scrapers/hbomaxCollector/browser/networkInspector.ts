/**
 * Şəbəkə inspektoru — HBO Max-ın ADİ metadata JSON-larını (Fetch/XHR) tutur.
 *
 * Gövdəsi OXUNMAYAN sorğular (URL/resurs tipi ilə əvvəlcədən atılır):
 * - playback/manifest/DRM/lisenziya (`/playback`, widevine, playready, .mpd, .m3u8 …)
 * - video/audio seqmentləri, şəkillər, şriftlər (yalnız fetch/xhr qəbul edilir)
 * - analitika, telemetriya, reklam, izləmə pikselləri
 * - auth/token/hesab/ödəniş endpoint-ləri (məxfi məlumat)
 *
 * Qalan JSON-lar siqnallara görə təsnif olunur və yalnız faydalı olanlar
 * `debug-responses/<run>/`-a yazılır. Saxlanan JSON-da token/cookie/e-poçt kimi
 * açarlar `[redacted]` olur; URL-in query-si də süzülür.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Page, Request, Response } from "playwright";
import { HBOMAX_CONFIG } from "@/lib/scrapers/hbomaxCollector/config";
import { hboLog } from "@/lib/scrapers/hbomaxCollector/log";

export type Signal =
  | "title"
  | "series"
  | "seasons"
  | "episodes"
  | "artwork"
  | "genres"
  | "audio"
  | "subtitles";

export interface CapturedResponse {
  seq: number;
  url: string;
  method: string;
  status: number;
  signals: Signal[];
  bytes: number;
  file?: string;
  body: unknown;
}

// ── Süzgəclər ───────────────────────────────────────────────────────────────
const BLOCKED_URL_PATTERNS: RegExp[] = [
  // playback / DRM / media
  /\/playback|playbackinfo|\/drm|license|widevine|playready|fairplay|\/cdm|\/keys?\b|manifest|\.m3u8|\.mpd|\.m4[asv]\b|\.ts(\?|$)|\.mp4|\.vtt|\.ttml|\.dfxp|\/segments?\//i,
  // analitika / telemetriya / reklam / izləmə
  /analytics|telemetry|\/events?\b|\/beacon|\/collect\b|\/track(ing)?\b|\/metrics|\/log(s|ging)?\b|\/heartbeat|\/pixel|\/ping\b|\/stats?\b|\/qos\b/i,
  /doubleclick|googletagmanager|google-analytics|googlesyndication|googleadservices|\/pagead\/|adsrvr|freewheel|fwmrm|imasdk|brightline|mediamelon|\/ads?\//i,
  /omtrdc|demdex|adobedtm|segment\.(io|com)|amplitude|braze|appboy|conviva|newrelic|nr-data|datadog|sentry|optimizely|onetrust|cookielaw|mparticle|branch\.io|hotjar|fullstory|launchdarkly|split\.io|akstat|go-mpulse/i,
  // auth / hesab / ödəniş — məxfi
  /token|\/auth|login|logout|session|password|\/users?\/|\/profiles?\b|\/account|subscription|payment|billing|entitlement|\/me\b|consent|privacy/i,
];

export function isBlockedUrl(url: string): boolean {
  return BLOCKED_URL_PATTERNS.some((re) => re.test(url));
}

const SENSITIVE_KEY_RE = /token|cookie|secret|password|passwd|email|authorization|session|signature|credential|apikey|api_key|jwt|bearer/i;
const SENSITIVE_QUERY_RE = /token|auth|sig|key|session|jwt|hash|cred/i;

export function redactUrl(raw: string): string {
  try {
    const u = new URL(raw);
    for (const k of [...u.searchParams.keys()]) {
      if (SENSITIVE_QUERY_RE.test(k)) u.searchParams.set(k, "[redacted]");
    }
    return u.toString();
  } catch {
    return raw;
  }
}

export function redactJson(value: unknown, depth = 0): unknown {
  if (depth > 40) return value;
  if (Array.isArray(value)) return value.map((v) => redactJson(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEY_RE.test(k) && (typeof v === "string" || typeof v === "number") ? "[redacted]" : redactJson(v, depth + 1);
    }
    return out;
  }
  return value;
}

// ── Təsnifat ────────────────────────────────────────────────────────────────
const KEY_SIGNALS: ReadonlyArray<readonly [Signal, RegExp]> = [
  ["title", /^(title|name|titleName|originalName|originalTitle|secondaryTitle)$/i],
  ["series", /^(show|series|showId|seriesId|showType)$/i],
  ["seasons", /^(seasons?|seasonNumber|seasonCount|numberOfSeasons)$/i],
  ["episodes", /^(episodes?|episodeNumber|episodeCount|numberOfEpisodes)$/i],
  ["artwork", /^(images?|poster|posterUrl|backdrop|keyArt|artwork|thumbnail|src)$/i],
  ["genres", /^(genres?|txGenres|genreNames|tags)$/i],
  ["audio", /^(audio|audioTracks?|audioLanguages?|audioStreams?|originalAudio|originalLanguage|spokenLanguages?|dubbedLanguages?)$/i],
  ["subtitles", /^(subtitles?|subtitleTracks?|subtitleLanguages?|textTracks?|captions?|closedCaptions?|timedText)$/i],
];

const VALUE_SIGNALS: ReadonlyArray<readonly [Signal, RegExp]> = [
  ["series", /^(show|series)$/i],
  ["episodes", /^episode$/i],
  ["seasons", /^season$/i],
  ["genres", /^genre$/i],
];

/** Dərin gəzinti ilə hansı məlumat növlərini daşıdığını tapır (ən çox ~50k node). */
export function classifyJson(body: unknown): Signal[] {
  const found = new Set<Signal>();
  let budget = 50_000;
  const stack: unknown[] = [body];
  while (stack.length && budget-- > 0) {
    const cur = stack.pop();
    if (Array.isArray(cur)) {
      for (const v of cur) stack.push(v);
    } else if (cur && typeof cur === "object") {
      for (const [k, v] of Object.entries(cur)) {
        for (const [sig, re] of KEY_SIGNALS) if (re.test(k)) found.add(sig);
        if (typeof v === "string" && /^(type|kind|videoType|showType)$/i.test(k)) {
          for (const [sig, re] of VALUE_SIGNALS) if (re.test(v)) found.add(sig);
        }
        if (v && typeof v === "object") stack.push(v);
      }
    }
  }
  return [...found].sort();
}

/** Yalnız "title"/"artwork" daşıyan JSON (məs. ana səhifə rail-ləri) tək başına faydalı sayılmır. */
export function isUseful(signals: Signal[]): boolean {
  const strong: Signal[] = ["series", "seasons", "episodes", "audio", "subtitles", "genres"];
  return signals.some((s) => strong.includes(s));
}

function slugForFile(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.split(".").slice(0, 2).join("-");
    const p = u.pathname.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
    return `${host}__${p || "root"}`;
  } catch {
    return "unknown";
  }
}

export interface InspectorResult {
  runDir: string;
  captured: CapturedResponse[];
  stats: { seen: number; blocked: number; nonJson: number; notUseful: number; saved: number; failed: number };
  /** Gövdəsi oxunmayan/saxlanmayan sorğular (origin+path, query yox) — süzgəcin yoxlanması üçün. */
  skipped: Array<{ url: string; reason: "blocked" | "non-json" | "not-useful" | "failed"; error?: string }>;
}

function errorText(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).split("\n")[0].slice(0, 200);
}

function originPath(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.origin}${u.pathname}`;
  } catch {
    return "invalid-url";
  }
}

/**
 * Səhifəyə qoşulur; `stop()` index faylını yazır və tutulanları qaytarır.
 * `label` qovluq adına düşür (series/episode).
 */
export function startNetworkInspector(page: Page, label: string) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const runDir = path.join(HBOMAX_CONFIG.debugDir, `${stamp}-${label}`);
  mkdirSync(runDir, { recursive: true });

  const captured: CapturedResponse[] = [];
  const stats = { seen: 0, blocked: 0, nonJson: 0, notUseful: 0, saved: 0, failed: 0 };
  const pending = new Set<Promise<void>>();
  const skipped: InspectorResult["skipped"] = [];
  const skip = (url: string, reason: InspectorResult["skipped"][number]["reason"], error?: string) => {
    if (skipped.length < 300) skipped.push({ url: originPath(url), reason, ...(error ? { error } : {}) });
  };
  let seq = 0;

  const handle = async (response: Response) => {
    const req: Request = response.request();
    const type = req.resourceType();
    if (type !== "fetch" && type !== "xhr") return;
    stats.seen++;

    const url = response.url();
    if (isBlockedUrl(url)) {
      stats.blocked++;
      skip(url, "blocked");
      return;
    }
    const ct = (await response.headerValue("content-type").catch(() => null)) ?? "";
    if (!/json/i.test(ct)) {
      stats.nonJson++;
      skip(url, "non-json");
      return;
    }
    const status = response.status();
    if (status >= 300 && status < 400) return;

    let body: unknown;
    try {
      body = await response.json();
    } catch (err) {
      // Adətən səhifə dəyişəndə/axın kəsiləndə gövdə artıq əlçatmaz olur (Chrome
      // "No resource with given identifier"). Səbəb index-ə yazılır ki, yoxlanıla bilsin.
      stats.failed++;
      skip(url, "failed", errorText(err));
      return;
    }
    const signals = classifyJson(body);
    if (!isUseful(signals)) {
      stats.notUseful++;
      skip(url, "not-useful");
      return;
    }

    const n = ++seq;
    const safeBody = redactJson(body);
    const file = `${String(n).padStart(3, "0")}-${slugForFile(url)}__${signals.join("+")}.json`;
    const text = JSON.stringify(safeBody, null, 2);
    writeFileSync(path.join(runDir, file), text);
    stats.saved++;
    captured.push({ seq: n, url: redactUrl(url), method: req.method(), status, signals, bytes: text.length, file, body: safeBody });
    hboLog.debug("Captured metadata JSON", { file, signals: signals.join("+") });
  };

  const listener = (response: Response) => {
    const p = handle(response).catch((err: unknown) => {
      stats.failed++;
      skip(response.url(), "failed", errorText(err));
    });
    pending.add(p);
    void p.finally(() => pending.delete(p));
  };
  page.on("response", listener);

  return {
    runDir,
    /** Hazırda tutulanlar (stop-dan əvvəl də oxuna bilər). */
    get captured(): readonly CapturedResponse[] {
      return captured;
    },
    async stop(): Promise<InspectorResult> {
      page.off("response", listener);
      await Promise.allSettled([...pending]);
      const index = captured.map((c) => ({ seq: c.seq, file: c.file, method: c.method, status: c.status, url: c.url, signals: c.signals, bytes: c.bytes }));
      writeFileSync(path.join(runDir, "_index.json"), JSON.stringify({ label, stats, responses: index, skipped }, null, 2));
      hboLog.info("Network inspector summary", { ...stats, dir: path.relative(process.cwd(), runDir) });
      return { runDir, captured, stats, skipped };
    },
  };
}

export type NetworkInspector = ReturnType<typeof startNetworkInspector>;
