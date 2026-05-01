import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);
const BUCKET = "banners";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const contentType = String(body.contentType ?? "");

  if (!ALLOWED.has(contentType)) {
    return NextResponse.json({ error: "Yalnız PNG, JPEG və WEBP qəbul olunur" }, { status: 400 });
  }

  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const path = `banners/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  try {
    const supabase = getSupabaseAdmin();

    const { data: existing } = await supabase.storage.getBucket(BUCKET);
    if (!existing) {
      const { error: createErr } = await supabase.storage.createBucket(BUCKET, {
        public: true,
        allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
        fileSizeLimit: 10 * 1024 * 1024,
      });
      if (createErr && !/already exists/i.test(createErr.message)) {
        return NextResponse.json({ error: `Bucket yaradıla bilmədi: ${createErr.message}` }, { status: 500 });
      }
    }

    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      return NextResponse.json({ error: "Upload linki yaradıla bilmədi" }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);

    return NextResponse.json({ ok: true, bucket: BUCKET, path, token: data.token, publicUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
