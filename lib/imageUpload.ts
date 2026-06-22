"use client";

/**
 * Admin şəkil yükləmələri üçün ortaq sıxılma + keş başlıqları. Məqsəd: Supabase
 * storage-a TAM ölçülü orijinal yazmaq əvəzinə brauzerdə kiçildilmiş/webp
 * variantı yükləmək — həm storage, həm də (Next optimizer origin-dən çəkəndə)
 * egress xərcini kəskin azaldır. Signed-URL axışını dəyişmir, sadəcə fayl
 * yüklənmədən əvvəl emal olunur.
 */

/** Yüklənən şəkillərə qoyulan Cache-Control (1 il) — CDN/keş təbəqələri üçün. */
export const IMAGE_UPLOAD_CACHE_CONTROL = "31536000";

const MAX_DIM = 1600;
const WEBP_QUALITY = 0.82;
/** Bu həcmin altında və onsuz da kiçik olçülü şəkli yenidən kodlamağa dəyməz. */
const SKIP_BYTES = 300 * 1024;

/**
 * Şəkli brauzerdə canvas vasitəsilə max 1600px-ə endirib webp-ə çevirir.
 * Rastr olmayan (SVG) və ya GIF toxunulmur. Hər hansı xəta / fayda olmadıqda
 * orijinal fayl olduğu kimi qaytarılır (heç vaxt böyütmür, axışı pozmur).
 */
export async function compressImageForUpload(file: File): Promise<File> {
  try {
    if (typeof window === "undefined") return file;
    if (!file.type.startsWith("image/")) return file;
    if (file.type === "image/svg+xml" || file.type === "image/gif") return file;

    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) return file;

    const { width, height } = bitmap;
    const scale = Math.min(1, MAX_DIM / Math.max(width, height));

    // Onsuz da kiçik (ölçü + həcm) şəkli toxunmadan saxla.
    if (scale === 1 && file.size <= SKIP_BYTES) {
      bitmap.close?.();
      return file;
    }

    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close?.();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/webp", WEBP_QUALITY),
    );
    // Nəticə yoxdursa və ya orijinaldan kiçik deyilsə — orijinalı saxla.
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
    return new File([blob], name, { type: "image/webp", lastModified: Date.now() });
  } catch {
    return file;
  }
}
