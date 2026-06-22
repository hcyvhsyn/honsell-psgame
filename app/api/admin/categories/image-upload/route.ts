import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createImageUploadTarget } from "@/lib/imageUploadServer";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const key = String(body.key ?? "category").toLowerCase().replace(/[^a-z0-9-]+/g, "-");

  const res = await createImageUploadTarget({
    contentType: String(body.contentType ?? ""),
    prefix: `categories/${key}`,
    supabaseBucket: "category-images",
    fileSizeLimit: 5 * 1024 * 1024,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json(res);
}
