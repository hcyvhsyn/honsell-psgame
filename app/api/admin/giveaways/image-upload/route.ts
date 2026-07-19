import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createImageUploadTarget } from "@/lib/imageUploadServer";

export const runtime = "nodejs";

/** Çəkiliş mükafat şəkli üçün presigned upload hədəfi. */
export async function POST(req: Request) {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const res = await createImageUploadTarget({
    contentType: String(body.contentType ?? ""),
    prefix: "giveaways",
    supabaseBucket: "banners",
    fileSizeLimit: 10 * 1024 * 1024,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json(res);
}
