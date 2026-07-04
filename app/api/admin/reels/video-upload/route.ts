import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createVideoUploadTarget } from "@/lib/imageUploadServer";

export const runtime = "nodejs";

/** Reels videosu üçün presigned upload hədəfi (R2 → Supabase fallback). */
export async function POST(req: Request) {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const res = await createVideoUploadTarget({
    contentType: String(body.contentType ?? ""),
    prefix: "reels",
    supabaseBucket: "reels",
    fileSizeLimit: 100 * 1024 * 1024,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json(res);
}
