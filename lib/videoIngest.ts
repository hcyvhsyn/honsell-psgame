import { spawn, execFile } from "child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

/**
 * Video ingest (server) — yt-dlp ilə link-dən (TikTok/Instagram/YouTube...) endirir,
 * ffmpeg ilə web-optimized H.264 + faststart-a çevirir və poster çıxarır.
 * Həm də Telegram video FAYLLARINI eyni cür normalizə edir (faststart + poster).
 *
 * Binary-lər Docker image-ə əlavə olunmalıdır (ffmpeg, ffprobe, yt-dlp). Yol env
 * ilə override oluna bilər: FFMPEG_PATH / FFPROBE_PATH / YTDLP_PATH.
 */

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";
const YTDLP = process.env.YTDLP_PATH || "yt-dlp";

/**
 * yt-dlp üçün auth cookie-ləri. Instagram (və bəzən TikTok) artıq login-siz
 * media qaytarmır, ona görə Netscape formatlı cookies.txt faylı lazımdır.
 *  - YTDLP_COOKIES_FILE       — bütün saytlar üçün cookies.txt yolu
 *  - YTDLP_COOKIES_FROM_BROWSER — məs. "chrome" (yalnız brauzeri olan mühitdə)
 * Yalnız faktiki auth lazım olan host-lara tətbiq edirik ki, digər saytlar
 * lazımsız cookie faylından təsirlənməsin.
 */
const COOKIES_FILE = process.env.YTDLP_COOKIES_FILE || "";
const COOKIES_FROM_BROWSER = process.env.YTDLP_COOKIES_FROM_BROWSER || "";

const AUTH_HOSTS = ["instagram.com", "facebook.com", "fb.watch"];

function cookieArgs(url: string): string[] {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    host = "";
  }
  const needsAuth = AUTH_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  if (!needsAuth) return [];
  if (COOKIES_FILE) return ["--cookies", COOKIES_FILE];
  if (COOKIES_FROM_BROWSER) return ["--cookies-from-browser", COOKIES_FROM_BROWSER];
  return [];
}

export type ReelAssets = {
  videoBuffer: Buffer;
  posterBuffer: Buffer | null;
  width: number;
  height: number;
  durationMs: number;
};

