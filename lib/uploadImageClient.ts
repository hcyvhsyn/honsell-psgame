"use client";

import { compressImageForUpload, IMAGE_UPLOAD_CACHE_CONTROL } from "@/lib/imageUpload";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

/**
 * Bütün admin şəkil yükləmələri üçün ortaq klient funksiyası.
 *
 * 1) Şəkli brauzerdə sıxır (webp, max 1600px) — egress/storage qənaəti.
 * 2) `endpoint`-ə POST edib upload hədəfini alır (R2 və ya Supabase rejimi).
 * 3) R2 rejimində presigned URL-ə PUT, Supabase rejimində signed upload edir.
 *
 * Uğurda `{ ok:true, url }` (DB-yə yazılacaq public URL), əks halda `{ ok:false, error }`.
 */
export async function uploadAdminImage(
  endpoint: string,
  file: File,
  extra?: Record<string, unknown>,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const f = await compressImageForUpload(file);

  const init = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: f.type, ...(extra ?? {}) }),
  });
  const data = await init.json().catch(() => ({} as Record<string, unknown>));
  if (!init.ok) {
    return { ok: false, error: String((data as { error?: string }).error ?? "Upload hazırlanmadı") };
  }

  // ─── R2 presigned PUT ──────────────────────────────────────────────────
  if ((data as { mode?: string }).mode === "r2") {
    const uploadUrl = String((data as { uploadUrl?: string }).uploadUrl ?? "");
    try {
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": f.type },
        body: f,
      });
      if (!put.ok) return { ok: false, error: `R2 upload alınmadı (${put.status})` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "R2 upload alınmadı" };
    }
    return { ok: true, url: String((data as { publicUrl?: string }).publicUrl ?? "") };
  }

  // ─── Supabase signed upload (fallback) ─────────────────────────────────
  const d = data as { bucket?: string; path?: string; token?: string; publicUrl?: string };
  if (!d.bucket || !d.path || !d.token) {
    return { ok: false, error: "Upload hədəfi natamam qayıtdı" };
  }
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.storage
    .from(d.bucket)
    .uploadToSignedUrl(d.path, d.token, f, {
      cacheControl: IMAGE_UPLOAD_CACHE_CONTROL,
      contentType: f.type,
      upsert: true,
    });
  if (error) return { ok: false, error: error.message };
  return { ok: true, url: String(d.publicUrl ?? "") };
}
