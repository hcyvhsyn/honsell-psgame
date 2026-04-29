import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);
const BUCKET = "receipts";

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
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);

    if (error || !data) {
      return NextResponse.json(
        { error: "Upload linki yaradıla bilmədi" },
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
      { error: "Upload linki yaradıla bilmədi" },
      { status: 500 }
    );
  }
}

