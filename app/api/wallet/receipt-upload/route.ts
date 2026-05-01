import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);
const BUCKET = "receipts";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const contentType = String(body.contentType ?? "");

  if (!ALLOWED.has(contentType)) {
    return NextResponse.json(
      { error: "Yalnız PNG, JPEG, WEBP və PDF qəbul olunur" },
      { status: 400 }
    );
  }

  const ext =
    contentType === "application/pdf"
      ? "pdf"
      : contentType === "image/png"
        ? "png"
        : contentType === "image/webp"
          ? "webp"
          : "jpg";

  const path = `${user.id}/${Date.now()}.${ext}`;

  try {
    const supabase = getSupabaseAdmin();

    // Ensure bucket exists in production (prevents opaque 500 on first upload).
    const { data: existing } = await supabase.storage.getBucket(BUCKET);
    if (!existing) {
      const { error: createErr } = await supabase.storage.createBucket(BUCKET, {
        public: false,
        allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
        fileSizeLimit: MAX_BYTES,
      });
      if (createErr && !/already exists/i.test(createErr.message)) {
        return NextResponse.json(
          { error: `Bucket yaradıla bilmədi: ${createErr.message}` },
          { status: 500 }
        );
      }
    }

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);

    if (error || !data) {
      return NextResponse.json(
        { error: "Upload linki yaradıla bilmədi", hint: error?.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      bucket: BUCKET,
      path,
      token: data.token,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("wallet/receipt-upload failed", { userId: user.id, message: msg, err });
    return NextResponse.json(
      {
        error: "Upload linki yaradıla bilmədi",
        hint:
          msg.includes("SUPABASE_SERVICE_ROLE_KEY") || msg.includes("NEXT_PUBLIC_SUPABASE_URL")
            ? "Supabase server açarları yoxdur (env: SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL)."
            : msg,
      },
      { status: 500 }
    );
  }
}

