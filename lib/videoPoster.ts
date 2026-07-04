"use client";

/**
 * Reels admin — videodan ilk kadrı çıxarıb poster (JPEG) kimi qaytarır, həmçinin
 * ölçü + müddəti verir. Beləliklə admin ayrıca poster hazırlamağa məcbur olmur.
 * Tamamilə brauzerdə işləyir (<video> + <canvas>), server/kitabxana yox.
 *
 *  • captureVideoPoster(File)      — fayl yükləmə (CORS problemi yoxdur).
 *  • captureVideoPosterFromUrl(url)— uzaq/URL idxalı. crossOrigin lazımdır; mənbə
 *    CORS icazəsi verməsə canvas "taint" olur və poster alına bilmir → null qaytarır
 *    (admin əl ilə poster əlavə edə bilər, feed video first-frame-ə düşür).
 */

export type PosterResult = {
  posterFile: File | null;
  width: number;
  height: number;
  durationMs: number;
};

async function grabFrame(
  video: HTMLVideoElement,
  atSeconds: number,
): Promise<PosterResult> {
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Video oxunmadı"));
  });

  const seekTo = Math.min(atSeconds, Math.max(0, (video.duration || 1) - 0.05));
  await new Promise<void>((resolve, reject) => {
    video.onseeked = () => resolve();
    video.onerror = () => reject(new Error("Kadr alınmadı"));
    video.currentTime = seekTo;
  });

  const width = video.videoWidth || 720;
  const height = video.videoHeight || 1280;
  const durationMs = Math.round((video.duration || 0) * 1000);

  let posterFile: File | null = null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, width, height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.82),
      );
      if (blob) posterFile = new File([blob], "poster.jpg", { type: "image/jpeg" });
    }
  } catch {
    // cross-origin taint və s. — poster olmadan davam
    posterFile = null;
  }

  return { posterFile, width, height, durationMs };
}

export async function captureVideoPoster(file: File, atSeconds = 0.1): Promise<PosterResult> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    return await grabFrame(video, atSeconds);
  } finally {
    URL.revokeObjectURL(url);
    video.src = "";
  }
}

export async function captureVideoPosterFromUrl(
  src: string,
  atSeconds = 0.1,
): Promise<PosterResult> {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.crossOrigin = "anonymous";
  video.src = src;
  try {
    return await grabFrame(video, atSeconds);
  } catch {
    return { posterFile: null, width: 720, height: 1280, durationMs: 0 };
  } finally {
    video.src = "";
  }
}