function run(
  cmd: string,
  args: string[],
  timeoutMs = 120_000,
): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${cmd} vaxt aşımına uğradı`));
    }, timeoutMs);
    child.stderr?.on("data", (d) => {
      stderr += String(d);
      if (stderr.length > 20000) stderr = stderr.slice(-20000);
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stderr });
    });
  });
}

/** Binary quraşdırılıbmı? (graceful fallback üçün) */
export async function checkIngestBinaries(): Promise<{ ffmpeg: boolean; ytdlp: boolean }> {
  const ok = async (cmd: string, arg: string) => {
    try {
      const { code } = await run(cmd, [arg], 8000);
      return code === 0;
    } catch {
      return false;
    }
  };
  const [ffmpeg, ytdlp] = await Promise.all([ok(FFMPEG, "-version"), ok(YTDLP, "--version")]);
  return { ffmpeg, ytdlp };
}

async function probe(input: string): Promise<{ width: number; height: number; durationMs: number }> {
  return new Promise((resolve) => {
    execFile(
      FFPROBE,
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height",
        "-show_entries",
        "format=duration",
        "-of",
        "json",
        input,
      ],
      { timeout: 15000 },
      (err, stdout) => {
        if (err) return resolve({ width: 720, height: 1280, durationMs: 0 });
        try {
          const j = JSON.parse(String(stdout));
          const s = j.streams?.[0] ?? {};
          const dur = Number(j.format?.duration) || 0;
          resolve({
            width: Number(s.width) || 720,
            height: Number(s.height) || 1280,
            durationMs: Math.round(dur * 1000),
          });
        } catch {
          resolve({ width: 720, height: 1280, durationMs: 0 });
        }
      },
    );
  });
}

/** yt-dlp ilə URL-dən video endirir; endirilmiş faylın yolunu qaytarır. */
async function downloadWithYtDlp(url: string, dir: string): Promise<string> {
  const outTmpl = path.join(dir, "src.%(ext)s");
  const { code, stderr } = await run(
    YTDLP,
    [
      "--no-playlist",
      "--no-warnings",
      "--no-progress",
      ...cookieArgs(url),
      "-f",
      "mp4/bestvideo*+bestaudio/best",
      "--merge-output-format",
      "mp4",
      "-o",
      outTmpl,
      url,
    ],
    // Fon rejimində işlədiyi üçün webhook cavabını gözlətmir.
    300_000,
  );
  if (code !== 0) {
    const last = stderr.split("\n").filter(Boolean).pop() ?? "yt-dlp xətası";
    const isAuth =
      /empty media response|login|rate-limit|cookies|Restricted Video|not available|private/i.test(stderr);
    const hasCookies = Boolean(COOKIES_FILE || COOKIES_FROM_BROWSER);
    if (isAuth && !hasCookies) {
      throw new Error(
        "Endirmə alınmadı: Instagram login tələb edir. Serverdə YTDLP_COOKIES_FILE (cookies.txt) təyin edin.",
      );
    }
    throw new Error(`Endirmə alınmadı: ${last}`);
  }
  const files = await readdir(dir);
  const src = files.find((f) => f.startsWith("src."));
  if (!src) throw new Error("Endirilmiş fayl tapılmadı");
  return path.join(dir, src);
}

/** Video/audio codec adlarını və eni oxuyur — remux mümkünlüyünü qiymətləndirmək üçün. */
async function probeCodecs(
  input: string,
): Promise<{ video: string; audio: string; width: number }> {
  return new Promise((resolve) => {
    execFile(
      FFPROBE,
      [
        "-v",
        "error",
        "-show_entries",
        "stream=codec_name,codec_type,width",
        "-of",
        "json",
        input,
      ],
      { timeout: 15000 },
      (err, stdout) => {
        if (err) return resolve({ video: "", audio: "", width: 0 });
        try {
          const streams: { codec_name?: string; codec_type?: string; width?: number }[] =
            JSON.parse(String(stdout)).streams ?? [];
          const v = streams.find((s) => s.codec_type === "video");
          const a = streams.find((s) => s.codec_type === "audio");
          resolve({
            video: v?.codec_name ?? "",
            audio: a?.codec_name ?? "",
            width: Number(v?.width) || 0,
          });
        } catch {
          resolve({ video: "", audio: "", width: 0 });
        }
      },
    );
  });
}

/** Girişi web-optimized H.264 + faststart-a çevirir + poster çıxarır. */
async function processFile(src: string, dir: string): Promise<ReelAssets> {
  const outVid = path.join(dir, "out.mp4");
  const outPoster = path.join(dir, "poster.jpg");

  // TikTok/Instagram/YouTube endirmələri demək olar həmişə ONSUZ DA H.264+AAC olur.
  // Belə hallarda yenidən kodlaşdırmaq mənasızdır: yalnız konteyneri remux edib
  // `+faststart` qoyuruq — dəqiqələr əvəzinə saniyələr çəkir və CPU-nu boğmur.
  // (4GB serverdə paralel transcode-lar məhz buna görə vaxt aşımına uğrayırdı.)
  const codecs = await probeCodecs(src);
  const canRemux =
    codecs.video === "h264" &&
    (codecs.audio === "aac" || codecs.audio === "") &&
    codecs.width > 0 &&
    codecs.width <= 1920;

  let ok = false;
  if (canRemux) {
    const remux = await run(
      FFMPEG,
      ["-y", "-i", src, "-c", "copy", "-movflags", "+faststart", outVid],
      120_000,
    );
    ok = remux.code === 0;
  }

  if (!ok) {
    const vid = await run(
      FFMPEG,
      [
        "-y",
        "-i",
        src,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-profile:v",
        "high",
        "-pix_fmt",
        "yuv420p",
        "-vf",
        "scale='min(1080,iw)':-2",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart",
        outVid,
      ],
      // Artıq webhook cavabını gözlətmir (fon rejimi), ona görə həqiqi uzun
      // videolar üçün geniş hədd verilir.
      600_000,
    );
    if (vid.code !== 0) {
      throw new Error(
        `Video emalı alınmadı: ${vid.stderr.split("\n").filter(Boolean).pop() ?? "ffmpeg xətası"}`,
      );
    }
  }

  let posterBuffer: Buffer | null = null;
  try {
    const pos = await run(
      FFMPEG,
      ["-y", "-ss", "0.5", "-i", outVid, "-vframes", "1", "-vf", "scale='min(1080,iw)':-2", "-q:v", "3", outPoster],
      30_000,
    );
    if (pos.code === 0) posterBuffer = await readFile(outPoster);
  } catch {
    /* poster opsional */
  }

  const { width, height, durationMs } = await probe(outVid);
  const videoBuffer = await readFile(outVid);
  return { videoBuffer, posterBuffer, width, height, durationMs };
}

/** URL-dən ingest (yt-dlp + ffmpeg). */
export async function ingestFromUrl(url: string): Promise<ReelAssets> {
  const dir = await mkdtemp(path.join(tmpdir(), "reel-"));
  try {
    const src = await downloadWithYtDlp(url, dir);
    return await processFile(src, dir);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Baytlardan (Telegram faylı) ingest — ffmpeg ilə faststart + poster. */
export async function ingestFromBytes(bytes: Buffer, ext = "mp4"): Promise<ReelAssets> {
  const dir = await mkdtemp(path.join(tmpdir(), "reel-"));
  try {
    const src = path.join(dir, `src.${ext}`);
    await writeFile(src, bytes);
    return await processFile(src, dir);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
