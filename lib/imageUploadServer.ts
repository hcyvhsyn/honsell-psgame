import { getSupabaseAdmin } from "@/lib/supabase-server";
import { isR2Configured, presignR2Upload } from "@/lib/r2";

/**
 * Bütün admin şəkil-yükləmə route-ları üçün ortaq hədəf yaradıcısı.
 *
 * R2 qurulubsa → R2 presigned PUT (mode:"r2"). Qurulmayıbsa → köhnə Supabase
 * signed upload (mode:"supabase"). Klient (uploadAdminImage) hər iki rejimi
 * başa düşür, ona görə env qoşulana qədər heç nə pozulmur.
 */

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

function extOf(ct: string): string {
  return ct === "image/png" ? "png" : ct === "image/webp" ? "webp" : "jpg";
}

export type ImageUploadTarget =
  | { ok: true; mode: "r2"; uploadUrl: string; publicUrl: string; key: string }
  | { ok: true; mode: "supabase"; bucket: string; path: string; token: string; publicUrl: string }
  | { ok: false; status: number; error: string };

export async function createImageUploadTarget(opts: {
  contentType: string;
  /** Açar qovluğu, məs. "banners", "services", "ps-plus/PREMIUM". */
  prefix: string;
  /** R2 yoxdursa fallback üçün Supabase bucket adı. */
  supabaseBucket: string;
  fileSizeLimit?: number;
}): Promise<ImageUploadTarget> {
  const { contentType, prefix, supabaseBucket } = opts;

  if (!ALLOWED.has(contentType)) {
    return { ok: false, status: 400, error: "Yalnız PNG, JPEG və WEBP qəbul olunur" };
  }

  const ext = extOf(contentType);
  const rand = Math.random().toString(36).slice(2, 8);
  const key = `${prefix.replace(/\/+$/, "")}/${Date.now()}-${rand}.${ext}`;

  // ─── R2 (üstünlük) ─────────────────────────────────────────────────────
  if (isR2Configured()) {
    try {
      const { uploadUrl, publicUrl } = await presignR2Upload(key, contentType);
      return { ok: true, mode: "r2", uploadUrl, publicUrl, key };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, status: 500, error: `R2 upload linki yaradıla bilmədi: ${msg}` };
    }
  }

  // ─── Supabase fallback (R2 env yoxdur) ─────────────────────────────────
  try {
    const supabase = getSupabaseAdmin();
    const { data: existing } = await supabase.storage.getBucket(supabaseBucket);
    if (!existing) {
      const { error: createErr } = await supabase.storage.createBucket(supabaseBucket, {
        public: true,
        allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
        fileSizeLimit: opts.fileSizeLimit ?? 5 * 1024 * 1024,
      });
      if (createErr && !/already exists/i.test(createErr.message)) {
        return { ok: false, status: 500, error: `Bucket yaradıla bilmədi: ${createErr.message}` };
      }
    }

    const { data, error } = await supabase.storage.from(supabaseBucket).createSignedUploadUrl(key);
    if (error || !data) {
      return { ok: false, status: 500, error: "Upload linki yaradıla bilmədi" };
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from(supabaseBucket).getPublicUrl(key);

    return { ok: true, mode: "supabase", bucket: supabaseBucket, path: key, token: data.token, publicUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 500, error: msg };
  }
}
