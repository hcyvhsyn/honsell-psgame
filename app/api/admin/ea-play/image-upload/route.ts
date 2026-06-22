import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createImageUploadTarget } from "@/lib/imageUploadServer";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const res = await createImageUploadTarget({
    contentType: String(body.contentType ?? ""),
    prefix: "ea-play",
    supabaseBucket: "service-images",
    fileSizeLimit: 5 * 1024 * 1024,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json(res);
}
