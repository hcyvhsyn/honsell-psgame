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
      "-f",
      "mp4/bestvideo*+bestaudio/best",
      "--merge-output-format",
      "mp4",
      "-o",
      outTmpl,
      url,
    ],
    150_000,
  );
  if (code !== 0) {
    throw new Error(`Endirmə alınmadı: ${stderr.split("\n").filter(Boolean).pop() ?? "yt-dlp xətası"}`);
  }
  const files = await readdir(dir);
  const src = files.find((f) => f.startsWith("src."));
  if (!src) throw new Error("Endirilmiş fayl tapılmadı");
  return path.join(dir, src);
}

/** Girişi web-optimized H.264 + faststart-a çevirir + poster çıxarır. */
async function processFile(src: string, dir: string): Promise<ReelAssets> {
  const outVid = path.join(dir, "out.mp4");
  const outPoster = path.join(dir, "poster.jpg");

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
    180_000,
  );
  if (vid.code !== 0) {
    throw new Error(`Video emalı alınmadı: ${vid.stderr.split("\n").filter(Boolean).pop() ?? "ffmpeg xətası"}`);
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
